// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {BackstopPool} from "../src/BackstopPool.sol";

/// @notice Contract that rejects incoming FLR — used to force the failed-transfer
///         branches in `withdraw` (self-send back) and `payout` (send to `to`).
///         It can still call `deposit`/`withdraw` because those forward value out.
contract BpRejector {
    receive() external payable {
        revert("BpRejector: no ETH");
    }

    function doDeposit(BackstopPool p) external payable returns (uint256) {
        return p.deposit{value: msg.value}();
    }

    function doWithdraw(BackstopPool p, uint256 s) external returns (uint256) {
        return p.withdraw(s);
    }
}

/// @notice LP that RE-ENTERS withdraw when it receives its FLR, to exercise the
///         nonReentrant guard's revert branch.
contract BpReentrant {
    BackstopPool internal pool;
    uint256 internal myShares;

    constructor(BackstopPool p) {
        pool = p;
    }

    function doDeposit() external payable {
        myShares = pool.deposit{value: msg.value}();
    }

    function doWithdraw() external {
        pool.withdraw(myShares);
    }

    receive() external payable {
        pool.withdraw(1); // re-entry hits `require(_entered == 1)` → "BackstopPool: reentrant"
    }
}

/// @notice Edge/branch coverage for BackstopPool — every revert guard, both
///         sharePrice branches, and the receive() funding path. Complements the
///         happy-path unit suite in BackstopPool.t.sol.
contract BackstopPoolEdgeTest is Test {
    BackstopPool internal pool;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal agent = address(0xA6E27);

    function setUp() public {
        pool = new BackstopPool();
        pool.setBackstop(address(this)); // this test acts as the Backstop core
    }

    receive() external payable {}

    // ── setBackstop guards ──────────────────────────────────────────────────

    function test_setBackstop_onlyOwner_reverts() public {
        BackstopPool fresh = new BackstopPool();
        vm.prank(bob); // not the owner
        vm.expectRevert(bytes("BackstopPool: not owner"));
        fresh.setBackstop(address(0x1234));
    }

    function test_setBackstop_rejectsZeroAddress() public {
        BackstopPool fresh = new BackstopPool();
        vm.expectRevert(bytes("BackstopPool: zero backstop"));
        fresh.setBackstop(address(0));
    }

    function test_setBackstop_wiresOnce() public {
        BackstopPool fresh = new BackstopPool();
        fresh.setBackstop(address(0xBEEF));
        assertEq(fresh.backstop(), address(0xBEEF));
    }

    // ── deposit guards ──────────────────────────────────────────────────────

    function test_deposit_rejectsZeroValue() public {
        vm.expectRevert(bytes("BackstopPool: zero deposit"));
        pool.deposit{value: 0}();
    }

    /// @notice Dust deposit into a heavily diluted pool mints 0 shares → reverts.
    function test_deposit_rejectsZeroShares() public {
        // Seed 1 wei → totalShares == 1, balance == 1.
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        pool.deposit{value: 1}();
        // Inflate balance without minting shares → share price explodes.
        pool.fund{value: 100 ether}();
        // Now a 1-wei deposit rounds down to 0 shares: (1 * 1) / (100e18 + 1) == 0.
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert(bytes("BackstopPool: zero shares"));
        pool.deposit{value: 1}();
    }

    // ── withdraw guards ─────────────────────────────────────────────────────

    function test_withdraw_rejectsZeroShares() public {
        vm.expectRevert(bytes("BackstopPool: bad shares"));
        pool.withdraw(0);
    }

    function test_withdraw_rejectsMoreThanOwned() public {
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        pool.deposit{value: 2 ether}();
        vm.prank(alice);
        vm.expectRevert(bytes("BackstopPool: bad shares"));
        pool.withdraw(3 ether); // owns 2e18 shares, tries to burn 3e18
    }

    function test_withdraw_revertsOnFailedTransfer() public {
        BpRejector lp = new BpRejector();
        vm.deal(address(lp), 5 ether);
        uint256 minted = lp.doDeposit{value: 4 ether}(pool);
        // Withdrawal sends FLR back to lp, whose receive() reverts → "xfer failed".
        vm.expectRevert(bytes("BackstopPool: withdraw xfer failed"));
        lp.doWithdraw(pool, minted);
    }

    // ── fund / receive funding paths ────────────────────────────────────────

    function test_fund_explicitCall() public {
        pool.fund{value: 3 ether}();
        assertEq(address(pool).balance, 3 ether);
        assertEq(pool.totalShares(), 0); // no shares minted
    }

    function test_receive_fallbackFunds() public {
        vm.deal(alice, 5 ether);
        vm.prank(alice);
        (bool ok,) = address(pool).call{value: 2 ether}(""); // hits receive()
        assertTrue(ok);
        assertEq(address(pool).balance, 2 ether);
        assertEq(pool.totalShares(), 0);
    }

    // ── sharePrice both branches ────────────────────────────────────────────

    function test_sharePrice_emptyPoolIsUnit() public view {
        assertEq(pool.sharePrice(), 1e18); // totalShares == 0 branch
    }

    function test_sharePrice_reflectsAccruedYield() public {
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        pool.deposit{value: 4 ether}(); // 4e18 shares, 4 ether balance → price 1e18
        assertEq(pool.sharePrice(), 1e18);
        pool.fund{value: 4 ether}(); // balance 8 ether, shares 4e18 → price 2e18
        assertEq(pool.sharePrice(), 2e18);
    }

    // ── onlyBackstop guards on exposure calls ───────────────────────────────

    function test_lockExposure_onlyBackstop() public {
        vm.prank(bob);
        vm.expectRevert(bytes("BackstopPool: not backstop"));
        pool.lockExposure(agent, 1, 100);
    }

    function test_releaseExposure_onlyBackstop() public {
        vm.prank(bob);
        vm.expectRevert(bytes("BackstopPool: not backstop"));
        pool.releaseExposure(agent, 1);
    }

    // ── payout failure branch ───────────────────────────────────────────────

    function test_payout_revertsWhenRecipientRejects() public {
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        pool.deposit{value: 5 ether}();

        BpRejector sink = new BpRejector(); // receive() reverts
        vm.expectRevert(bytes("BackstopPool: payout failed"));
        pool.payout(address(sink), 1 ether);
    }

    function test_payout_rejectsZeroAddress() public {
        // This test contract is the wired backstop, so it can call payout directly.
        vm.expectRevert(bytes("BackstopPool: zero payout"));
        pool.payout(address(0), 1 ether);
    }

    // ── nonReentrant guard ──────────────────────────────────────────────────

    function test_withdraw_nonReentrant() public {
        BpReentrant lp = new BpReentrant(pool);
        vm.deal(address(lp), 5 ether);
        lp.doDeposit{value: 4 ether}();
        // Withdrawal sends FLR to lp, whose receive() re-enters withdraw → the inner
        // call trips the nonReentrant guard, so the outer transfer fails.
        vm.expectRevert(bytes("BackstopPool: withdraw xfer failed"));
        lp.doWithdraw();
    }
}
