// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/TreasuryVault.sol";

/**
 * @title GrantCFORole
 * @notice Grants CFO_ROLE on TreasuryVault to a target address.
 *         Must be run with the deployer's private key (DEFAULT_ADMIN_ROLE holder).
 *
 * Usage:
 *   TARGET_ADDRESS=0x... VAULT_ADDRESS=0x... \
 *   forge script script/GrantCFORole.s.sol --rpc-url $RPC_URL --broadcast
 */
contract GrantCFORole is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address target = vm.envAddress("TARGET_ADDRESS");
        address vaultAddr = vm.envAddress("VAULT_ADDRESS");

        TreasuryVault vault = TreasuryVault(vaultAddr);
        bytes32 cfoRole = vault.CFO_ROLE();

        vm.startBroadcast(deployerPrivateKey);
        vault.grantRole(cfoRole, target);
        vm.stopBroadcast();

        console.log("Granted CFO_ROLE to:", target);
    }
}
