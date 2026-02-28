// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/mocks/MockERC20.sol";
import "../src/mocks/MockUSYC.sol";
import "../src/mocks/MockStableFX.sol";
import "../src/TreasuryVault.sol";
import "../src/PayoutRouter.sol";
import "../src/BudgetManager.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy mock tokens
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 eurc = new MockERC20("Euro Coin", "EURC", 6);

        // Deploy MockUSYC
        MockUSYC usyc = new MockUSYC(address(usdc));

        // Deploy MockStableFX and configure rates
        MockStableFX stableFX = new MockStableFX();
        stableFX.setRate(address(usdc), address(eurc), 0.9235e18); // USDC -> EURC
        stableFX.setRate(address(eurc), address(usdc), 1.0828e18); // EURC -> USDC

        // Deploy TreasuryVault
        TreasuryVault vault = new TreasuryVault(
            address(usdc),
            address(usyc),
            100_000e6, // threshold: 100k USDC
            deployer
        );

        // Deploy PayoutRouter (budget manager placeholder = deployer initially)
        PayoutRouter router = new PayoutRouter(
            address(vault),
            address(stableFX),
            deployer, // budget manager placeholder
            address(usdc),
            deployer
        );

        // Deploy BudgetManager
        BudgetManager budget = new BudgetManager(
            address(vault),
            address(usdc),
            deployer
        );

        // Grant TREASURY_MANAGER_ROLE to PayoutRouter and BudgetManager
        bytes32 TREASURY_MANAGER_ROLE = vault.TREASURY_MANAGER_ROLE();
        vault.grantRole(TREASURY_MANAGER_ROLE, address(router));
        vault.grantRole(TREASURY_MANAGER_ROLE, address(budget));

        // Mint initial USDC
        usdc.mint(deployer, 10_000_000e6); // 10M USDC to deployer
        usdc.mint(address(vault), 1_000_000e6); // 1M USDC to vault

        // Fund MockUSYC with USDC so it can pay out redemptions
        usdc.mint(address(usyc), 10_000_000e6);

        // Fund MockStableFX with EURC
        eurc.mint(address(stableFX), 10_000_000e6);

        vm.stopBroadcast();

        // Log deployed addresses
        console.log("=== ArcVault Deployment ===");
        console.log("USDC:", address(usdc));
        console.log("EURC:", address(eurc));
        console.log("USYC:", address(usyc));
        console.log("StableFX:", address(stableFX));
        console.log("TreasuryVault:", address(vault));
        console.log("PayoutRouter:", address(router));
        console.log("BudgetManager:", address(budget));
        console.log("Deployer:", deployer);
    }
}
