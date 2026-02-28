# 02 — TreasuryVault.sol Specification

> **Scope:** Implement, test, and deploy the core vault contract that manages
> USDC/USYC allocation with automatic sweep-to-yield logic.
>
> **Audience:** Any agent or developer implementing the TreasuryVault smart
> contract. This document is self-contained and includes every signature,
> modifier, event, and test case needed.

---

## Table of Contents

1. [Purpose & Overview](#1-purpose--overview)
2. [Contract Metadata](#2-contract-metadata)
3. [Imports](#3-imports)
4. [Constructor](#4-constructor)
5. [State Variables](#5-state-variables)
6. [Roles](#6-roles)
7. [Events](#7-events)
8. [IUSYC Interface](#8-iusyc-interface)
9. [Functions](#9-functions)
10. [Internal Helpers](#10-internal-helpers)
11. [Error Definitions](#11-error-definitions)
12. [Full Contract Skeleton](#12-full-contract-skeleton)
13. [Test Cases](#13-test-cases)
14. [Files to Create/Modify](#14-files-to-createmodify)
15. [Cross-references](#15-cross-references)

---

## 1. Purpose & Overview

The **TreasuryVault** is the central liquidity management primitive in
ArcVault. It holds the organization's USDC and automatically sweeps excess
liquidity into USYC (a yield-bearing stablecoin wrapper) whenever the vault's
USDC balance exceeds a configurable threshold. When payouts or withdrawals
require more USDC than is immediately liquid, the vault redeems USYC
on-the-fly to cover the shortfall.

**Key invariant:** At any point in time,
`getTotalValue() == usdc.balanceOf(vault) + usyc.balanceOf(vault) * exchangeRate`.

**Flow diagram:**

```
Depositor                     TreasuryVault                  USYC Protocol
   │  depositFunds(amount)         │                              │
   │ ─────────────────────────────>│                              │
   │                               │  if balance > threshold      │
   │                               │  ──── _sweepToUSYC() ──────>│
   │                               │                              │
   │                               │  withdrawFunds(amount)       │
   │ <─────────────────────────────│                              │
   │                               │  if shortfall                │
   │                               │  ──── redeemFromUSYC() ────>│
```

---

## 2. Contract Metadata

| Field | Value |
|-------|-------|
| File | `packages/contracts/src/TreasuryVault.sol` |
| Solidity | `^0.8.20` |
| License | `MIT` |
| Inherits | `AccessControl`, `Pausable`, `ReentrancyGuard` |

---

## 3. Imports

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IUSYC.sol";
```

---

## 4. Constructor

```solidity
constructor(
    address _usdc,
    address _usyc,
    uint256 _initialLiquidityThreshold,
    address _admin
)
```

**Logic:**
1. Validate all addresses are non-zero.
2. Validate `_initialLiquidityThreshold > 0`.
3. Set state variables:
   - `usdc = _usdc`
   - `usyc = _usyc`
   - `liquidityThreshold = _initialLiquidityThreshold`
4. Grant roles to `_admin`:
   - `DEFAULT_ADMIN_ROLE`
   - `CFO_ROLE`
   - `TREASURY_MANAGER_ROLE`

---

## 5. State Variables

```solidity
using SafeERC20 for IERC20;

address public usdc;
address public usyc;
uint256 public liquidityThreshold;

// Track cumulative deposits for yield calculation
uint256 public totalDeposited;
uint256 public totalWithdrawn;
```

---

## 6. Roles

```solidity
bytes32 public constant CFO_ROLE = keccak256("CFO_ROLE");
bytes32 public constant TREASURY_MANAGER_ROLE = keccak256("TREASURY_MANAGER_ROLE");
```

| Role | Capabilities |
|------|-------------|
| `DEFAULT_ADMIN_ROLE` | Grant/revoke all roles, pause/unpause |
| `CFO_ROLE` | `setLiquidityThreshold` |
| `TREASURY_MANAGER_ROLE` | `withdrawFunds` |

> Full role hierarchy is documented in `docs/technical/05-access-control-contract.md`.

---

## 7. Events

```solidity
event Deposited(address indexed user, uint256 amount);
event Withdrawn(address indexed user, uint256 amount);
event SweptToUSYC(uint256 amount);
event RedeemedFromUSYC(uint256 amount);
event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
```

---

## 8. IUSYC Interface

### `packages/contracts/src/interfaces/IUSYC.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IUSYC
 * @notice Interface for the USYC yield-bearing stablecoin protocol.
 *         USYC accepts USDC deposits and mints USYC tokens at a variable
 *         exchange rate that accrues yield over time.
 */
interface IUSYC {
    /**
     * @notice Deposit USDC and receive USYC tokens.
     * @param usdcAmount The amount of USDC to deposit.
     * @return usycMinted The amount of USYC tokens minted.
     */
    function deposit(uint256 usdcAmount) external returns (uint256 usycMinted);

    /**
     * @notice Redeem USYC tokens for USDC.
     * @param usycAmount The amount of USYC to redeem.
     * @return usdcReturned The amount of USDC returned.
     */
    function redeem(uint256 usycAmount) external returns (uint256 usdcReturned);

    /**
     * @notice Returns the USYC balance of an account.
     * @param account The address to query.
     * @return The USYC balance.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @notice Returns the current USYC-to-USDC exchange rate (18 decimals).
     *         A rate of 1.05e18 means 1 USYC = 1.05 USDC.
     * @return The exchange rate.
     */
    function exchangeRate() external view returns (uint256);
}
```

---

## 9. Functions

### 9.1 `depositFunds`

```solidity
function depositFunds(uint256 amount) external nonReentrant whenNotPaused
```

**Modifiers:** `nonReentrant`, `whenNotPaused`

**Logic:**
1. Require `amount > 0` -- revert with `InvalidAmount()`.
2. `IERC20(usdc).safeTransferFrom(msg.sender, address(this), amount)`.
3. `totalDeposited += amount`.
4. Check if auto-sweep is needed:
   ```solidity
   if (IERC20(usdc).balanceOf(address(this)) > liquidityThreshold) {
       _sweepToUSYC();
   }
   ```
5. Emit `Deposited(msg.sender, amount)`.

**Access:** Open to any address (no role required). The depositor must have
approved the vault for at least `amount` USDC.

---

### 9.2 `withdrawFunds`

```solidity
function withdrawFunds(uint256 amount)
    external
    onlyRole(TREASURY_MANAGER_ROLE)
    nonReentrant
    whenNotPaused
```

**Modifiers:** `onlyRole(TREASURY_MANAGER_ROLE)`, `nonReentrant`, `whenNotPaused`

**Logic:**
1. Require `amount > 0` -- revert with `InvalidAmount()`.
2. `uint256 liquid = IERC20(usdc).balanceOf(address(this))`.
3. If `liquid < amount`:
   ```solidity
   uint256 shortfall = amount - liquid;
   _redeemFromUSYC(shortfall);
   ```
4. `IERC20(usdc).safeTransfer(msg.sender, amount)`.
5. `totalWithdrawn += amount`.
6. Emit `Withdrawn(msg.sender, amount)`.

**Important:** The PayoutRouter contract calls this function. It must hold
`TREASURY_MANAGER_ROLE`.

---

### 9.3 `setLiquidityThreshold`

```solidity
function setLiquidityThreshold(uint256 newThreshold) external onlyRole(CFO_ROLE)
```

**Modifiers:** `onlyRole(CFO_ROLE)`

**Logic:**
1. Require `newThreshold > 0` -- revert with `InvalidAmount()`.
2. `uint256 old = liquidityThreshold`.
3. `liquidityThreshold = newThreshold`.
4. Call `_rebalance()` to immediately bring the vault in line with the new threshold.
5. Emit `ThresholdUpdated(old, newThreshold)`.

---

### 9.4 `sweepToUSYC`

```solidity
function sweepToUSYC() external nonReentrant whenNotPaused
```

**Modifiers:** `nonReentrant`, `whenNotPaused`

**Access:** Open to any address (no role required).

**Logic:**
1. `uint256 liquid = IERC20(usdc).balanceOf(address(this))`.
2. Require `liquid > liquidityThreshold` -- revert with `NothingToSweep()`.
3. `uint256 excess = liquid - liquidityThreshold`.
4. `IERC20(usdc).safeApprove(usyc, excess)`.
5. `IUSYC(usyc).deposit(excess)`.
6. Emit `SweptToUSYC(excess)`.

---

### 9.5 `redeemFromUSYC`

```solidity
function redeemFromUSYC(uint256 usdcAmount) external nonReentrant whenNotPaused
```

**Modifiers:** `nonReentrant`, `whenNotPaused`

**Access:** Open to any address (no role required).

**Logic:**
1. Require `amount > 0` -- revert with `InvalidAmount()`.
2. Calculate USYC amount needed:
   ```solidity
   uint256 rate = IUSYC(usyc).exchangeRate();
   uint256 usycNeeded = (amount * 1e18) / rate;
   ```
3. Require `IUSYC(usyc).balanceOf(address(this)) >= usycNeeded` -- revert with `InsufficientUSYC()`.
4. `IUSYC(usyc).redeem(usycNeeded)`.
5. Emit `RedeemedFromUSYC(amount)`.

---

### 9.6 `rebalance`

```solidity
function rebalance() external
```

**Modifiers:** None (public utility, gas paid by caller).

**Logic:** Delegates to `_rebalance()` internal function.

---

### 9.7 View Functions

```solidity
/// @notice Returns the vault's current liquid USDC balance.
function getLiquidBalance() external view returns (uint256) {
    return IERC20(usdc).balanceOf(address(this));
}

/// @notice Returns the vault's USYC token balance.
function getUSYCBalance() external view returns (uint256) {
    return IUSYC(usyc).balanceOf(address(this));
}

/// @notice Returns total value in USDC terms (liquid + USYC at exchange rate).
function getTotalValue() external view returns (uint256) {
    uint256 liquid = IERC20(usdc).balanceOf(address(this));
    uint256 usycBal = IUSYC(usyc).balanceOf(address(this));
    uint256 rate = IUSYC(usyc).exchangeRate();
    return liquid + (usycBal * rate) / 1e18;
}

/// @notice Returns yield accrued = totalValue - (totalDeposited - totalWithdrawn).
function getYieldAccrued() external view returns (uint256) {
    uint256 totalValue = this.getTotalValue();
    uint256 principal = totalDeposited - totalWithdrawn;
    if (totalValue <= principal) return 0;
    return totalValue - principal;
}
```

---

### 9.8 Admin Functions

```solidity
function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _pause();
}

function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _unpause();
}
```

> **Note:** TreasuryVault gates `pause`/`unpause` with `DEFAULT_ADMIN_ROLE`, not
> `CFO_ROLE`. This differs from BudgetManager which uses `CFO_ROLE` for pause control.

---

## 10. Internal Helpers

```solidity
function _sweepToUSYC() internal {
    uint256 liquid = IERC20(usdc).balanceOf(address(this));
    if (liquid <= liquidityThreshold) return;
    uint256 excess = liquid - liquidityThreshold;
    IERC20(usdc).safeApprove(usyc, excess);
    IUSYC(usyc).deposit(excess);
    emit SweptToUSYC(excess);
}

function _redeemFromUSYC(uint256 usdcAmount) internal {
    uint256 rate = IUSYC(usyc).exchangeRate();
    uint256 usycNeeded = (usdcAmount * 1e18) / rate;
    IUSYC(usyc).redeem(usycNeeded);
    emit RedeemedFromUSYC(usdcAmount);
}

function _rebalance() internal {
    uint256 liquid = IERC20(usdc).balanceOf(address(this));
    if (liquid > liquidityThreshold) {
        _sweepToUSYC();
    } else if (liquid < liquidityThreshold) {
        uint256 deficit = liquidityThreshold - liquid;
        uint256 usycBal = IUSYC(usyc).balanceOf(address(this));
        uint256 rate = IUSYC(usyc).exchangeRate();
        uint256 maxRedeemable = (usycBal * rate) / 1e18;
        // Only redeem what we can
        uint256 redeemAmount = deficit > maxRedeemable ? maxRedeemable : deficit;
        if (redeemAmount > 0) {
            _redeemFromUSYC(redeemAmount);
        }
    }
}
```

---

## 11. Error Definitions

```solidity
error InvalidAmount();
error NothingToSweep();
error InsufficientUSYC();
error ZeroAddress();
```

---

## 12. Full Contract Skeleton

Below is the complete contract structure for reference. Implement each function
body as described in Section 9.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IUSYC.sol";

/**
 * @title TreasuryVault
 * @notice Core vault managing USDC/USYC allocation with auto-sweep logic.
 *         Excess USDC above the liquidity threshold is swept into USYC for
 *         yield. Withdrawals auto-redeem USYC when liquid USDC is insufficient.
 */
contract TreasuryVault is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Errors ──────────────────────────────────────────────
    error InvalidAmount();
    error NothingToSweep();
    error InsufficientUSYC();
    error ZeroAddress();

    // ─── Roles ───────────────────────────────────────────────
    bytes32 public constant CFO_ROLE = keccak256("CFO_ROLE");
    bytes32 public constant TREASURY_MANAGER_ROLE = keccak256("TREASURY_MANAGER_ROLE");

    // ─── State ───────────────────────────────────────────────
    address public usdc;
    address public usyc;
    uint256 public liquidityThreshold;
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;

    // ─── Events ──────────────────────────────────────────────
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event SweptToUSYC(uint256 amount);
    event RedeemedFromUSYC(uint256 amount);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    // ─── Constructor ─────────────────────────────────────────
    constructor(
        address _usdc,
        address _usyc,
        uint256 _initialLiquidityThreshold,
        address _admin
    ) {
        if (_usdc == address(0) || _usyc == address(0) || _admin == address(0))
            revert ZeroAddress();
        if (_initialLiquidityThreshold == 0) revert InvalidAmount();

        usdc = _usdc;
        usyc = _usyc;
        liquidityThreshold = _initialLiquidityThreshold;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(CFO_ROLE, _admin);
        _grantRole(TREASURY_MANAGER_ROLE, _admin);
    }

    // ─── External Functions ──────────────────────────────────

    function depositFunds(uint256 amount) external nonReentrant whenNotPaused {
        // See Section 9.1
    }

    function withdrawFunds(uint256 amount)
        external
        onlyRole(TREASURY_MANAGER_ROLE)
        nonReentrant
        whenNotPaused
    {
        // See Section 9.2
    }

    function setLiquidityThreshold(uint256 newThreshold) external onlyRole(CFO_ROLE) {
        // See Section 9.3
    }

    function sweepToUSYC() external nonReentrant whenNotPaused {
        // See Section 9.4
    }

    function redeemFromUSYC(uint256 usdcAmount) external nonReentrant whenNotPaused {
        // See Section 9.5
    }

    function rebalance() external {
        // See Section 9.6
    }

    // ─── View Functions ──────────────────────────────────────

    function getLiquidBalance() external view returns (uint256) {
        // See Section 9.7
    }

    function getUSYCBalance() external view returns (uint256) {
        // See Section 9.7
    }

    function getTotalValue() external view returns (uint256) {
        // See Section 9.7
    }

    function getYieldAccrued() external view returns (uint256) {
        // See Section 9.7
    }

    // ─── Admin ───────────────────────────────────────────────

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ─── Internal ────────────────────────────────────────────

    function _sweepToUSYC() internal {
        // See Section 10
    }

    function _redeemFromUSYC(uint256 usdcAmount) internal {
        // See Section 10
    }

    function _rebalance() internal {
        // See Section 10
    }
}
```

---

## 13. Test Cases

All tests use Foundry's `forge-std/Test.sol`. A mock USDC (standard ERC20) and
a mock USYC contract should be deployed in `setUp()`.

### Test File: `packages/contracts/test/TreasuryVault.t.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TreasuryVault.sol";
// Import mock contracts (MockUSDC, MockUSYC)
```

### Mock Contracts Needed

**MockUSDC:** Standard ERC20 with public `mint(address, uint256)`.

**MockUSYC:** Implements `IUSYC` interface.
- `deposit()`: transfers USDC from caller, mints USYC at `exchangeRate`.
- `redeem()`: burns USYC, transfers USDC back.
- `exchangeRate()`: returns configurable rate (default `1.05e18`).
- `balanceOf()`: standard balance tracking.

### Test List

| # | Test Name | Description |
|---|-----------|-------------|
| 1 | `test_depositFunds_transfersUSDC` | Deposit 1000 USDC, verify vault balance increases by 1000 |
| 2 | `test_depositFunds_autoSweepsWhenOverThreshold` | Set threshold to 500, deposit 1000. Verify 500 USDC remains liquid, rest swept to USYC |
| 3 | `test_depositFunds_emitsEvent` | Verify `Deposited` event is emitted with correct params |
| 4 | `test_depositFunds_revertsOnZeroAmount` | Call with 0, expect `InvalidAmount()` revert |
| 5 | `test_withdrawFunds_directTransfer` | Vault has 1000 USDC liquid, withdraw 500. Verify caller receives 500 |
| 6 | `test_withdrawFunds_redeemsToCoverShortfall` | Vault has 200 USDC + 1000 USYC. Withdraw 500. Verify 300 redeemed from USYC |
| 7 | `test_withdrawFunds_onlyTreasuryManager` | Call from non-manager, expect access control revert |
| 8 | `test_withdrawFunds_emitsEvent` | Verify `Withdrawn` event |
| 9 | `test_setLiquidityThreshold_updatesAndRebalances` | Change threshold from 1000 to 500 with 1000 USDC liquid. Verify 500 swept to USYC |
| 10 | `test_setLiquidityThreshold_onlyCFO` | Call from non-CFO, expect revert |
| 11 | `test_setLiquidityThreshold_emitsEvent` | Verify `ThresholdUpdated` event |
| 12 | `test_sweepToUSYC_calculatesExcessCorrectly` | 800 USDC, threshold 300. Verify 500 swept |
| 13 | `test_sweepToUSYC_revertsWhenBelowThreshold` | 200 USDC, threshold 500. Expect `NothingToSweep()` |
| 14 | `test_redeemFromUSYC_convertsBack` | Redeem 500 worth of USYC. Verify USDC balance increases |
| 15 | `test_rebalance_sweepsExcess` | 1000 USDC, threshold 400. Call rebalance. Verify 600 swept |
| 16 | `test_rebalance_redeemsDeficit` | 200 USDC + USYC, threshold 500. Call rebalance. Verify 300 redeemed |
| 17 | `test_rebalance_noop_whenBalanced` | USDC == threshold. Call rebalance. Verify no events emitted |
| 18 | `test_getLiquidBalance_returnsCorrectValue` | Deposit 1000, verify `getLiquidBalance() == 1000` |
| 19 | `test_getTotalValue_includesUSYCAtExchangeRate` | 500 USDC + 500 USYC at 1.05 rate. Verify total == 500 + 525 = 1025 |
| 20 | `test_getYieldAccrued_calculatesCorrectly` | Deposit 1000, USYC accrues 5%. Verify yield == 50 (approx) |
| 21 | `test_pausable_blocksDepositsWhenPaused` | Pause contract, attempt deposit. Expect revert |
| 22 | `test_pausable_blocksWithdrawalsWhenPaused` | Pause contract, attempt withdrawal. Expect revert |
| 23 | `test_constructor_revertsOnZeroAddress` | Pass zero address for USDC. Expect `ZeroAddress()` revert |

### Test Setup Pattern

```solidity
contract TreasuryVaultTest is Test {
    TreasuryVault vault;
    MockUSDC usdc;
    MockUSYC usyc;

    address admin = address(1);
    address depositor = address(2);
    address manager = address(3);
    address cfo = address(4);
    address unauthorized = address(5);

    uint256 constant INITIAL_THRESHOLD = 1000e6; // 1000 USDC (6 decimals)
    uint256 constant INITIAL_MINT = 10_000e6;

    function setUp() public {
        usdc = new MockUSDC();
        usyc = new MockUSYC(address(usdc));

        vault = new TreasuryVault(
            address(usdc),
            address(usyc),
            INITIAL_THRESHOLD,
            admin
        );

        // Grant specific roles
        vm.startPrank(admin);
        vault.grantRole(vault.TREASURY_MANAGER_ROLE(), manager);
        vault.grantRole(vault.CFO_ROLE(), cfo);
        vm.stopPrank();

        // Mint USDC to depositor
        usdc.mint(depositor, INITIAL_MINT);

        // Approve vault
        vm.prank(depositor);
        usdc.approve(address(vault), type(uint256).max);
    }
}
```

---

## 14. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/contracts/src/TreasuryVault.sol` | **Create** | Main vault contract |
| `packages/contracts/src/interfaces/IUSYC.sol` | **Create** | USYC protocol interface |
| `packages/contracts/test/TreasuryVault.t.sol` | **Create** | Full Foundry test suite |
| `packages/contracts/test/mocks/MockUSDC.sol` | **Create** | Mock ERC20 for testing |
| `packages/contracts/test/mocks/MockUSYC.sol` | **Create** | Mock USYC for testing |

---

## 15. Cross-references

| Document | Relevance |
|----------|-----------|
| `docs/technical/05-access-control-contract.md` | Full role hierarchy (CFO_ROLE, TREASURY_MANAGER_ROLE, etc.) |
| `docs/technical/03-payout-router-contract.md` | PayoutRouter calls `withdrawFunds()` -- must hold TREASURY_MANAGER_ROLE |
| `docs/technical/04-budget-manager-contract.md` | BudgetManager calls `withdrawFunds()` via `spendFromBudget` |
| `docs/technical/01-monorepo-setup.md` | Foundry configuration, OpenZeppelin installation |
| `docs/technical/09-deployment.md` | Deployment script and constructor arguments for production |
