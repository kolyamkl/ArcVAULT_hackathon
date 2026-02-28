// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ITreasuryVaultForBudget {
    function withdrawFunds(uint256 amount) external;
}

contract BudgetManager is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant CFO_ROLE = keccak256("CFO_ROLE");

    error ZeroAddress();
    error InvalidAmount();
    error BudgetNotFound();
    error BudgetNotActive();
    error BudgetExpired();
    error ExceedsAllocation();
    error UnauthorizedDepartmentHead();
    error InsufficientUnspent();

    struct Budget {
        string name;
        address departmentHead;
        uint256 totalAllocation;
        uint256 spent;
        uint256 periodStart;
        uint256 periodEnd;
        bool active;
    }

    ITreasuryVaultForBudget public treasuryVault;
    address public usdc;
    uint256 public budgetCounter;
    mapping(uint256 => Budget) public budgets;

    event BudgetCreated(uint256 indexed budgetId, string name, uint256 allocation);
    event BudgetSpent(uint256 indexed budgetId, uint256 amount, bytes32 paymentRef);
    event BudgetReallocated(uint256 fromId, uint256 toId, uint256 amount);

    constructor(address _treasuryVault, address _usdc, address _admin) {
        if (_treasuryVault == address(0)) revert ZeroAddress();
        if (_usdc == address(0)) revert ZeroAddress();
        if (_admin == address(0)) revert ZeroAddress();

        treasuryVault = ITreasuryVaultForBudget(_treasuryVault);
        usdc = _usdc;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(CFO_ROLE, _admin);
    }

    function createBudget(
        string calldata name,
        address departmentHead,
        uint256 totalAllocation,
        uint256 periodEnd
    ) external onlyRole(CFO_ROLE) returns (uint256) {
        if (departmentHead == address(0)) revert ZeroAddress();
        if (totalAllocation == 0) revert InvalidAmount();
        if (periodEnd <= block.timestamp) revert InvalidAmount();

        budgetCounter++;
        uint256 budgetId = budgetCounter;

        budgets[budgetId] = Budget({
            name: name,
            departmentHead: departmentHead,
            totalAllocation: totalAllocation,
            spent: 0,
            periodStart: block.timestamp,
            periodEnd: periodEnd,
            active: true
        });

        emit BudgetCreated(budgetId, name, totalAllocation);
        return budgetId;
    }

    function spendFromBudget(uint256 budgetId, uint256 amount, bytes32 paymentRef)
        external
        nonReentrant
        whenNotPaused
    {
        Budget storage budget = budgets[budgetId];
        if (budget.totalAllocation == 0) revert BudgetNotFound();
        if (msg.sender != budget.departmentHead) revert UnauthorizedDepartmentHead();
        if (!budget.active) revert BudgetNotActive();
        if (block.timestamp > budget.periodEnd) revert BudgetExpired();
        if (amount == 0) revert InvalidAmount();
        if (budget.spent + amount > budget.totalAllocation) revert ExceedsAllocation();

        budget.spent += amount;

        // Pull USDC from vault
        treasuryVault.withdrawFunds(amount);

        // Transfer USDC to the department head
        IERC20(usdc).safeTransfer(msg.sender, amount);

        emit BudgetSpent(budgetId, amount, paymentRef);
    }

    function reallocate(uint256 fromBudgetId, uint256 toBudgetId, uint256 amount)
        external
        onlyRole(CFO_ROLE)
    {
        Budget storage fromBudget = budgets[fromBudgetId];
        Budget storage toBudget = budgets[toBudgetId];

        if (fromBudget.totalAllocation == 0) revert BudgetNotFound();
        if (toBudget.totalAllocation == 0) revert BudgetNotFound();
        if (!fromBudget.active) revert BudgetNotActive();
        if (!toBudget.active) revert BudgetNotActive();
        if (amount == 0) revert InvalidAmount();

        uint256 unspent = fromBudget.totalAllocation - fromBudget.spent;
        if (unspent < amount) revert InsufficientUnspent();

        fromBudget.totalAllocation -= amount;
        toBudget.totalAllocation += amount;

        emit BudgetReallocated(fromBudgetId, toBudgetId, amount);
    }

    function getBudgetStatus(uint256 budgetId) external view returns (Budget memory) {
        if (budgets[budgetId].totalAllocation == 0) revert BudgetNotFound();
        return budgets[budgetId];
    }

    // --- Admin ---

    function pause() external onlyRole(CFO_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(CFO_ROLE) {
        _unpause();
    }
}
