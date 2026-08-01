// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title BackstopPool
 * @notice Underwriting pool for Backstop. Liquidity providers deposit native FLR
 *         and receive proportional shares; guard premiums accrue to the pool as
 *         yield; Backstop draws make-whole payouts from it on a proven default.
 *
 * @dev FDC-INDEPENDENT by design. This contract knows nothing about the claim
 *      trigger — it only enforces per-agent exposure caps and pays out on
 *      Backstop's authority. It therefore survives the Day-4 FDC go/no-go gate
 *      unchanged and is reused verbatim under the FAsset Guardian pivot
 *      (specs/BUILD_LOG.md, option B). Share price = balance / totalShares, so a
 *      payout dilutes LPs — that is the insurance risk, made explicit on-chain.
 *
 * Invariants (see specs/ARCHITECTURE.md §invariants):
 *  - Only `backstop` may lock/release exposure or pay out.
 *  - `Σ exposure[agent] ≤ agentCap` (cap passed per-lock by Backstop).
 *  - A payout can never exceed the pool balance (reverts as insolvent).
 */
contract BackstopPool {
    address public immutable owner;
    address public backstop;

    // Non-reentrancy lock (1 = unlocked, 2 = entered) — guards the value-moving flows.
    uint256 private _entered = 1;

    uint256 public totalShares;
    mapping(address => uint256) public shares;

    /// @notice Locked coverage per FAsset agent vault, denominated in USD (1e18).
    mapping(address => uint256) public exposureUsd;

    event Deposited(address indexed lp, uint256 flr, uint256 sharesMinted);
    event Withdrawn(address indexed lp, uint256 flr, uint256 sharesBurned);
    event Funded(address indexed from, uint256 flr);
    event Paid(address indexed to, uint256 flr);
    event BackstopSet(address indexed backstop);

    modifier onlyOwner() {
        require(msg.sender == owner, "BackstopPool: not owner");
        _;
    }

    modifier onlyBackstop() {
        require(msg.sender == backstop, "BackstopPool: not backstop");
        _;
    }

    modifier nonReentrant() {
        require(_entered == 1, "BackstopPool: reentrant");
        _entered = 2;
        _;
        _entered = 1;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Wire the Backstop core exactly once.
    function setBackstop(address newBackstop) external onlyOwner {
        require(backstop == address(0), "BackstopPool: backstop set");
        require(newBackstop != address(0), "BackstopPool: zero backstop");
        backstop = newBackstop;
        emit BackstopSet(newBackstop);
    }

    // ── Liquidity provision ────────────────────────────────────────────────

    /// @notice Deposit native FLR and mint shares proportional to the pool.
    function deposit() external payable returns (uint256 minted) {
        require(msg.value > 0, "BackstopPool: zero deposit");
        uint256 balBefore = address(this).balance - msg.value;
        // slither-disable-next-line incorrect-equality -- first-deposit / empty-pool bootstrap; exact-zero is the intended branch
        if (totalShares == 0 || balBefore == 0) {
            minted = msg.value;
        } else {
            minted = (msg.value * totalShares) / balBefore;
        }
        require(minted > 0, "BackstopPool: zero shares");
        shares[msg.sender] += minted;
        totalShares += minted;
        emit Deposited(msg.sender, msg.value, minted);
    }

    /// @notice Burn shares and withdraw the proportional FLR (including accrued premiums).
    function withdraw(uint256 sharesToBurn) external nonReentrant returns (uint256 amount) {
        require(sharesToBurn > 0 && shares[msg.sender] >= sharesToBurn, "BackstopPool: bad shares");
        amount = (sharesToBurn * address(this).balance) / totalShares;
        shares[msg.sender] -= sharesToBurn;
        totalShares -= sharesToBurn;
        emit Withdrawn(msg.sender, amount, sharesToBurn);
        // slither-disable-next-line low-level-calls -- native FLR withdrawal requires a raw call; guarded by nonReentrant + CEI above
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "BackstopPool: withdraw xfer failed");
    }

    /// @notice Add FLR to the pool WITHOUT minting shares (guard premium accrual).
    function fund() external payable {
        emit Funded(msg.sender, msg.value);
    }

    /// @notice Current share price scaled to 1e18 (FLR wei per share).
    function sharePrice() external view returns (uint256) {
        // slither-disable-next-line incorrect-equality -- empty-pool guard; exact-zero is the intended branch
        if (totalShares == 0) return 1e18;
        return (address(this).balance * 1e18) / totalShares;
    }

    // ── Backstop-only exposure + payout ────────────────────────────────────

    function lockExposure(address agent, uint256 amountUsd, uint256 capUsd) external onlyBackstop {
        uint256 next = exposureUsd[agent] + amountUsd;
        require(next <= capUsd, "BackstopPool: agent cap exceeded");
        exposureUsd[agent] = next;
    }

    function releaseExposure(address agent, uint256 amountUsd) external onlyBackstop {
        uint256 cur = exposureUsd[agent];
        exposureUsd[agent] = amountUsd >= cur ? 0 : cur - amountUsd;
    }

    function payout(address to, uint256 amountFlr) external onlyBackstop nonReentrant {
        require(to != address(0), "BackstopPool: zero payout");
        require(amountFlr <= address(this).balance, "BackstopPool: insolvent");
        emit Paid(to, amountFlr);
        // slither-disable-next-line low-level-calls -- native FLR payout requires a raw call; guarded by nonReentrant + onlyBackstop
        (bool ok,) = to.call{value: amountFlr}("");
        require(ok, "BackstopPool: payout failed");
    }

    /// @notice Accept direct funding (e.g. premium forwarded from Backstop).
    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }
}
