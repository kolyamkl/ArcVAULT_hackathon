// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PayoutRouter.sol";
import "../src/TreasuryVault.sol";
import "../src/mocks/MockERC20.sol";
import "../src/mocks/MockUSYC.sol";
import "../src/mocks/MockStableFX.sol";

contract PayoutRouterTest is Test {
    PayoutRouter router;
    TreasuryVault vault;
    MockERC20 usdc;
    MockERC20 eurc;
    MockUSYC usyc;
    MockStableFX stableFX;

    address admin = address(this);
    address recipient = makeAddr("recipient");

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        eurc = new MockERC20("Euro Coin", "EURC", 6);
        usyc = new MockUSYC(address(usdc));
        stableFX = new MockStableFX();

        // Set FX rates
        stableFX.setRate(address(usdc), address(eurc), 0.9235e18);
        stableFX.setRate(address(eurc), address(usdc), 1.0828e18);

        // Deploy vault
        vault = new TreasuryVault(address(usdc), address(usyc), 100_000e6, admin);

        // Deploy router
        router = new PayoutRouter(
            address(vault),
            address(stableFX),
            admin,
            address(usdc),
            admin
        );

        // Grant TREASURY_MANAGER_ROLE to router
        vault.grantRole(vault.TREASURY_MANAGER_ROLE(), address(router));

        // Fund vault
        usdc.mint(address(vault), 1_000_000e6);
        // Fund USYC for redemptions
        usdc.mint(address(usyc), 10_000_000e6);
        // Fund StableFX with EURC
        eurc.mint(address(stableFX), 10_000_000e6);
    }

    // ── Constructor ───────────────────────────────────────────────

    function test_constructor_setsState() public view {
        assertEq(address(router.treasuryVault()), address(vault));
        assertEq(address(router.stableFX()), address(stableFX));
        assertEq(router.usdc(), address(usdc));
        assertEq(router.payoutCounter(), 0);
    }

    function test_constructor_revertsZeroAddress() public {
        vm.expectRevert(PayoutRouter.ZeroAddress.selector);
        new PayoutRouter(address(0), address(stableFX), admin, address(usdc), admin);

        vm.expectRevert(PayoutRouter.ZeroAddress.selector);
        new PayoutRouter(address(vault), address(0), admin, address(usdc), admin);

        vm.expectRevert(PayoutRouter.ZeroAddress.selector);
        new PayoutRouter(address(vault), address(stableFX), admin, address(0), admin);

        vm.expectRevert(PayoutRouter.ZeroAddress.selector);
        new PayoutRouter(address(vault), address(stableFX), admin, address(usdc), address(0));
    }

    // ── Execute Payout (USDC) ─────────────────────────────────────

    function test_executePayout_usdc() public {
        uint256 amount = 10_000e6;
        bytes32 ref = keccak256("INV-001");

        uint256 payoutId = router.executePayout(recipient, amount, address(usdc), ref);

        assertEq(payoutId, 1);
        assertEq(router.payoutCounter(), 1);
        assertEq(usdc.balanceOf(recipient), amount);

        PayoutRouter.Payout memory p = router.getPayoutStatus(payoutId);
        assertEq(p.recipient, recipient);
        assertEq(p.amount, amount);
        assertEq(p.outputAmount, amount);
        assertEq(uint256(p.status), uint256(PayoutRouter.PayoutStatus.Completed));
    }

    function test_executePayout_usdc_addressZeroDefaultsToUSDC() public {
        uint256 amount = 5_000e6;
        uint256 payoutId = router.executePayout(recipient, amount, address(0), bytes32(0));

        PayoutRouter.Payout memory p = router.getPayoutStatus(payoutId);
        assertEq(p.targetCurrency, address(usdc));
        assertEq(usdc.balanceOf(recipient), amount);
    }

    // ── Execute Payout (FX conversion to EURC) ────────────────────

    function test_executePayout_eurcConversion() public {
        uint256 amount = 10_000e6;
        bytes32 ref = keccak256("INV-002");

        uint256 payoutId = router.executePayout(recipient, amount, address(eurc), ref);

        assertEq(payoutId, 1);

        PayoutRouter.Payout memory p = router.getPayoutStatus(payoutId);
        assertEq(uint256(p.status), uint256(PayoutRouter.PayoutStatus.Completed));
        assertEq(p.targetCurrency, address(eurc));

        // Output should be ~9235e6 (10000 * 0.9235)
        uint256 expectedOutput = (amount * 0.9235e18) / 1e18;
        assertEq(p.outputAmount, expectedOutput);
        assertEq(eurc.balanceOf(recipient), expectedOutput);
    }

    // ── Batch Payout ──────────────────────────────────────────────

    function test_batchPayout() public {
        address[] memory recipients = new address[](3);
        uint256[] memory amounts = new uint256[](3);
        address[] memory currencies = new address[](3);
        bytes32[] memory refs = new bytes32[](3);

        recipients[0] = makeAddr("r1");
        recipients[1] = makeAddr("r2");
        recipients[2] = makeAddr("r3");
        amounts[0] = 5_000e6;
        amounts[1] = 10_000e6;
        amounts[2] = 3_000e6;
        currencies[0] = address(usdc);
        currencies[1] = address(eurc);
        currencies[2] = address(usdc);
        refs[0] = keccak256("B1");
        refs[1] = keccak256("B2");
        refs[2] = keccak256("B3");

        uint256[] memory ids = router.batchPayout(recipients, amounts, currencies, refs);

        assertEq(ids.length, 3);
        assertEq(router.payoutCounter(), 3);

        // Verify each payout completed
        for (uint256 i = 0; i < 3; i++) {
            PayoutRouter.Payout memory p = router.getPayoutStatus(ids[i]);
            assertEq(uint256(p.status), uint256(PayoutRouter.PayoutStatus.Completed));
        }

        // r1 gets USDC
        assertEq(usdc.balanceOf(makeAddr("r1")), 5_000e6);
        // r2 gets EURC (converted)
        assertEq(eurc.balanceOf(makeAddr("r2")), (10_000e6 * 0.9235e18) / 1e18);
        // r3 gets USDC
        assertEq(usdc.balanceOf(makeAddr("r3")), 3_000e6);
    }

    function test_batchPayout_revertsEmpty() public {
        address[] memory r = new address[](0);
        uint256[] memory a = new uint256[](0);
        address[] memory c = new address[](0);
        bytes32[] memory refs = new bytes32[](0);

        vm.expectRevert(PayoutRouter.EmptyBatch.selector);
        router.batchPayout(r, a, c, refs);
    }

    function test_batchPayout_revertsArrayMismatch() public {
        address[] memory r = new address[](2);
        uint256[] memory a = new uint256[](1);
        address[] memory c = new address[](2);
        bytes32[] memory refs = new bytes32[](2);

        r[0] = recipient;
        r[1] = recipient;
        a[0] = 1000e6;
        c[0] = address(usdc);
        c[1] = address(usdc);
        refs[0] = bytes32(0);
        refs[1] = bytes32(0);

        vm.expectRevert(PayoutRouter.ArrayLengthMismatch.selector);
        router.batchPayout(r, a, c, refs);
    }

    // ── Access Control ────────────────────────────────────────────

    function test_executePayout_revertsNonManager() public {
        vm.prank(recipient);
        vm.expectRevert();
        router.executePayout(recipient, 1000e6, address(usdc), bytes32(0));
    }

    function test_executePayout_revertsZeroRecipient() public {
        vm.expectRevert(PayoutRouter.ZeroAddress.selector);
        router.executePayout(address(0), 1000e6, address(usdc), bytes32(0));
    }

    function test_executePayout_revertsZeroAmount() public {
        vm.expectRevert(PayoutRouter.InvalidAmount.selector);
        router.executePayout(recipient, 0, address(usdc), bytes32(0));
    }

    // ── Status Updates ────────────────────────────────────────────

    function test_updatePayoutStatus() public {
        uint256 id = router.executePayout(recipient, 1000e6, address(usdc), bytes32(0));

        router.updatePayoutStatus(id, PayoutRouter.PayoutStatus.Failed);

        PayoutRouter.Payout memory p = router.getPayoutStatus(id);
        assertEq(uint256(p.status), uint256(PayoutRouter.PayoutStatus.Failed));
    }

    function test_updatePayoutStatus_revertsNotFound() public {
        vm.expectRevert(PayoutRouter.PayoutNotFound.selector);
        router.updatePayoutStatus(999, PayoutRouter.PayoutStatus.Failed);
    }

    // ── Query Functions ───────────────────────────────────────────

    function test_getPayoutsByStatus() public {
        router.executePayout(recipient, 1000e6, address(usdc), bytes32(0));
        router.executePayout(recipient, 2000e6, address(usdc), bytes32(0));

        // Both should be completed
        uint256[] memory completed = router.getPayoutsByStatus(PayoutRouter.PayoutStatus.Completed);
        assertEq(completed.length, 2);

        // Mark one as failed
        router.updatePayoutStatus(1, PayoutRouter.PayoutStatus.Failed);

        completed = router.getPayoutsByStatus(PayoutRouter.PayoutStatus.Completed);
        assertEq(completed.length, 1);
        assertEq(completed[0], 2);

        uint256[] memory failed = router.getPayoutsByStatus(PayoutRouter.PayoutStatus.Failed);
        assertEq(failed.length, 1);
        assertEq(failed[0], 1);
    }

    function test_getPayoutStatus_revertsNotFound() public {
        vm.expectRevert(PayoutRouter.PayoutNotFound.selector);
        router.getPayoutStatus(999);
    }

    // ── Pause ─────────────────────────────────────────────────────

    function test_pauseBlocksPayouts() public {
        router.pause();
        vm.expectRevert();
        router.executePayout(recipient, 1000e6, address(usdc), bytes32(0));
    }

    // ── Admin ─────────────────────────────────────────────────────

    function test_updateTreasuryVault() public {
        address newVault = makeAddr("newVault");
        router.updateTreasuryVault(newVault);
        assertEq(address(router.treasuryVault()), newVault);
    }

    function test_updateStableFX() public {
        address newFX = makeAddr("newFX");
        router.updateStableFX(newFX);
        assertEq(address(router.stableFX()), newFX);
    }
}
