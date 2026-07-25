// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {PremiumMath} from "../src/PremiumMath.sol";

/// @dev External wrapper so `vm.expectRevert` sees library reverts across a call boundary
///      (internal library calls are inlined into the caller otherwise).
contract PremiumMathHarness {
    function usdToNative(uint256 usd, uint256 price, int8 decimals) external pure returns (uint256) {
        return PremiumMath.usdToNative(usd, price, decimals);
    }

    function nativeToUsd(uint256 flrWei, uint256 price, int8 decimals) external pure returns (uint256) {
        return PremiumMath.nativeToUsd(flrWei, price, decimals);
    }
}

/// @notice Unit tests for the FDC-independent pricing math (runnable pre-gate).
contract PremiumMathTest is Test {
    PremiumMathHarness internal harness;

    function setUp() public {
        harness = new PremiumMathHarness();
    }

    function test_premium_linearModel() public pure {
        // coverage 1000e18, base 1% (100bips), k 50bips, sigma 2000bips
        // rate = 100 + (50*2000)/10000 = 100 + 10 = 110 bips = 1.10%
        uint256 p = PremiumMath.premium(1000e18, 100, 50, 2000);
        assertEq(p, (1000e18 * 110) / 10_000);
        assertEq(p, 11e18);
    }

    function test_premium_zeroVolatility_isBaseOnly() public pure {
        uint256 p = PremiumMath.premium(500e18, 200, 999, 0);
        assertEq(p, (500e18 * 200) / 10_000); // 2% of 500 = 10
        assertEq(p, 10e18);
    }

    function test_usdToNative_roundTrip() public pure {
        // FLR/USD = 0.025 with 7 decimals → value = 250000, decimals = 7
        uint256 value = 250_000;
        int8 decimals = 7;
        uint256 usd = 100e18; // $100
        uint256 flr = PremiumMath.usdToNative(usd, value, decimals);
        // $100 / $0.025 = 4000 FLR
        assertEq(flr, 4000e18);
        // native → usd should recover the input
        uint256 back = PremiumMath.nativeToUsd(flr, value, decimals);
        assertEq(back, usd);
    }

    function test_usdToNative_revertsOnZeroPrice() public {
        vm.expectRevert(bytes("PremiumMath: bad price"));
        harness.usdToNative(1e18, 0, 7);
    }

    function test_usdToNative_revertsOnNegDecimals() public {
        vm.expectRevert(bytes("PremiumMath: neg decimals"));
        harness.usdToNative(1e18, 100, -1);
    }

    function test_nativeToUsd_revertsOnZeroPrice() public {
        vm.expectRevert(bytes("PremiumMath: bad price"));
        harness.nativeToUsd(1e18, 0, 7);
    }

    function test_nativeToUsd_revertsOnNegDecimals() public {
        vm.expectRevert(bytes("PremiumMath: neg decimals"));
        harness.nativeToUsd(1e18, 100, -1);
    }

    function testFuzz_premium_monotonicInCoverage(uint128 a, uint128 b) public pure {
        vm.assume(a < b);
        uint256 pa = PremiumMath.premium(a, 100, 50, 2000);
        uint256 pb = PremiumMath.premium(b, 100, 50, 2000);
        assertLe(pa, pb);
    }
}
