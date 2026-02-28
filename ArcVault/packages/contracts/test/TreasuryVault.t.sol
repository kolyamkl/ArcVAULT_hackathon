// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TreasuryVault.sol";
import "../src/mocks/MockERC20.sol";
import "../src/mocks/MockUSYC.sol";

contract TreasuryVaultTest is Test {
    // Re-declare events for vm.expectEmit
    event Deposited(address indexed user, uint256 amount);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    TreasuryVault vault;
    MockERC20 usdc;
    MockUSYC usyc;

    address admin = address(this);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant THRESHOLD = 100_000e6; // 100k USDC

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        usyc = new MockUSYC(address(usdc));

        vault = new TreasuryVault(address(usdc), address(usyc), THRESHOLD, admin);

        // Fund USYC so it can pay redemptions
        usdc.mint(address(usyc), 10_000_000e6);
        // Give alice some USDC for deposits
        usdc.mint(alice, 1_000_000e6);
    }

    // ── Constructor ───────────────────────────────────────────────

    function test_constructor_setsState() public view {
        assertEq(vault.usdc(), address(usdc));
        assertEq(vault.usyc(), address(usyc));
        assertEq(vault.liquidityThreshold(), THRESHOLD);
        assertTrue(vault.hasRole(vault.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(vault.hasRole(vault.CFO_ROLE(), admin));
        assertTrue(vault.hasRole(vault.TREASURY_MANAGER_ROLE(), admin));
    }

    function test_constructor_revertsZeroAddress() public {
        vm.expectRevert(TreasuryVault.ZeroAddress.selector);
        new TreasuryVault(address(0), address(usyc), THRESHOLD, admin);

        vm.expectRevert(TreasuryVault.ZeroAddress.selector);
        new TreasuryVault(address(usdc), address(0), THRESHOLD, admin);

        vm.expectRevert(TreasuryVault.ZeroAddress.selector);
        new TreasuryVault(address(usdc), address(usyc), THRESHOLD, address(0));
    }

    function test_constructor_revertsZeroThreshold() public {
        vm.expectRevert(TreasuryVault.InvalidAmount.selector);
        new TreasuryVault(address(usdc), address(usyc), 0, admin);
    }

    // ── Deposit ───────────────────────────────────────────────────

    function test_deposit_basic() public {
        uint256 amount = 50_000e6;
        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        vault.depositFunds(amount);
        vm.stopPrank();

        assertEq(vault.totalDeposited(), amount);
        assertEq(vault.getLiquidBalance(), amount);
    }

    function test_deposit_emitsEvent() public {
        uint256 amount = 50_000e6;
        vm.startPrank(alice);
        usdc.approve(address(vault), amount);

        vm.expectEmit(true, false, false, true);
        emit Deposited(alice, amount);
        vault.depositFunds(amount);
        vm.stopPrank();
    }

    function test_deposit_autoSweepsOverThreshold() public {
        // Deposit more than threshold → should auto-sweep excess to USYC
        uint256 amount = 200_000e6;
        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        vault.depositFunds(amount);
        vm.stopPrank();

        // Liquid should be at threshold, rest in USYC
        assertEq(vault.getLiquidBalance(), THRESHOLD);
        assertGt(vault.getUSYCBalance(), 0);
    }

    function test_deposit_revertsZeroAmount() public {
        vm.expectRevert(TreasuryVault.InvalidAmount.selector);
        vault.depositFunds(0);
    }

    function test_deposit_revertsWhenPaused() public {
        vault.pause();
        vm.startPrank(alice);
        usdc.approve(address(vault), 1000e6);
        vm.expectRevert();
        vault.depositFunds(1000e6);
        vm.stopPrank();
    }

    // ── Withdraw ──────────────────────────────────────────────────

    function test_withdraw_fromLiquid() public {
        // Seed vault with USDC
        usdc.mint(address(vault), 50_000e6);

        uint256 balBefore = usdc.balanceOf(admin);
        vault.withdrawFunds(10_000e6);
        uint256 balAfter = usdc.balanceOf(admin);

        assertEq(balAfter - balBefore, 10_000e6);
        assertEq(vault.totalWithdrawn(), 10_000e6);
    }

    function test_withdraw_redeemsFromUSYCIfShortfall() public {
        // Deposit over threshold so excess is swept to USYC
        uint256 amount = 500_000e6;
        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        vault.depositFunds(amount);
        vm.stopPrank();

        // Liquid = 100k (threshold), USYC holds the rest
        assertEq(vault.getLiquidBalance(), THRESHOLD);

        // Withdraw 200k — needs to redeem 100k from USYC
        vault.withdrawFunds(200_000e6);
        assertEq(vault.totalWithdrawn(), 200_000e6);
    }

    function test_withdraw_revertsForNonManager() public {
        usdc.mint(address(vault), 50_000e6);
        vm.prank(alice);
        vm.expectRevert();
        vault.withdrawFunds(1000e6);
    }

    function test_withdraw_revertsZeroAmount() public {
        vm.expectRevert(TreasuryVault.InvalidAmount.selector);
        vault.withdrawFunds(0);
    }

    // ── Sweep & Redeem ────────────────────────────────────────────

    function test_sweepToUSYC_movesExcess() public {
        // Put 300k USDC in vault directly
        usdc.mint(address(vault), 300_000e6);

        vault.sweepToUSYC();

        assertEq(vault.getLiquidBalance(), THRESHOLD);
        assertGt(vault.getUSYCBalance(), 0);
    }

    function test_sweepToUSYC_revertsIfAtOrBelowThreshold() public {
        usdc.mint(address(vault), 50_000e6); // below threshold
        vm.expectRevert(TreasuryVault.NothingToSweep.selector);
        vault.sweepToUSYC();
    }

    function test_redeemFromUSYC() public {
        // Deposit over threshold, then manually redeem
        usdc.mint(address(vault), 300_000e6);
        vault.sweepToUSYC();
        uint256 usycBefore = vault.getUSYCBalance();

        vault.redeemFromUSYC(50_000e6);
        assertLt(vault.getUSYCBalance(), usycBefore);
    }

    function test_redeemFromUSYC_revertsZero() public {
        vm.expectRevert(TreasuryVault.InvalidAmount.selector);
        vault.redeemFromUSYC(0);
    }

    // ── Threshold & Rebalance ─────────────────────────────────────

    function test_setLiquidityThreshold() public {
        uint256 newThreshold = 200_000e6;

        vm.expectEmit(false, false, false, true);
        emit ThresholdUpdated(THRESHOLD, newThreshold);
        vault.setLiquidityThreshold(newThreshold);

        assertEq(vault.liquidityThreshold(), newThreshold);
    }

    function test_setLiquidityThreshold_revertsZero() public {
        vm.expectRevert(TreasuryVault.InvalidAmount.selector);
        vault.setLiquidityThreshold(0);
    }

    function test_setLiquidityThreshold_revertsNonCFO() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.setLiquidityThreshold(200_000e6);
    }

    function test_rebalance_sweepsExcess() public {
        usdc.mint(address(vault), 300_000e6);
        vault.rebalance();
        assertEq(vault.getLiquidBalance(), THRESHOLD);
    }

    // ── View Functions ────────────────────────────────────────────

    function test_getTotalValue() public {
        usdc.mint(address(vault), 300_000e6);
        vault.sweepToUSYC();

        uint256 totalValue = vault.getTotalValue();
        // Should be close to 300k (slight rounding possible)
        assertApproxEqAbs(totalValue, 300_000e6, 1e6);
    }

    // ── Pause ─────────────────────────────────────────────────────

    function test_pauseUnpause() public {
        vault.pause();
        assertTrue(vault.paused());

        vault.unpause();
        assertFalse(vault.paused());
    }

    function test_pause_revertsNonAdmin() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.pause();
    }

    // ── Fuzz ──────────────────────────────────────────────────────

    function testFuzz_deposit(uint256 amount) public {
        amount = bound(amount, 1, 500_000e6);
        usdc.mint(alice, amount);

        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        vault.depositFunds(amount);
        vm.stopPrank();

        assertEq(vault.totalDeposited(), amount);
    }
}
