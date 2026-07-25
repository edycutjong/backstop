// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title PremiumMath
 * @notice Pure pricing math for Backstop guards — premium sizing and USD<->native
 *         conversion from an FTSO v2 price read.
 *
 * @dev This library is deliberately FDC-independent: it survives the Day-4 FDC
 *      go/no-go gate unchanged and is reused as-is under the FAsset Guardian
 *      pivot (see specs/BUILD_LOG.md, option B). The premium model is a linear
 *      `base + k * sigma` — an honest MVP simplification (SPONSOR_DEFENSE §3),
 *      not a full actuarial engine.
 */
library PremiumMath {
    uint256 internal constant BIPS = 10_000;

    /**
     * @notice Linear premium: `coverage * (baseBips + kBips*sigmaBips/BIPS) / BIPS`.
     * @param coverage   Coverage amount (any 1e18-scaled unit; returned premium matches).
     * @param baseBips   Flat base rate in basis points.
     * @param kBips       Slope applied to volatility, in basis points.
     * @param sigmaBips  Assumed volatility of the underlying, in basis points.
     */
    function premium(uint256 coverage, uint256 baseBips, uint256 kBips, uint256 sigmaBips)
        internal
        pure
        returns (uint256)
    {
        uint256 rateBips = baseBips + (kBips * sigmaBips) / BIPS;
        return (coverage * rateBips) / BIPS;
    }

    /**
     * @notice Convert a USD amount (1e18) to native FLR wei using an FTSO FLR/USD read.
     * @dev usdPerFlr = value / 10**decimals ⇒ flr = usdAmount / usdPerFlr.
     * @param usdAmount1e18 USD amount, 18 decimals.
     * @param price         FTSO feed value for FLR/USD.
     * @param decimals      FTSO feed decimals (must be >= 0 for a USD price feed).
     */
    function usdToNative(uint256 usdAmount1e18, uint256 price, int8 decimals) internal pure returns (uint256) {
        require(price > 0, "PremiumMath: bad price");
        require(decimals >= 0, "PremiumMath: neg decimals");
        return (usdAmount1e18 * (10 ** uint256(uint8(decimals)))) / price;
    }

    /**
     * @notice Convert native FLR wei to a USD amount (1e18) using an FTSO FLR/USD read.
     */
    function nativeToUsd(uint256 flrWei, uint256 price, int8 decimals) internal pure returns (uint256) {
        require(price > 0, "PremiumMath: bad price");
        require(decimals >= 0, "PremiumMath: neg decimals");
        return (flrWei * price) / (10 ** uint256(uint8(decimals)));
    }
}
