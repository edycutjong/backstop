// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IFlareContractRegistry} from "flare-periphery/src/coston2/IFlareContractRegistry.sol";
import {IAssetManager} from "flare-periphery/src/coston2/IAssetManager.sol";
import {IFdcVerification} from "flare-periphery/src/coston2/IFdcVerification.sol";
import {FtsoV2Interface} from "flare-periphery/src/coston2/FtsoV2Interface.sol";

/**
 * @title RegistryResolver
 * @notice Resolves the Flare protocol contracts Backstop depends on, from the
 *         Flare Contract Registry — never hardcoding addresses. This is
 *         The day-one spike (scripts/spike.ts) verified all names resolve to
 *         live contracts on Coston2 (chain 114).
 *
 * Registry names verified live on 2026-07-26:
 *   AssetManagerFXRP, FdcVerification, FtsoV2
 *   (also FdcHub, FdcRequestFeeConfigurations, FlareSystemsManager, Relay for the keeper).
 */
library RegistryResolver {
    // The one address stable across every Flare network.
    address internal constant FLARE_CONTRACT_REGISTRY = 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019;

    function byName(string memory name) internal view returns (address addr) {
        // Cast is inlined into the call site (not a standalone `registry()` helper): a
        // constant address→interface cast on its own line folds to zero runtime bytecode,
        // which coverage tools can never mark as hit. Inlined, the cast rides the CALL opcode.
        addr = IFlareContractRegistry(FLARE_CONTRACT_REGISTRY).getContractAddressByName(name);
        require(addr != address(0), "RegistryResolver: unknown name");
    }

    function assetManagerFXRP() internal view returns (IAssetManager) {
        return IAssetManager(byName("AssetManagerFXRP"));
    }

    function fdcVerification() internal view returns (IFdcVerification) {
        return IFdcVerification(byName("FdcVerification"));
    }

    function ftsoV2() internal view returns (FtsoV2Interface) {
        return FtsoV2Interface(byName("FtsoV2"));
    }
}
