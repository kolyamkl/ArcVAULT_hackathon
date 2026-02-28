// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/BudgetManager.sol";
import "../src/TreasuryVault.sol";
import "../src/mocks/MockERC20.sol";
import "../src/mocks/MockUSYC.sol";

contract BudgetManagerTest is Test {
    // Re-declare events for vm.expectEmit
    event BudgetCreated(uint256 indexed budgetId, string name, uint256 allocation);
    event BudgetSpent(uint256 indexed budgetId, uint256 amount, bytes32 paymentRef);
    event BudgetReallocated(uint256 fromId, uint256 toId, uint256 amount);

    BudgetManager budgetMgr;
    TreasuryVault vault;
    MockERC20 usdc;
    MockUSYC usyc;

    address admin = address(this);
    address deptHead = makeAddr("deptHead");

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        usyc = new MockUSYC(address(usdc));

        vault = new TreasuryVault(address(usdc), address(usyc), 100_000e6, admin);

        budgetMgr = new BudgetManager(address(vault), address(usdc), admin);

        // Grant TREASURY_MANAGER_ROLE to BudgetManager
        vault.grantRole(vault.TREASURY_MANAGER_ROLE(), address(budgetMgr));

        // Fund vault
        usdc.mint(address(vault), 1_000_000e6);
        // Fund USYC for redemptions
        usdc.mint(address(usyc), 10_000_000e6);
    }

    // ── Constructor ───────────────────────────────────────────────

    function test_constructor_setsState() public view {
        assertEq(address(budgetMgr.treasuryVault()), address(vault));
        assertEq(budgetMgr.usdc(), address(usdc));
        assertTrue(budgetMgr.hasRole(budgetMgr.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(budgetMgr.hasRole(budgetMgr.CFO_ROLE(), admin));
    }

    function test_constructor_revertsZeroAddress() public {
        vm.expectRevert(BudgetManager.ZeroAddress.selector);
        new BudgetManager(address(0), address(usdc), admin);

        vm.expectRevert(BudgetManager.ZeroAddress.selector);
        new BudgetManager(address(vault), address(0), admin);

        vm.expectRevert(BudgetManager.ZeroAddress.selector);
        new BudgetManager(address(vault), address(usdc), address(0));
    }

    // ── Create Budget ─────────────────────────────────────────────

    function test_createBudget() public {
        uint256 periodEnd = block.timestamp + 30 days;
        uint256 budgetId = budgetMgr.createBudget("Engineering", deptHead, 500_000e6, periodEnd);

        assertEq(budgetId, 1);
        assertEq(budgetMgr.budgetCounter(), 1);

        BudgetManager.Budget memory b = budgetMgr.getBudgetStatus(budgetId);
        assertEq(b.name, "Engineering");
        assertEq(b.departmentHead, deptHead);
        assertEq(b.totalAllocation, 500_000e6);
        assertEq(b.spent, 0);
        assertEq(b.periodEnd, periodEnd);
        assertTrue(b.active);
    }

    function test_createBudget_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit BudgetCreated(1, "Marketing", 200_000e6);
        budgetMgr.createBudget("Marketing", deptHead, 200_000e6, block.timestamp + 30 days);
    }

    function test_createBudget_revertsZeroHead() public {
        vm.expectRevert(BudgetManager.ZeroAddress.selector);
        budgetMgr.createBudget("Test", address(0), 100e6, block.timestamp + 1 days);
    }

    function test_createBudget_revertsZeroAllocation() public {
        vm.expectRevert(BudgetManager.InvalidAmount.selector);
        budgetMgr.createBudget("Test", deptHead, 0, block.timestamp + 1 days);
    }

    function test_createBudget_revertsPastPeriodEnd() public {
        vm.expectRevert(BudgetManager.InvalidAmount.selector);
        budgetMgr.createBudget("Test", deptHead, 100e6, block.timestamp - 1);
    }

    function test_createBudget_revertsNonCFO() public {
        vm.prank(deptHead);
        vm.expectRevert();
        budgetMgr.createBudget("Test", deptHead, 100e6, block.timestamp + 1 days);
    }

    // ── Spend from Budget ─────────────────────────────────────────

    function test_spendFromBudget() public {
        uint256 budgetId = budgetMgr.createBudget("Engineering", deptHead, 500_000e6, block.timestamp + 30 days);

        uint256 spendAmount = 50_000e6;
        bytes32 ref = keccak256("PO-001");

        vm.prank(deptHead);
        budgetMgr.spendFromBudget(budgetId, spendAmount, ref);

        BudgetManager.Budget memory b = budgetMgr.getBudgetStatus(budgetId);
        assertEq(b.spent, spendAmount);
        assertEq(usdc.balanceOf(deptHead), spendAmount);
    }

    function test_spendFromBudget_emitsEvent() public {
        uint256 budgetId = budgetMgr.createBudget("Engineering", deptHead, 500_000e6, block.timestamp + 30 days);
        bytes32 ref = keccak256("PO-002");

        vm.expectEmit(true, false, false, true);
        emit BudgetSpent(budgetId, 10_000e6, ref);

        vm.prank(deptHead);
        budgetMgr.spendFromBudget(budgetId, 10_000e6, ref);
    }

    function test_spendFromBudget_multipleSpends() public {
        uint256 budgetId = budgetMgr.createBudget("Marketing", deptHead, 100_000e6, block.timestamp + 30 days);

        vm.startPrank(deptHead);
        budgetMgr.spendFromBudget(budgetId, 30_000e6, keccak256("S1"));
        budgetMgr.spendFromBudget(budgetId, 20_000e6, keccak256("S2"));
        budgetMgr.spendFromBudget(budgetId, 50_000e6, keccak256("S3"));
        vm.stopPrank();

        BudgetManager.Budget memory b = budgetMgr.getBudgetStatus(budgetId);
        assertEq(b.spent, 100_000e6);
        assertEq(usdc.balanceOf(deptHead), 100_000e6);
    }

    function test_spendFromBudget_revertsExceedsAllocation() public {
        uint256 budgetId = budgetMgr.createBudget("Test", deptHead, 10_000e6, block.timestamp + 30 days);

        vm.prank(deptHead);
        vm.expectRevert(BudgetManager.ExceedsAllocation.selector);
        budgetMgr.spendFromBudget(budgetId, 10_001e6, bytes32(0));
    }

    function test_spendFromBudget_revertsUnauthorizedHead() public {
        uint256 budgetId = budgetMgr.createBudget("Test", deptHead, 10_000e6, block.timestamp + 30 days);

        vm.prank(makeAddr("imposter"));
        vm.expectRevert(BudgetManager.UnauthorizedDepartmentHead.selector);
        budgetMgr.spendFromBudget(budgetId, 1000e6, bytes32(0));
    }

    function test_spendFromBudget_revertsExpired() public {
        uint256 budgetId = budgetMgr.createBudget("Test", deptHead, 10_000e6, block.timestamp + 1 days);

        // Warp past expiry
        vm.warp(block.timestamp + 2 days);

        vm.prank(deptHead);
        vm.expectRevert(BudgetManager.BudgetExpired.selector);
        budgetMgr.spendFromBudget(budgetId, 1000e6, bytes32(0));
    }

    function test_spendFromBudget_revertsZeroAmount() public {
        uint256 budgetId = budgetMgr.createBudget("Test", deptHead, 10_000e6, block.timestamp + 30 days);

        vm.prank(deptHead);
        vm.expectRevert(BudgetManager.InvalidAmount.selector);
        budgetMgr.spendFromBudget(budgetId, 0, bytes32(0));
    }

    function test_spendFromBudget_revertsBudgetNotFound() public {
        vm.prank(deptHead);
        vm.expectRevert(BudgetManager.BudgetNotFound.selector);
        budgetMgr.spendFromBudget(999, 1000e6, bytes32(0));
    }

    function test_spendFromBudget_revertsWhenPaused() public {
        uint256 budgetId = budgetMgr.createBudget("Test", deptHead, 10_000e6, block.timestamp + 30 days);

        budgetMgr.pause();

        vm.prank(deptHead);
        vm.expectRevert();
        budgetMgr.spendFromBudget(budgetId, 1000e6, bytes32(0));
    }

    // ── Reallocate ────────────────────────────────────────────────

    function test_reallocate() public {
        uint256 eng = budgetMgr.createBudget("Engineering", deptHead, 500_000e6, block.timestamp + 30 days);
        uint256 mkt = budgetMgr.createBudget("Marketing", makeAddr("mktHead"), 200_000e6, block.timestamp + 30 days);

        budgetMgr.reallocate(eng, mkt, 100_000e6);

        BudgetManager.Budget memory engBudget = budgetMgr.getBudgetStatus(eng);
        BudgetManager.Budget memory mktBudget = budgetMgr.getBudgetStatus(mkt);

        assertEq(engBudget.totalAllocation, 400_000e6);
        assertEq(mktBudget.totalAllocation, 300_000e6);
    }

    function test_reallocate_emitsEvent() public {
        uint256 from = budgetMgr.createBudget("From", deptHead, 500_000e6, block.timestamp + 30 days);
        uint256 to = budgetMgr.createBudget("To", makeAddr("other"), 200_000e6, block.timestamp + 30 days);

        vm.expectEmit(false, false, false, true);
        emit BudgetReallocated(from, to, 50_000e6);
        budgetMgr.reallocate(from, to, 50_000e6);
    }

    function test_reallocate_revertsInsufficientUnspent() public {
        uint256 from = budgetMgr.createBudget("From", deptHead, 100_000e6, block.timestamp + 30 days);
        uint256 to = budgetMgr.createBudget("To", makeAddr("other"), 50_000e6, block.timestamp + 30 days);

        // Spend 60k from "from"
        vm.prank(deptHead);
        budgetMgr.spendFromBudget(from, 60_000e6, bytes32(0));

        // Try to reallocate 50k (only 40k unspent)
        vm.expectRevert(BudgetManager.InsufficientUnspent.selector);
        budgetMgr.reallocate(from, to, 50_000e6);
    }

    function test_reallocate_revertsZeroAmount() public {
        uint256 from = budgetMgr.createBudget("From", deptHead, 100e6, block.timestamp + 30 days);
        uint256 to = budgetMgr.createBudget("To", makeAddr("other"), 100e6, block.timestamp + 30 days);

        vm.expectRevert(BudgetManager.InvalidAmount.selector);
        budgetMgr.reallocate(from, to, 0);
    }

    function test_reallocate_revertsNonCFO() public {
        uint256 from = budgetMgr.createBudget("From", deptHead, 100e6, block.timestamp + 30 days);
        uint256 to = budgetMgr.createBudget("To", makeAddr("other"), 100e6, block.timestamp + 30 days);

        vm.prank(deptHead);
        vm.expectRevert();
        budgetMgr.reallocate(from, to, 50e6);
    }

    // ── Pause ─────────────────────────────────────────────────────

    function test_pauseUnpause() public {
        budgetMgr.pause();
        assertTrue(budgetMgr.paused());

        budgetMgr.unpause();
        assertFalse(budgetMgr.paused());
    }

    // ── Fuzz ──────────────────────────────────────────────────────

    function testFuzz_createAndSpend(uint256 allocation, uint256 spendAmount) public {
        allocation = bound(allocation, 1e6, 10_000_000e6);
        spendAmount = bound(spendAmount, 1, allocation);

        // Ensure vault has enough
        usdc.mint(address(vault), allocation);

        uint256 budgetId = budgetMgr.createBudget("Fuzz", deptHead, allocation, block.timestamp + 30 days);

        vm.prank(deptHead);
        budgetMgr.spendFromBudget(budgetId, spendAmount, bytes32(0));

        BudgetManager.Budget memory b = budgetMgr.getBudgetStatus(budgetId);
        assertEq(b.spent, spendAmount);
    }
}
