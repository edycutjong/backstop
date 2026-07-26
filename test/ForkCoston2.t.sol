// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {Backstop} from "../src/Backstop.sol";
import {BackstopPool} from "../src/BackstopPool.sol";
import {RegistryResolver} from "../src/RegistryResolver.sol";
import {IAssetManager} from "flare-periphery/src/coston2/IAssetManager.sol";

/**
 * @notice Integration tests against a LIVE Coston2 fork — they exercise the REAL Flare
 *         contracts (registry, FTSO v2, FAssets AssetManager) that the unit tests mock.
 *         This closes the "read paths only proven against mocks" gap.
 *
 * @dev Skipped automatically when `COSTON2_RPC_URL` is unset, so offline `forge test`
 *      and CI still pass with 0 network. Run locally (`.env` provides the RPC) or in a
 *      fork-enabled CI job. The load-bearing FDC verify itself is proven live by the
 *      Day-4 spike (scripts/spike.ts) + keeper; here we prove the on-chain read wiring.
 */
contract ForkResolverHarness {
    function assetManagerFXRP() external view returns (address) {
        return address(RegistryResolver.assetManagerFXRP());
    }

    function fdcVerification() external view returns (address) {
        return address(RegistryResolver.fdcVerification());
    }

    function ftsoV2() external view returns (address) {
        return address(RegistryResolver.ftsoV2());
    }
}

contract ForkCoston2Test is Test {
    bool internal forkOk;
    Backstop internal backstop;
    BackstopPool internal pool;
    ForkResolverHarness internal rr;

    function setUp() public {
        string memory rpc = vm.envOr("COSTON2_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            forkOk = false;
            return;
        }
        vm.createSelectFork(rpc);
        forkOk = true;
        pool = new BackstopPool();
        backstop = new Backstop(pool);
        rr = new ForkResolverHarness();
    }

    modifier onFork() {
        if (!forkOk) {
            vm.skip(true);
            return;
        }
        _;
    }

    /// Registry resolves to the real, verified Coston2 addresses (no mock).
    function test_fork_registryResolvesRealAddresses() public onFork {
        assertEq(rr.assetManagerFXRP(), 0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA, "AssetManagerFXRP");
        assertEq(rr.fdcVerification(), 0x906507E0B64bcD494Db73bd0459d1C667e14B933, "FdcVerification");
        assertEq(rr.ftsoV2(), 0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d, "FtsoV2");
        assertGt(rr.assetManagerFXRP().code.length, 0, "AM has code");
        assertGt(rr.fdcVerification().code.length, 0, "FDC has code");
        assertGt(rr.ftsoV2().code.length, 0, "FTSO has code");
    }

    /// Pricing path reads the LIVE FtsoV2 oracle — sane, non-zero values.
    function test_fork_livePricingFromFtso() public onFork {
        // 100 XRP (drops, 6dp). Live XRP/USD is ~$0.5–$5 → expected value $50–$500.
        uint256 usd = backstop.expectedUsd(100_000_000);
        assertGt(usd, 10e18, "expectedUsd floor");
        assertLt(usd, 10_000e18, "expectedUsd ceiling");

        // Premium for $100 coverage, in FLR, must be > 0 (FLR/USD read succeeded).
        uint256 premFlr = backstop.quotePremiumFlr(100e18);
        assertGt(premFlr, 0, "premium > 0");

        // $100 → FLR at live FLR/USD (~$0.005–$0.5) lands in 200–20,000 FLR.
        uint256 flr = backstop.usdToFlr(100e18);
        assertGt(flr, 10e18, "usdToFlr floor");
        assertLt(flr, 1_000_000e18, "usdToFlr ceiling");
    }

    /// Live FAssets AssetManager read — the FXRP fAsset token is real, with code.
    function test_fork_liveAssetManagerRead() public onFork {
        IAssetManager am = IAssetManager(rr.assetManagerFXRP());
        address fxrp = address(am.fAsset());
        assertTrue(fxrp != address(0), "fAsset set");
        assertGt(fxrp.code.length, 0, "fAsset has code");
    }

    /// buyGuard drives the REAL AssetManager: an unknown redemption id cannot be insured.
    function test_fork_buyGuard_rejectsUnknownRedemption() public onFork {
        vm.deal(address(this), 1 ether);
        vm.expectRevert(); // real redemptionRequestInfo → not active / not redeemer / revert
        backstop.buyGuard{value: 1 ether}(999_999_999, 1e18);
    }
}
