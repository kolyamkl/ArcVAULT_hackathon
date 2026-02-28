# 04 — BudgetManager.sol Specification

> **Standalone implementation document.** An agent can implement this contract using only the information in this file plus the cross-referenced interfaces.

---

## Overview

| Field | Value |
|---|---|
| **Contract** | `BudgetManager.sol` |
| **Purpose** | On-chain departmental budget enforcement — CFOs create time-bound budgets, department heads spend against them, and the CFO can reallocate unspent funds between departments. |
| **Solidity Version** | `^0.8.20` |
| **License** | MIT |
| **Location** | `packages/contracts/src/BudgetManager.sol` |
| **Test File** | `packages/contracts/test/BudgetManager.t.sol` |
| **Framework** | Foundry (forge) |

---

## Dependencies / Imports

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
```

Install via:

```bash
forge install OpenZeppelin/openzeppelin-contracts
```

---

## Interface Dependency — ITreasuryVault

`spendFromBudget` calls `ITreasuryVaultForBudget.withdrawFunds(uint256 amount)` to pull USDC from the vault. Define a minimal interface at the top of the file (named differently to avoid conflicts with the PayoutRouter's `ITreasuryVault`):

```solidity
interface ITreasuryVaultForBudget {
    function withdrawFunds(uint256 amount) external;
}
```

Refer to `docs/technical/02-treasury-vault-contract.md` for the full TreasuryVault specification.

---

## State Variables

```solidity
using SafeERC20 for IERC20;

struct Budget {
    string name;              // Human-readable label, e.g. "Engineering Q1"
    address departmentHead;   // Only this address may spend from the budget
    uint256 totalAllocation;  // Max USDC (6-decimal) this department may spend
    uint256 spent;            // Cumulative USDC spent so far
    uint256 periodStart;      // block.timestamp when the budget was created
    uint256 periodEnd;        // Timestamp after which spending is disallowed
    bool active;              // Can be deactivated by admin if needed
}

mapping(uint256 => Budget) public budgets;  // budgetId => Budget
uint256 public budgetCounter;               // Auto-increment counter (starts at 0, first budget is ID 1)

ITreasuryVaultForBudget public treasuryVault;  // TreasuryVault interface instance
address public usdc;                           // Address of the USDC token contract
```

### Custom Errors

```solidity
error ZeroAddress();
error InvalidAmount();
error BudgetNotFound();
error BudgetNotActive();
error BudgetExpired();
error ExceedsAllocation();
error UnauthorizedDepartmentHead();
error InsufficientUnspent();
```

> The contract uses custom errors (gas-efficient) instead of `require` strings.

---

## Roles

| Role Constant | Who Holds It | Permissions in This Contract |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | Deployer / multisig | Grant/revoke all roles |
| `CFO_ROLE` (`keccak256("CFO_ROLE")`) | CFO wallet | `createBudget`, `reallocate`, `pause`, `unpause` |
| *(none — address check)* | Department head address stored in `Budget.departmentHead` | `spendFromBudget` (only for their own budget) |

Role constants:

```solidity
bytes32 public constant CFO_ROLE = keccak256("CFO_ROLE");
```

See `docs/technical/05-access-control-contract.md` for the full role hierarchy across all contracts.

---

## Constructor

```solidity
constructor(address _treasuryVault, address _usdc, address _admin) {
    if (_treasuryVault == address(0)) revert ZeroAddress();
    if (_usdc == address(0)) revert ZeroAddress();
    if (_admin == address(0)) revert ZeroAddress();

    treasuryVault = ITreasuryVaultForBudget(_treasuryVault);
    usdc = _usdc;

    _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    _grantRole(CFO_ROLE, _admin);
}
```

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `_treasuryVault` | `address` | Deployed TreasuryVault contract that holds USDC |
| `_usdc` | `address` | USDC token address on the target chain |
| `_admin` | `address` | Receives `DEFAULT_ADMIN_ROLE` and `CFO_ROLE` |

---

## Events

```solidity
event BudgetCreated(uint256 indexed budgetId, string name, uint256 allocation);
event BudgetSpent(uint256 indexed budgetId, uint256 amount, bytes32 paymentRef);
event BudgetReallocated(uint256 fromId, uint256 toId, uint256 amount);
```

---

## Functions

### 1. `createBudget`

```solidity
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
```

**Access:** `onlyRole(CFO_ROLE)`

**Logic:**
1. Validate inputs (non-zero head, positive allocation, future period end).
2. Increment `budgetCounter` (pre-increment, so first ID is 1).
3. Populate the `Budget` struct in storage.
4. Emit `BudgetCreated`.

**Returns:** The new `budgetId`.

---

### 2. `spendFromBudget`

```solidity
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
```

**Access:** Only the `departmentHead` stored in that specific `Budget`. Not role-gated via AccessControl — checked via `msg.sender != budget.departmentHead` → `revert UnauthorizedDepartmentHead()`.

**Modifiers:** `nonReentrant`, `whenNotPaused`

**Logic:**
1. Load the budget from storage.
2. Verify budget exists (`totalAllocation == 0` → `revert BudgetNotFound()`).
3. Verify caller is the authorized department head.
4. Verify the budget is active and the period has not expired.
5. Verify amount is non-zero and does not exceed the remaining allocation.
6. Increment `spent`.
7. Call `treasuryVault.withdrawFunds(amount)` — this pulls USDC from the vault into this contract.
8. Transfer USDC via `safeTransfer` from this contract to `msg.sender`.
9. Emit `BudgetSpent`.

**`paymentRef` parameter:** An arbitrary `bytes32` value (e.g., invoice hash, PO number hash) for off-chain audit trail correlation.

---

### 3. `reallocate`

```solidity
function reallocate(
    uint256 fromBudgetId,
    uint256 toBudgetId,
    uint256 amount
) external onlyRole(CFO_ROLE) {
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
```

**Access:** `onlyRole(CFO_ROLE)`

**Logic:**
1. Load both budgets.
2. Verify both are active.
3. Verify the source budget has enough unspent allocation (i.e., `totalAllocation - spent >= amount`).
4. Decrease source `totalAllocation`, increase target `totalAllocation`.
5. Emit `BudgetReallocated`.

**Note:** No USDC transfers happen here. This is purely an accounting reallocation of future spending authority.

---

### 4. `getBudgetStatus`

```solidity
function getBudgetStatus(uint256 budgetId) external view returns (Budget memory) {
    if (budgets[budgetId].totalAllocation == 0) revert BudgetNotFound();
    return budgets[budgetId];
}
```

**Access:** Public view (no restrictions). Reverts with `BudgetNotFound()` if the budget doesn't exist.

**Returns:** The full `Budget` struct. Frontend reads this to display budget cards on the dashboard.

---

## Full Contract Skeleton

```solidity
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

    constructor(address _treasuryVault, address _usdc, address _admin) { /* ... */ }

    function createBudget(string calldata name, address departmentHead, uint256 totalAllocation, uint256 periodEnd)
        external onlyRole(CFO_ROLE) returns (uint256) { /* ... */ }

    function spendFromBudget(uint256 budgetId, uint256 amount, bytes32 paymentRef)
        external nonReentrant whenNotPaused { /* ... */ }

    function reallocate(uint256 fromBudgetId, uint256 toBudgetId, uint256 amount)
        external onlyRole(CFO_ROLE) { /* ... */ }

    function getBudgetStatus(uint256 budgetId) external view returns (Budget memory) { /* ... */ }

    function pause() external onlyRole(CFO_ROLE) { _pause(); }
    function unpause() external onlyRole(CFO_ROLE) { _unpause(); }
}
```

---

## Test Cases (Foundry)

**File:** `packages/contracts/test/BudgetManager.t.sol`

All tests use `forge-std/Test.sol`. Set up a mock TreasuryVault and mock USDC (ERC-20) in `setUp()`.

### Test Setup

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/BudgetManager.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Minimal mock USDC
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public pure override returns (uint8) { return 6; }
}

// Minimal mock TreasuryVault that holds USDC and allows withdrawals
contract MockTreasuryVault {
    IERC20 public usdc;
    address public budgetManager;

    constructor(address _usdc) { usdc = IERC20(_usdc); }

    function setBudgetManager(address _bm) external { budgetManager = _bm; }

    function withdrawFunds(uint256 amount) external {
        require(msg.sender == budgetManager, "Not budget manager");
        usdc.transfer(budgetManager, amount);
    }
}

contract BudgetManagerTest is Test {
    BudgetManager public bm;
    MockUSDC public usdc;
    MockTreasuryVault public vault;

    address admin = address(0xA);
    address cfo = address(0xB);
    address deptHead1 = address(0xC);
    address deptHead2 = address(0xD);
    address randomUser = address(0xE);

    function setUp() public {
        usdc = new MockUSDC();
        vault = new MockTreasuryVault(address(usdc));
        bm = new BudgetManager(address(vault), address(usdc), admin);

        vault.setBudgetManager(address(bm));

        // Grant CFO role
        vm.prank(admin);
        bm.grantRole(bm.CFO_ROLE(), cfo);

        // Fund the vault with 1M USDC
        usdc.mint(address(vault), 1_000_000e6);
    }
    // ... tests below
}
```

### Individual Test Specifications

| # | Test Name | Description |
|---|---|---|
| 1 | `test_createBudget_setsFieldsCorrectly` | CFO creates a budget. Assert all struct fields match inputs. Assert `budgetCounter == 1`. Assert `BudgetCreated` event emitted with correct args. |
| 2 | `test_createBudget_onlyCFO` | Non-CFO address calls `createBudget`. Expect revert with AccessControl error. |
| 3 | `test_spendFromBudget_deductsCorrectly` | Department head spends 10,000 USDC from a 500,000 USDC budget. Assert `b.spent == 10_000e6`. Assert department head's USDC balance increased by 10,000e6. |
| 4 | `test_spendFromBudget_onlyDepartmentHead` | Random address calls `spendFromBudget`. Expect revert `UnauthorizedDepartmentHead()`. |
| 5 | `test_spendFromBudget_revertsIfExceedsBudget` | Department head tries to spend more than `totalAllocation - spent`. Expect revert `ExceedsAllocation()`. |
| 6 | `test_spendFromBudget_revertsIfPeriodExpired` | Warp time past `periodEnd`. Call `spendFromBudget`. Expect revert `BudgetExpired()`. Use `vm.warp(block.timestamp + 366 days)`. |
| 7 | `test_spendFromBudget_revertsIfInactive` | Admin deactivates budget (set `b.active = false` — may need a setter or direct storage manipulation via `vm.store`). Call `spendFromBudget`. Expect revert `BudgetNotActive()`. |
| 8 | `test_spendFromBudget_pullsFromTreasuryVault` | After a successful spend, assert vault's USDC balance decreased by the spend amount. Assert the BudgetManager contract's USDC balance is 0 (it forwarded everything). |
| 9 | `test_reallocate_movesAllocation` | CFO creates two budgets (A: 500K, B: 200K). Reallocate 100K from A to B. Assert A.totalAllocation == 400K, B.totalAllocation == 300K. Assert `BudgetReallocated` event emitted. |
| 10 | `test_reallocate_onlyCFO` | Non-CFO calls `reallocate`. Expect revert. |
| 11 | `test_reallocate_revertsIfInsufficientUnspent` | Budget A has 500K total, 450K spent (50K remaining). Try to reallocate 100K. Expect revert `InsufficientUnspent()`. |
| 12 | `test_getBudgetStatus_returnsCorrectData` | Create a budget, spend some, then call `getBudgetStatus`. Assert returned struct matches expected state. |

---

## Files to Create / Modify

| File | Action |
|---|---|
| `packages/contracts/src/BudgetManager.sol` | **Create** — full contract implementation |
| `packages/contracts/test/BudgetManager.t.sol` | **Create** — full Foundry test suite |

---

## Cross-References

| Document | Relationship |
|---|---|
| `docs/technical/02-treasury-vault-contract.md` | `spendFromBudget` calls `TreasuryVault.withdrawFunds()`. The vault must authorize BudgetManager to pull funds. |
| `docs/technical/05-access-control-contract.md` | `CFO_ROLE` constant definition and role hierarchy. |
| `docs/frontend/03-dashboard-page.md` | The dashboard displays budget cards by calling `getBudgetStatus` for each budget and querying the `Budget` table in Prisma. |
| `docs/technical/06-database-schema.md` | The `Budget` Prisma model mirrors on-chain state with `onChainId` linking to `budgetId`. |
| `docs/technical/07-api-routes.md` | API routes `/api/budgets` query the Prisma `Budget` model and may call `getBudgetStatus` on-chain for real-time data. |

---

## Implementation Notes

1. **USDC Decimals:** USDC uses 6 decimals. All `amount` and `allocation` values are in the smallest unit (e.g., `500_000e6` = $500,000).
2. **TreasuryVault Authorization:** The TreasuryVault contract must recognize BudgetManager as an authorized caller for `withdrawFunds`. This likely means granting BudgetManager the `TREASURY_MANAGER_ROLE` on the vault, or the vault's `withdrawFunds` must have a specific allowance for BudgetManager.
3. **No On-Chain Deactivation Function:** The current spec does not include a `deactivateBudget` function. If needed, add one gated by `CFO_ROLE` that sets `b.active = false`. For the hackathon, the admin can use direct storage or the budget simply expires via `periodEnd`.
4. **Pause Scope:** `whenNotPaused` only applies to `spendFromBudget`. Budget creation and reallocation remain available even when paused (the CFO may need to restructure during an emergency).
