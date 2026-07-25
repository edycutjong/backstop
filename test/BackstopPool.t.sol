// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {BackstopPool} from "../src/BackstopPool.sol";

/// @notice Unit tests for the FDC-independent underwriting pool (runnable pre-gate).
///         This test contract plays the role of `backstop` for exposure/payout calls.
contract BackstopPoolTest is Test {
    BackstopPool internal pool;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal agent = address(0xA6E27);
    address internal redeemer = address(0xDEAD);

    function setUp() public {
        pool = new BackstopPool();
        pool.setBackstop(address(this)); // this test acts as the Backstop core
    }

    receive() external payable {}

    function test_setBackstop_onlyOnce() public {
        vm.expectRevert(bytes("BackstopPool: backstop set"));
        pool.setBackstop(address(0x1234));
    }

    function test_deposit_firstMintsOneToOne() public {
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        uint256 minted = pool.deposit{value: 4 ether}();
        assertEq(minted, 4 ether);
        assertEq(pool.totalShares(), 4 ether);
        assertEq(pool.shares(alice), 4 ether);
    }

    function test_deposit_secondIsProportional() public {
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.prank(alice);
        pool.deposit{value: 4 ether}();
        vm.prank(bob);
        uint256 minted = pool.deposit{value: 2 ether}();
        // pool had 4 ether / 4e18 shares; bob adds 2 ether → 2e18 shares
        assertEq(minted, 2 ether);
        assertEq(pool.totalShares(), 6 ether);
    }

    function test_fund_accruesYieldToLPs() public {
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        pool.deposit{value: 4 ether}();

        // premium accrual: +2 ether, no new shares
        pool.fund{value: 2 ether}();
        assertEq(pool.totalShares(), 4 ether);

        // alice now owns 100% of a 6-ether pool
        uint256 balBefore = alice.balance;
        vm.prank(alice);
        uint256 out = pool.withdraw(4 ether);
        assertEq(out, 6 ether);
        assertEq(alice.balance, balBefore + 6 ether);
    }

    function test_lockExposure_enforcesAgentCap() public {
        pool.lockExposure(agent, 60_000e18, 100_000e18);
        assertEq(pool.exposureUsd(agent), 60_000e18);

        vm.expectRevert(bytes("BackstopPool: agent cap exceeded"));
        pool.lockExposure(agent, 50_000e18, 100_000e18);
    }

    function test_releaseExposure_clampsAtZero() public {
        pool.lockExposure(agent, 10_000e18, 100_000e18);
        pool.releaseExposure(agent, 25_000e18); // over-release
        assertEq(pool.exposureUsd(agent), 0);
    }

    function test_payout_paysAndReducesBalance() public {
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        pool.deposit{value: 5 ether}();

        uint256 rBefore = redeemer.balance;
        pool.payout(redeemer, 3 ether);
        assertEq(redeemer.balance, rBefore + 3 ether);
        assertEq(address(pool).balance, 2 ether);
    }

    function test_payout_revertsWhenInsolvent() public {
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        pool.deposit{value: 1 ether}();

        vm.expectRevert(bytes("BackstopPool: insolvent"));
        pool.payout(redeemer, 2 ether);
    }

    function test_onlyBackstop_guards() public {
        vm.prank(bob);
        vm.expectRevert(bytes("BackstopPool: not backstop"));
        pool.payout(redeemer, 0);
    }

    function test_payout_dilutesLPsAsInsuranceRisk() public {
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        pool.deposit{value: 10 ether}();

        // a claim pays out 4 ether → remaining LP value drops
        pool.payout(redeemer, 4 ether);

        vm.prank(alice);
        uint256 out = pool.withdraw(10 ether);
        assertEq(out, 6 ether); // LP absorbed the 4-ether claim
    }
}
