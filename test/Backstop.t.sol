// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// Unit tests exercise Backstop's OWN logic (guard lifecycle, pricing wiring, access
// control, proof field-binding) using MOCK Flare contracts. They do NOT prove the Flare
// integration: the real FDC ReferencedPaymentNonexistence round-trip and FTSO/AssetManager
// reads are proven on-chain at the Day-4 spike (scripts/spike.ts) + Coston2 deploy, never here.

import {Test} from "forge-std/Test.sol";
import {Backstop} from "../src/Backstop.sol";
import {BackstopPool} from "../src/BackstopPool.sol";
import {IFlareContractRegistry} from "flare-periphery/src/coston2/IFlareContractRegistry.sol";
import {IReferencedPaymentNonexistence} from "flare-periphery/src/coston2/IReferencedPaymentNonexistence.sol";
import {RedemptionRequestInfo} from "flare-periphery/src/coston2/data/RedemptionRequestInfo.sol";

// ── Mock Flare contracts (only the methods Backstop calls, exact signatures) ──────────

contract BsMockFtso {
    mapping(bytes21 => uint256) internal _val;
    mapping(bytes21 => int8) internal _dec;

    function setFeed(bytes21 id, uint256 v, int8 d) external {
        _val[id] = v;
        _dec[id] = d;
    }

    function getFeedById(bytes21 id) external payable returns (uint256, int8, uint64) {
        return (_val[id], _dec[id], uint64(block.timestamp));
    }
}

contract BsMockAssetManager {
    RedemptionRequestInfo.Data internal _data;

    function setData(RedemptionRequestInfo.Data memory d) external {
        _data = d;
    }

    function redemptionRequestInfo(uint256) external view returns (RedemptionRequestInfo.Data memory) {
        return _data;
    }
}

contract BsMockFdc {
    bool internal _result;

    function setResult(bool r) external {
        _result = r;
    }

    function verifyReferencedPaymentNonexistence(IReferencedPaymentNonexistence.Proof calldata)
        external
        view
        returns (bool)
    {
        return _result;
    }
}

/// @dev A redeemer that rejects the overpayment refund, to hit the "refund failed" branch.
contract BsRejector {
    Backstop internal bs;

    constructor(Backstop _bs) {
        bs = _bs;
    }

    function buy(uint256 reqId, uint256 cov) external payable returns (uint256) {
        return bs.buyGuard{value: msg.value}(reqId, cov);
    }

    receive() external payable {
        revert("BsRejector: no refund");
    }
}

/// @dev A redeemer that RE-ENTERS buyGuard when it receives the refund, to exercise
///      the nonReentrant guard's revert branch.
contract BsReentrant {
    Backstop internal bs;
    bool public reentryRejected;

    constructor(Backstop _bs) {
        bs = _bs;
    }

    function buy(uint256 reqId, uint256 cov) external payable returns (uint256) {
        return bs.buyGuard{value: msg.value}(reqId, cov);
    }

    receive() external payable {
        // Re-enter buyGuard during the refund. The nonReentrant guard rejects it; we
        // catch so the refund succeeds and the outer buyGuard completes normally.
        try bs.buyGuard{value: 0}(1, 1) returns (uint256) {}
        catch {
            reentryRejected = true;
        }
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────────────

contract BackstopTest is Test {
    address internal constant REGISTRY = 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019;
    bytes21 internal constant XRP_USD = 0x015852502f55534400000000000000000000000000;
    bytes21 internal constant FLR_USD = 0x01464c522f55534400000000000000000000000000;

    Backstop internal backstop;
    BackstopPool internal pool;
    BsMockFtso internal ftso;
    BsMockAssetManager internal am;
    BsMockFdc internal fdc;

    address internal owner = address(this);
    address internal redeemer = makeAddr("redeemer");
    address internal agentVault = makeAddr("agentVault");
    address internal lp = makeAddr("lp");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant TICKET_REF = keccak256("redemption-ref-1");
    uint128 internal constant VALUE_UBA = 100_000_000; // 100 XRP in drops (1e6)
    uint64 internal deadlineTs;

    function setUp() public {
        pool = new BackstopPool();
        backstop = new Backstop(pool);
        pool.setBackstop(address(backstop));

        ftso = new BsMockFtso();
        am = new BsMockAssetManager();
        fdc = new BsMockFdc();

        _mockRegistry("FtsoV2", address(ftso));
        _mockRegistry("AssetManagerFXRP", address(am));
        _mockRegistry("FdcVerification", address(fdc));

        // XRP/USD = $2.00 (7 dp); FLR/USD = $0.025 (7 dp).
        ftso.setFeed(XRP_USD, 20_000_000, 7);
        ftso.setFeed(FLR_USD, 250_000, 7);

        deadlineTs = uint64(block.timestamp + 1 days);
        _setRedemption(RedemptionRequestInfo.Status.ACTIVE, redeemer);

        vm.deal(lp, 100_000 ether);
        vm.prank(lp);
        pool.deposit{value: 50_000 ether}();
    }

    function _mockRegistry(string memory name, address resolved) internal {
        vm.mockCall(
            REGISTRY,
            abi.encodeWithSelector(IFlareContractRegistry.getContractAddressByName.selector, name),
            abi.encode(resolved)
        );
    }

    function _setRedemption(RedemptionRequestInfo.Status status, address who) internal {
        RedemptionRequestInfo.Data memory d;
        d.redemptionRequestId = 1;
        d.status = status;
        d.agentVault = agentVault;
        d.redeemer = who;
        d.paymentAddress = "rXRPLdestination";
        d.paymentReference = TICKET_REF;
        d.valueUBA = VALUE_UBA;
        d.lastUnderlyingTimestamp = deadlineTs;
        am.setData(d);
    }

    function _proof(bytes32 ref, uint256 amount, uint64 dTs)
        internal
        pure
        returns (IReferencedPaymentNonexistence.Proof memory p)
    {
        IReferencedPaymentNonexistence.RequestBody memory rb = IReferencedPaymentNonexistence.RequestBody({
            minimalBlockNumber: 0,
            deadlineBlockNumber: 0,
            deadlineTimestamp: dTs,
            destinationAddressHash: bytes32(0),
            amount: amount,
            standardPaymentReference: ref,
            checkSourceAddresses: false,
            sourceAddressesRoot: bytes32(0)
        });
        IReferencedPaymentNonexistence.ResponseBody memory rsb = IReferencedPaymentNonexistence.ResponseBody({
            minimalBlockTimestamp: 0, firstOverflowBlockNumber: 0, firstOverflowBlockTimestamp: 0
        });
        IReferencedPaymentNonexistence.Response memory resp = IReferencedPaymentNonexistence.Response({
            attestationType: bytes32(0),
            sourceId: bytes32(0),
            votingRound: 0,
            lowestUsedTimestamp: 0,
            requestBody: rb,
            responseBody: rsb
        });
        p = IReferencedPaymentNonexistence.Proof({merkleProof: new bytes32[](0), data: resp});
    }

    function _buyDefaultGuard() internal returns (uint256 guardId) {
        uint256 premium = backstop.quotePremiumFlr(100e18);
        vm.deal(redeemer, premium);
        vm.prank(redeemer);
        guardId = backstop.buyGuard{value: premium}(1, 100e18);
    }

    // ── constructor / pricing ────────────────────────────────────────────────

    function test_constructor_setsOwnerAndPool() public view {
        assertEq(backstop.owner(), owner);
        assertEq(address(backstop.pool()), address(pool));
    }

    function test_expectedUsd_fromXrpFeed() public {
        // 100 XRP * $2 = $200
        assertEq(backstop.expectedUsd(VALUE_UBA), 200e18);
    }

    function test_expectedUsd_revertsOnNegDecimals() public {
        ftso.setFeed(XRP_USD, 20_000_000, -1);
        vm.expectRevert(bytes("Backstop: neg decimals"));
        backstop.expectedUsd(VALUE_UBA);
    }

    function test_price_revertsOnZeroFeed() public {
        ftso.setFeed(FLR_USD, 0, 7);
        vm.expectRevert(bytes("Backstop: bad feed"));
        backstop.usdToFlr(1e18);
    }

    function test_quotePremium_usdAndFlr() public {
        // premium = 100 * (100 + 50*2000/10000)/10000 bips = 1.1% => $1.10
        assertEq(backstop.quotePremiumUsd(100e18), 11e17);
        // $1.10 / $0.025 = 44 FLR
        assertEq(backstop.quotePremiumFlr(100e18), 44e18);
    }

    function test_usdToFlr() public {
        assertEq(backstop.usdToFlr(100e18), 4000e18); // $100 / $0.025
    }

    // ── buyGuard ─────────────────────────────────────────────────────────────

    function test_buyGuard_success() public {
        uint256 guardId = _buyDefaultGuard();
        assertEq(guardId, 1);
        (
            address gRedeemer,
            address gAgent,
            uint256 gReqId,
            bytes32 gRef,
            uint256 gExpected,
            uint64 gDeadline,
            uint256 gCoverage,
            uint256 gPremium,
            Backstop.Status gStatus
        ) = backstop.guards(1);
        assertEq(gRedeemer, redeemer);
        assertEq(gAgent, agentVault);
        assertEq(gReqId, 1);
        assertEq(gRef, TICKET_REF);
        assertEq(gExpected, VALUE_UBA);
        assertEq(gDeadline, deadlineTs);
        assertEq(gCoverage, 100e18);
        assertEq(gPremium, 44e18);
        assertEq(uint256(gStatus), uint256(Backstop.Status.ACTIVE));
        assertEq(pool.exposureUsd(agentVault), 100e18);
    }

    function test_buyGuard_refundsOverpayment() public {
        uint256 premium = backstop.quotePremiumFlr(100e18);
        vm.deal(redeemer, premium + 5 ether);
        vm.prank(redeemer);
        backstop.buyGuard{value: premium + 5 ether}(1, 100e18);
        assertEq(redeemer.balance, 5 ether); // overpayment returned
    }

    function test_buyGuard_revertsRefundFailed() public {
        BsRejector rej = new BsRejector(backstop);
        _setRedemption(RedemptionRequestInfo.Status.ACTIVE, address(rej));
        uint256 premium = backstop.quotePremiumFlr(100e18);
        vm.deal(address(rej), premium + 1 ether);
        vm.expectRevert(bytes("Backstop: refund failed"));
        rej.buy{value: premium + 1 ether}(1, 100e18);
    }

    function test_buyGuard_nonReentrant() public {
        BsReentrant att = new BsReentrant(backstop);
        _setRedemption(RedemptionRequestInfo.Status.ACTIVE, address(att));
        uint256 premium = backstop.quotePremiumFlr(100e18);
        vm.deal(address(att), premium + 1 ether);
        // Overpay so buyGuard refunds → att.receive() re-enters buyGuard; the nonReentrant
        // guard rejects the re-entry (caught), so the outer buyGuard still succeeds.
        att.buy{value: premium + 1 ether}(1, 100e18);
        assertTrue(att.reentryRejected(), "re-entry should have been rejected");
        assertEq(backstop.nextGuardId(), 2); // the outer guard was created
    }

    function test_buyGuard_revertsNotActive() public {
        _setRedemption(RedemptionRequestInfo.Status.SUCCESSFUL, redeemer);
        vm.deal(redeemer, 100 ether);
        vm.prank(redeemer);
        vm.expectRevert(bytes("Backstop: redemption not active"));
        backstop.buyGuard{value: 100 ether}(1, 100e18);
    }

    function test_buyGuard_revertsNotRedeemer() public {
        vm.deal(stranger, 100 ether);
        vm.prank(stranger);
        vm.expectRevert(bytes("Backstop: not redeemer"));
        backstop.buyGuard{value: 100 ether}(1, 100e18);
    }

    function test_buyGuard_revertsCoverageZero() public {
        vm.deal(redeemer, 100 ether);
        vm.prank(redeemer);
        vm.expectRevert(bytes("Backstop: coverage out of range"));
        backstop.buyGuard{value: 100 ether}(1, 0);
    }

    function test_buyGuard_revertsCoverageTooHigh() public {
        vm.deal(redeemer, 100 ether);
        vm.prank(redeemer);
        vm.expectRevert(bytes("Backstop: coverage out of range"));
        backstop.buyGuard{value: 100 ether}(1, 201e18); // max is $200
    }

    function test_buyGuard_revertsPremiumUnderpaid() public {
        vm.deal(redeemer, 100 ether);
        vm.prank(redeemer);
        vm.expectRevert(bytes("Backstop: premium underpaid"));
        backstop.buyGuard{value: 1}(1, 100e18);
    }

    // ── claim ────────────────────────────────────────────────────────────────

    function test_claim_success_paysRedeemer() public {
        uint256 guardId = _buyDefaultGuard();
        fdc.setResult(true);
        vm.warp(deadlineTs + 1);

        uint256 before = redeemer.balance;
        backstop.claim(guardId, _proof(TICKET_REF, VALUE_UBA, deadlineTs));

        assertEq(redeemer.balance, before + 4000e18); // $100 / $0.025
        (,,,,,,,, Backstop.Status s) = backstop.guards(guardId);
        assertEq(uint256(s), uint256(Backstop.Status.PAID));
        assertEq(pool.exposureUsd(agentVault), 0);
    }

    function test_claim_revertsGuardNotActive() public {
        vm.expectRevert(bytes("Backstop: guard not active"));
        backstop.claim(999, _proof(TICKET_REF, VALUE_UBA, deadlineTs));
    }

    function test_claim_revertsBeforeDeadline() public {
        uint256 guardId = _buyDefaultGuard();
        vm.expectRevert(bytes("Backstop: before deadline"));
        backstop.claim(guardId, _proof(TICKET_REF, VALUE_UBA, deadlineTs));
    }

    function test_claim_revertsInvalidProof() public {
        uint256 guardId = _buyDefaultGuard();
        fdc.setResult(false);
        vm.warp(deadlineTs + 1);
        vm.expectRevert(bytes("Backstop: invalid RPN proof"));
        backstop.claim(guardId, _proof(TICKET_REF, VALUE_UBA, deadlineTs));
    }

    function test_claim_revertsReferenceMismatch() public {
        uint256 guardId = _buyDefaultGuard();
        fdc.setResult(true);
        vm.warp(deadlineTs + 1);
        vm.expectRevert(bytes("Backstop: reference mismatch"));
        backstop.claim(guardId, _proof(keccak256("wrong"), VALUE_UBA, deadlineTs));
    }

    function test_claim_revertsAmountMismatch() public {
        uint256 guardId = _buyDefaultGuard();
        fdc.setResult(true);
        vm.warp(deadlineTs + 1);
        vm.expectRevert(bytes("Backstop: amount mismatch"));
        backstop.claim(guardId, _proof(TICKET_REF, VALUE_UBA - 1, deadlineTs));
    }

    function test_claim_revertsDeadlineMismatch() public {
        uint256 guardId = _buyDefaultGuard();
        fdc.setResult(true);
        vm.warp(deadlineTs + 1);
        vm.expectRevert(bytes("Backstop: deadline mismatch"));
        backstop.claim(guardId, _proof(TICKET_REF, VALUE_UBA, deadlineTs - 1));
    }

    // ── expire ───────────────────────────────────────────────────────────────

    function test_expire_success() public {
        uint256 guardId = _buyDefaultGuard();
        vm.warp(deadlineTs + backstop.claimGrace() + 1);
        backstop.expire(guardId);
        (,,,,,,,, Backstop.Status s) = backstop.guards(guardId);
        assertEq(uint256(s), uint256(Backstop.Status.EXPIRED));
        assertEq(pool.exposureUsd(agentVault), 0);
    }

    function test_expire_revertsGuardNotActive() public {
        vm.expectRevert(bytes("Backstop: guard not active"));
        backstop.expire(999);
    }

    function test_expire_revertsGraceNotPassed() public {
        uint256 guardId = _buyDefaultGuard();
        vm.warp(deadlineTs + 1); // past deadline but not past grace
        vm.expectRevert(bytes("Backstop: grace not passed"));
        backstop.expire(guardId);
    }

    // ── admin ────────────────────────────────────────────────────────────────

    function test_setPricing() public {
        backstop.setPricing(200, 10, 1000);
        assertEq(backstop.baseBips(), 200);
        assertEq(backstop.kBips(), 10);
        assertEq(backstop.sigmaBips(), 1000);
    }

    function test_setPricing_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(bytes("Backstop: not owner"));
        backstop.setPricing(1, 1, 1);
    }

    function test_setAgentCapUsd() public {
        backstop.setAgentCapUsd(1e18);
        assertEq(backstop.agentCapUsd(), 1e18);
    }

    function test_setAgentCapUsd_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(bytes("Backstop: not owner"));
        backstop.setAgentCapUsd(1);
    }

    function test_setClaimGrace() public {
        backstop.setClaimGrace(2 hours);
        assertEq(backstop.claimGrace(), 2 hours);
    }

    function test_setClaimGrace_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(bytes("Backstop: not owner"));
        backstop.setClaimGrace(1);
    }

    function test_setFeedIds() public {
        bytes21 a = bytes21(uint168(1));
        bytes21 b = bytes21(uint168(2));
        backstop.setFeedIds(a, b);
        assertEq(backstop.xrpUsdFeedId(), a);
        assertEq(backstop.flrUsdFeedId(), b);
    }

    function test_setFeedIds_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(bytes("Backstop: not owner"));
        backstop.setFeedIds(bytes21(0), bytes21(0));
    }

    function test_transferOwnership() public {
        backstop.transferOwnership(stranger);
        assertEq(backstop.owner(), stranger);
    }

    function test_transferOwnership_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(bytes("Backstop: not owner"));
        backstop.transferOwnership(stranger);
    }

    function test_transferOwnership_revertsZero() public {
        vm.expectRevert(bytes("Backstop: zero owner"));
        backstop.transferOwnership(address(0));
    }

    // ── global solvency / utilization ────────────────────────────────────────

    function test_flrToUsd() public {
        assertEq(backstop.flrToUsd(4000e18), 100e18); // 4000 FLR * $0.025
    }

    function test_poolValueUsd() public {
        assertEq(backstop.poolValueUsd(), 1250e18); // 50,000 FLR * $0.025
    }

    function test_utilizationBips_tracksCoverage() public {
        assertEq(backstop.utilizationBips(), 0);
        _buyDefaultGuard(); // $100 coverage; the $1.10 premium accrues to the pool → $1,251.1
        assertEq(backstop.totalActiveCoverageUsd(), 100e18);
        assertEq(backstop.utilizationBips(), 799); // 100 / 1251.1 = 7.99% = 799 bips
    }

    function test_utilizationBips_emptyPoolIsZero() public {
        BackstopPool p2 = new BackstopPool();
        Backstop b2 = new Backstop(p2);
        p2.setBackstop(address(b2));
        assertEq(b2.poolValueUsd(), 0);
        assertEq(b2.utilizationBips(), 0);
    }

    function test_buyGuard_incrementsTotalCoverage() public {
        _buyDefaultGuard();
        assertEq(backstop.totalActiveCoverageUsd(), 100e18);
    }

    function test_claim_decrementsTotalCoverage() public {
        uint256 g = _buyDefaultGuard();
        fdc.setResult(true);
        vm.warp(deadlineTs + 1);
        backstop.claim(g, _proof(TICKET_REF, VALUE_UBA, deadlineTs));
        assertEq(backstop.totalActiveCoverageUsd(), 0);
    }

    function test_expire_decrementsTotalCoverage() public {
        uint256 g = _buyDefaultGuard();
        vm.warp(deadlineTs + backstop.claimGrace() + 1);
        backstop.expire(g);
        assertEq(backstop.totalActiveCoverageUsd(), 0);
    }

    function test_buyGuard_revertsOverUtilized() public {
        backstop.setMaxUtilizationBips(1); // 0.01% — forces over-utilization
        uint256 premium = backstop.quotePremiumFlr(100e18);
        vm.deal(redeemer, premium);
        vm.prank(redeemer);
        vm.expectRevert(bytes("Backstop: pool over-utilized"));
        backstop.buyGuard{value: premium}(1, 100e18);
    }

    function test_setMaxUtilizationBips() public {
        backstop.setMaxUtilizationBips(5000);
        assertEq(backstop.maxUtilizationBips(), 5000);
    }

    function test_setMaxUtilizationBips_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(bytes("Backstop: not owner"));
        backstop.setMaxUtilizationBips(1);
    }
}
