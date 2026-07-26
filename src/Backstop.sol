// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IAssetManager} from "flare-periphery/src/coston2/IAssetManager.sol";
import {IFdcVerification} from "flare-periphery/src/coston2/IFdcVerification.sol";
import {IReferencedPaymentNonexistence} from "flare-periphery/src/coston2/IReferencedPaymentNonexistence.sol";
import {FtsoV2Interface} from "flare-periphery/src/coston2/FtsoV2Interface.sol";
import {RedemptionRequestInfo} from "flare-periphery/src/coston2/data/RedemptionRequestInfo.sol";

import {RegistryResolver} from "./RegistryResolver.sol";
import {PremiumMath} from "./PremiumMath.sol";
import {BackstopPool} from "./BackstopPool.sol";

/**
 * @title Backstop
 * @notice Redemption-default insurance for FXRP. A redeemer binds a "guard" to
 *         their on-chain FAsset redemption ticket for an FTSO-priced premium. If
 *         the assigned agent fails to deliver XRP by the deadline, anyone can
 *         submit Flare's own FDC `ReferencedPaymentNonexistence` proof — the exact
 *         attestation the FAssets protocol accepts for `redemptionPaymentDefault`
 *         — and Backstop verifies it on-chain and pays the redeemer make-whole.
 *
 * @dev THE ONE FLOW: buyGuard → agent defaults → claim(proof) → payout.
 *
 *      OPTION-B HEDGE (specs/BUILD_LOG.md): the entire FDC dependency is isolated
 *      in `_verifyDefault`, marked `virtual`. If the Day-4 (Jul 30) FDC gate fails
 *      on Coston2, we subclass Backstop and override `_verifyDefault` with the
 *      FAsset Guardian liquidation-event claim source — the pool, premium math,
 *      guard lifecycle, and FTSO pricing below are all reused unchanged.
 *
 *      Load-bearing Flare surface (6 engine methods, bar is 5+):
 *        1. IFdcVerification.verifyReferencedPaymentNonexistence — claim gate
 *        2. IAssetManager.redemptionRequestInfo               — bind the ticket
 *        3. FtsoV2.getFeedById(FLR/USD)                       — premium + payout
 *        4. FtsoV2.getFeedById(XRP/USD)                       — coverage sizing
 *        5. FlareContractRegistry.getContractAddressByName    — resolver (lib)
 *        6. (keeper, off-chain) IFdcHub.requestAttestation + DA-Layer proof fetch
 */
contract Backstop {
    // FXRP underlying uses XRP drops = 6 decimals.
    uint256 internal constant UBA_DECIMALS = 1e6;

    enum Status {
        NONE,
        ACTIVE,
        PAID,
        EXPIRED
    }

    struct Guard {
        address redeemer;
        address agentVault;
        uint256 redemptionRequestId;
        bytes32 ticketRef; // redemption standardPaymentReference — unique per ticket
        uint256 expectedAmount; // minimal units (drops) owed on XRPL
        uint64 deadlineTs; // agent's last underlying payment timestamp
        uint256 coverageUsd; // payout cap, USD 1e18
        uint256 premiumPaid; // FLR wei paid at purchase
        Status status;
    }

    address public owner;
    BackstopPool public immutable pool;

    // Pricing params (owner-tunable). Linear premium model — honest MVP
    // simplification, flagged in SPONSOR_DEFENSE §3. No live volatility feed yet.
    uint256 public baseBips = 100; // 1.00% flat
    uint256 public kBips = 50; // slope on volatility
    uint256 public sigmaBips = 2000; // 20% assumed volatility
    uint256 public agentCapUsd = 100_000e18; // per-agent exposure cap
    uint64 public claimGrace = 1 hours; // window after deadline before expire()

    // Global solvency guard: Σ coverage across ACTIVE guards, and the max fraction of the
    // pool's live USD value it may represent. Ties total risk to real backing.
    uint256 public totalActiveCoverageUsd;
    uint256 public maxUtilizationBips = 8000; // pool may back ≤ 80% of its value in coverage

    // FTSO feed ids — owner-settable because the exact bytes21 is a documented
    // pre-build unknown confirmed by the Day-4 spike (specs/sdk-audit.md unknown #2).
    bytes21 public xrpUsdFeedId = 0x015852502f55534400000000000000000000000000;
    bytes21 public flrUsdFeedId = 0x01464c522f55534400000000000000000000000000;

    uint256 public nextGuardId = 1;
    mapping(uint256 => Guard) public guards;

    event GuardBought(
        uint256 indexed guardId,
        address indexed redeemer,
        address indexed agentVault,
        uint256 coverageUsd,
        uint256 premiumFlr
    );
    event Claimed(uint256 indexed guardId, address indexed redeemer, uint256 payoutFlr);
    event Expired(uint256 indexed guardId);
    event ParamsUpdated();

    modifier onlyOwner() {
        require(msg.sender == owner, "Backstop: not owner");
        _;
    }

    constructor(BackstopPool _pool) {
        owner = msg.sender;
        pool = _pool;
    }

    // ── Pricing (FTSO-priced — load-bearing) ────────────────────────────────

    /// @dev Non-view: FtsoV2.getFeedById is `payable` (a feed fee may apply; Coston2
    ///      core feeds are free, so we forward zero). Frontends read via eth_call.
    function _price(bytes21 feedId) internal returns (uint256 value, int8 decimals) {
        (value, decimals,) = RegistryResolver.ftsoV2().getFeedById(feedId);
        require(value > 0, "Backstop: bad feed");
    }

    /// @notice Live make-whole value in USD (1e18) implied by a redemption's FXRP amount.
    function expectedUsd(uint256 valueUBA) public returns (uint256) {
        (uint256 v, int8 d) = _price(xrpUsdFeedId);
        require(d >= 0, "Backstop: neg decimals");
        return (valueUBA * v * 1e18) / (UBA_DECIMALS * (10 ** uint256(uint8(d))));
    }

    /// @notice Premium in USD (1e18) for a given coverage.
    function quotePremiumUsd(uint256 coverageUsd) public view returns (uint256) {
        return PremiumMath.premium(coverageUsd, baseBips, kBips, sigmaBips);
    }

    /// @notice Premium in native FLR wei for a given coverage.
    function quotePremiumFlr(uint256 coverageUsd) public returns (uint256) {
        return usdToFlr(quotePremiumUsd(coverageUsd));
    }

    /// @notice Convert USD (1e18) to native FLR wei at the live FLR/USD price.
    function usdToFlr(uint256 usd1e18) public returns (uint256) {
        (uint256 v, int8 d) = _price(flrUsdFeedId);
        return PremiumMath.usdToNative(usd1e18, v, d);
    }

    /// @notice Convert native FLR wei to USD (1e18) at the live FLR/USD price.
    function flrToUsd(uint256 flrWei) public returns (uint256) {
        (uint256 v, int8 d) = _price(flrUsdFeedId);
        return PremiumMath.nativeToUsd(flrWei, v, d);
    }

    /// @notice Live USD value (1e18) backing the pool — its FLR balance priced by FTSO.
    function poolValueUsd() public returns (uint256) {
        return flrToUsd(address(pool).balance);
    }

    /// @notice Pool utilization in bips = active coverage / pool value. 0 when the pool is empty.
    function utilizationBips() public returns (uint256) {
        uint256 pv = poolValueUsd();
        if (pv == 0) return 0;
        return (totalActiveCoverageUsd * 10_000) / pv;
    }

    // ── The one flow ────────────────────────────────────────────────────────

    /// @notice Bind a guard to a live FXRP redemption and pay the premium.
    function buyGuard(uint256 redemptionRequestId, uint256 coverageUsd) external payable returns (uint256 guardId) {
        IAssetManager am = RegistryResolver.assetManagerFXRP();
        RedemptionRequestInfo.Data memory r = am.redemptionRequestInfo(redemptionRequestId);

        require(r.status == RedemptionRequestInfo.Status.ACTIVE, "Backstop: redemption not active");
        require(r.redeemer == msg.sender, "Backstop: not redeemer");

        uint256 maxUsd = expectedUsd(uint256(r.valueUBA));
        require(coverageUsd > 0 && coverageUsd <= maxUsd, "Backstop: coverage out of range");

        uint256 premium = quotePremiumFlr(coverageUsd);
        require(msg.value >= premium, "Backstop: premium underpaid");

        // Global solvency: total active coverage must stay within maxUtilization% of pool value.
        uint256 newTotal = totalActiveCoverageUsd + coverageUsd;
        require(newTotal * 10_000 <= poolValueUsd() * maxUtilizationBips, "Backstop: pool over-utilized");
        totalActiveCoverageUsd = newTotal;

        // Reserve pool capacity for this agent before taking the risk.
        pool.lockExposure(r.agentVault, coverageUsd, agentCapUsd);

        guardId = nextGuardId++;
        guards[guardId] = Guard({
            redeemer: r.redeemer,
            agentVault: r.agentVault,
            redemptionRequestId: redemptionRequestId,
            ticketRef: r.paymentReference,
            expectedAmount: uint256(r.valueUBA),
            deadlineTs: r.lastUnderlyingTimestamp,
            coverageUsd: coverageUsd,
            premiumPaid: premium,
            status: Status.ACTIVE
        });

        // Premium accrues to LPs (no shares minted); refund any overpayment.
        pool.fund{value: premium}();
        if (msg.value > premium) {
            (bool ok,) = msg.sender.call{value: msg.value - premium}("");
            require(ok, "Backstop: refund failed");
        }

        emit GuardBought(guardId, r.redeemer, r.agentVault, coverageUsd, premium);
    }

    /// @notice Claim a guard by submitting a valid FDC non-existence proof of default.
    function claim(uint256 guardId, IReferencedPaymentNonexistence.Proof calldata proof) external {
        Guard storage g = guards[guardId];
        require(g.status == Status.ACTIVE, "Backstop: guard not active");
        require(block.timestamp > g.deadlineTs, "Backstop: before deadline");

        _verifyDefault(g, proof); // ← isolated FDC gate (option-B swap point)

        g.status = Status.PAID;
        totalActiveCoverageUsd -= g.coverageUsd;
        pool.releaseExposure(g.agentVault, g.coverageUsd);

        uint256 payoutFlr = usdToFlr(g.coverageUsd);
        pool.payout(g.redeemer, payoutFlr);

        emit Claimed(guardId, g.redeemer, payoutFlr);
    }

    /// @notice Lapse a guard after the claim grace with no proven default; LPs keep the premium.
    function expire(uint256 guardId) external {
        Guard storage g = guards[guardId];
        require(g.status == Status.ACTIVE, "Backstop: guard not active");
        require(block.timestamp > uint256(g.deadlineTs) + claimGrace, "Backstop: grace not passed");

        g.status = Status.EXPIRED;
        totalActiveCoverageUsd -= g.coverageUsd;
        pool.releaseExposure(g.agentVault, g.coverageUsd);
        emit Expired(guardId);
    }

    /**
     * @notice Proof-gated default check — the ONLY FDC-dependent code in the protocol.
     * @dev Verifies the RPN proof against the live FdcVerification contract and binds
     *      it to this exact guard by standard payment reference, amount, and deadline.
     *      `virtual` so option B can override with the Guardian claim source.
     */
    function _verifyDefault(Guard storage g, IReferencedPaymentNonexistence.Proof calldata proof)
        internal
        view
        virtual
    {
        IFdcVerification fdc = RegistryResolver.fdcVerification();
        require(fdc.verifyReferencedPaymentNonexistence(proof), "Backstop: invalid RPN proof");

        IReferencedPaymentNonexistence.RequestBody memory rb = proof.data.requestBody;
        require(rb.standardPaymentReference == g.ticketRef, "Backstop: reference mismatch");
        require(rb.amount >= g.expectedAmount, "Backstop: amount mismatch");
        require(rb.deadlineTimestamp >= g.deadlineTs, "Backstop: deadline mismatch");
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    function setPricing(uint256 _baseBips, uint256 _kBips, uint256 _sigmaBips) external onlyOwner {
        baseBips = _baseBips;
        kBips = _kBips;
        sigmaBips = _sigmaBips;
        emit ParamsUpdated();
    }

    function setAgentCapUsd(uint256 _capUsd) external onlyOwner {
        agentCapUsd = _capUsd;
        emit ParamsUpdated();
    }

    function setMaxUtilizationBips(uint256 _bips) external onlyOwner {
        maxUtilizationBips = _bips;
        emit ParamsUpdated();
    }

    function setClaimGrace(uint64 _grace) external onlyOwner {
        claimGrace = _grace;
        emit ParamsUpdated();
    }

    function setFeedIds(bytes21 _xrpUsd, bytes21 _flrUsd) external onlyOwner {
        xrpUsdFeedId = _xrpUsd;
        flrUsdFeedId = _flrUsd;
        emit ParamsUpdated();
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Backstop: zero owner");
        owner = newOwner;
    }
}
