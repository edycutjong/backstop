// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {BackstopPool} from "../src/BackstopPool.sol";
import {Backstop} from "../src/Backstop.sol";

/**
 * @title Deploy
 * @notice Deploys BackstopPool + Backstop to Coston2 and wires them together.
 *
 * Run (simulate — no on-chain writes):
 *   source .env && forge script script/Deploy.s.sol:Deploy \
 *     --rpc-url "$COSTON2_RPC_URL" --sender "$DEPLOYER_ADDRESS"
 *
 * Run (broadcast + verify on Coston2 Blockscout, no API key):
 *   source .env && forge script script/Deploy.s.sol:Deploy \
 *     --rpc-url "$COSTON2_RPC_URL" --private-key "0x$PRIVATE_KEY" --broadcast \
 *     --verify --verifier blockscout \
 *     --verifier-url https://coston2-explorer.flare.network/api/
 */
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        BackstopPool pool = new BackstopPool();
        Backstop backstop = new Backstop(pool);
        pool.setBackstop(address(backstop));

        vm.stopBroadcast();

        // Sanity: wiring is in place before we trust the addresses.
        require(pool.backstop() == address(backstop), "Deploy: pool not wired to backstop");
        require(address(backstop.pool()) == address(pool), "Deploy: backstop not wired to pool");

        console2.log("BackstopPool:", address(pool));
        console2.log("Backstop:    ", address(backstop));
        console2.log("owner:       ", backstop.owner());
    }
}
