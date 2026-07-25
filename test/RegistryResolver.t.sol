// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// Unit tests use a mocked Flare Contract Registry to exercise RegistryResolver's own
// resolution + revert logic. Real registry resolution on Coston2 is proven by the Day-4
// spike (scripts/spike.ts), not by these mocks.

import {Test} from "forge-std/Test.sol";
import {RegistryResolver} from "../src/RegistryResolver.sol";
import {IFlareContractRegistry} from "flare-periphery/src/coston2/IFlareContractRegistry.sol";

/// @dev External harness so `vm.expectRevert` sees library reverts across a call boundary
///      and coverage can reach the `internal` library functions (otherwise inlined).
contract RrHarness {
    function byName(string memory name) external view returns (address) {
        return RegistryResolver.byName(name);
    }

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

contract RegistryResolverTest is Test {
    // Mirror the constant baked into the library.
    address internal constant FLARE_CONTRACT_REGISTRY = 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019;

    RrHarness internal rr;

    function setUp() public {
        rr = new RrHarness();
    }

    /// @dev Mock the registry to resolve `name` -> `resolved`.
    function _mockName(string memory name, address resolved) internal {
        vm.mockCall(
            FLARE_CONTRACT_REGISTRY,
            abi.encodeWithSelector(IFlareContractRegistry.getContractAddressByName.selector, name),
            abi.encode(resolved)
        );
    }

    function test_byName_resolvesViaConstantRegistry() public {
        // Proves resolution goes through the hardcoded registry constant.
        address expected = address(0xCAFE);
        _mockName("ViaConstant", expected);
        assertEq(rr.byName("ViaConstant"), expected);
    }

    function test_byName_success() public {
        address expected = address(0xBEEF);
        _mockName("SomeContract", expected);
        assertEq(rr.byName("SomeContract"), expected);
    }

    function test_byName_revertsOnZero() public {
        _mockName("Missing", address(0));
        vm.expectRevert(bytes("RegistryResolver: unknown name"));
        rr.byName("Missing");
    }

    function test_assetManagerFXRP_resolves() public {
        address expected = address(0xA11);
        _mockName("AssetManagerFXRP", expected);
        assertEq(rr.assetManagerFXRP(), expected);
    }

    function test_fdcVerification_resolves() public {
        address expected = address(0xFDC);
        _mockName("FdcVerification", expected);
        assertEq(rr.fdcVerification(), expected);
    }

    function test_ftsoV2_resolves() public {
        address expected = address(0xF750);
        _mockName("FtsoV2", expected);
        assertEq(rr.ftsoV2(), expected);
    }
}
