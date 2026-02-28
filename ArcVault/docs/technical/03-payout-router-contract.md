# 03 — PayoutRouter.sol Specification

> **Scope:** Implement, test, and deploy the PayoutRouter contract that
> orchestrates the full payout pipeline: liquidity check, USYC redemption, FX
> conversion, and settlement.
>
> **Audience:** Any agent or developer implementing the PayoutRouter smart
> contract. This document is self-contained and includes every signature,
> modifier, event, struct, enum, and test case needed.

---

## Table of Contents

1. [Purpose & Overview](#1-purpose--overview)
2. [Contract Metadata](#2-contract-metadata)
3. [Imports](#3-imports)
4. [Constructor](#4-constructor)
5. [State Variables](#5-state-variables)
6. [Structs & Enums](#6-structs--enums)
7. [Roles](#7-roles)
8. [Events](#8-events)
9. [IStableFX Interface](#9-istablefx-interface)
10. [Functions](#10-functions)
11. [Error Definitions](#11-error-definitions)
12. [Full Contract Skeleton](#12-full-contract-skeleton)
13. [Test Cases](#13-test-cases)
14. [Files to Create/Modify](#14-files-to-createmodify)
15. [Cross-references](#15-cross-references)

---

## 1. Purpose & Overview

The **PayoutRouter** is the orchestration layer for all outbound payments in
ArcVault. When a payout is initiated, the router:

1. Creates a `Payout` record with status `Pending`.
2. Pulls USDC from the `TreasuryVault` (which auto-redeems USYC if needed).
3. If the target currency differs from USDC, requests an FX quote from the
   `StableFX` adapter and executes the swap.
4. Transfers the final tokens to the recipient.
5. Marks the payout as `Completed`.

Batch payouts iterate through the same pipeline for each recipient.

**Flow diagram:**

```
AP Manager                 PayoutRouter          TreasuryVault      StableFX
   │  executePayout()           │                      │               │
   │ ──────────────────────────>│                      │               │
   │                            │  withdrawFunds()     │               │
   │                            │ ────────────────────>│               │
   │                            │       USDC           │               │
   │                            │ <────────────────────│               │
   │                            │                      │               │
   │                            │  (if FX needed)      │               │
   │                            │  requestQuote()      │               │
   │                            │ ─────────────────────────────────────>│
   │                            │  executeSwap()       │               │
   │                            │ ─────────────────────────────────────>│
   │                            │       tokens         │               │
   │                            │ <─────────────────────────────────────│
   │                            │                      │               │
   │                            │  transfer to recipient               │
   │       payoutId             │                      │               │
   │ <──────────────────────────│                      │               │
```

---

## 2. Contract Metadata

| Field | Value |
|-------|-------|
| File | `packages/contracts/src/PayoutRouter.sol` |
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
import "./interfaces/IStableFX.sol";
```

Additionally, the contract needs to call into `TreasuryVault`, so it must
import or define a minimal interface:

```solidity
interface ITreasuryVault {
    function withdrawFunds(uint256 amount) external;
}
```

---

## 4. Constructor

```solidity
constructor(
    address _treasuryVault,
    address _stableFX,
    address _budgetManager,
    address _usdc,
    address _admin
)
```

**Logic:**
1. Validate all addresses are non-zero (`revert ZeroAddress()` on failure).
2. Set state variables:
   - `treasuryVault = ITreasuryVault(_treasuryVault)`
   - `stableFX = IStableFX(_stableFX)`
   - `budgetManager = _budgetManager`
   - `usdc = _usdc`
   > **Note:** The code does **not** validate `_budgetManager` for zero address.
3. Grant roles to `_admin`:
   - `DEFAULT_ADMIN_ROLE`
   - `AP_MANAGER_ROLE`
   - `OPERATOR_ROLE`

---

## 5. State Variables

```solidity
using SafeERC20 for IERC20;

ITreasuryVault public treasuryVault;
IStableFX public stableFX;
address public budgetManager;
address public usdc;

mapping(uint256 => Payout) public payouts;
uint256 public payoutCounter;
```

> **Note:** `treasuryVault` and `stableFX` are stored as their interface types
> rather than raw `address`. This enables direct method calls without casting.

---

## 6. Structs & Enums

```solidity
enum PayoutStatus {
    Pending,      // 0 — Created, not yet processed
    Processing,   // 1 — Funds being pulled from vault
    Converting,   // 2 — FX conversion in progress
    Settling,     // 3 — Final transfer in progress
    Completed,    // 4 — Successfully delivered
    Failed        // 5 — Reverted or timed out
}

struct Payout {
    address recipient;         // Final recipient address
    uint256 amount;            // USDC amount (before FX conversion)
    address targetCurrency;    // Token address of target currency (usdc if no FX)
    bytes32 paymentRef;         // External reference (invoice ID, PO number, etc.)
    PayoutStatus status;       // Current status
    uint256 timestamp;         // Block timestamp when created
    uint256 outputAmount;      // Final amount in target currency (set after FX)
}
```

**Notes on `targetCurrency`:**
- If `targetCurrency == usdc`, no FX conversion is performed. The USDC is sent
  directly to the recipient.
- If `targetCurrency != usdc`, the router calls StableFX to convert. The
  `targetCurrency` address represents the on-chain stablecoin for the target
  fiat (e.g., an address for EURC, GBPT, JPYC, etc.).

**Notes on `paymentRef`:**
- A `bytes32` value that the caller uses to correlate the on-chain payout with
  off-chain records (invoice numbers, purchase orders, etc.).
- The contract does not validate uniqueness; that is the caller's
  responsibility.

---

## 7. Roles

```solidity
bytes32 public constant AP_MANAGER_ROLE = keccak256("AP_MANAGER_ROLE");
bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
```

| Role | Capabilities |
|------|-------------|
| `DEFAULT_ADMIN_ROLE` | Grant/revoke all roles, pause/unpause |
| `AP_MANAGER_ROLE` | `executePayout`, `batchPayout` |
| `OPERATOR_ROLE` | `updatePayoutStatus` (for manual status corrections / off-chain settlement tracking) |

> Full role hierarchy is documented in `docs/technical/05-access-control-contract.md`.

---

## 8. Events

```solidity
event PayoutCreated(
    uint256 indexed payoutId,
    address indexed recipient,
    uint256 amount,
    address targetCurrency
);

event PayoutStatusUpdated(
    uint256 indexed payoutId,
    PayoutStatus oldStatus,
    PayoutStatus newStatus
);

event PayoutCompleted(
    uint256 indexed payoutId,
    uint256 outputAmount
);
```

---

## 9. IStableFX Interface

### `packages/contracts/src/interfaces/IStableFX.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IStableFX
 * @notice Interface for the StableFX on-chain FX adapter.
 *         Provides quote-then-execute two-phase FX conversion between
 *         stablecoins (e.g., USDC -> EURC).
 *
 *         In production, this wraps a backend FX API. In mock mode, it
 *         returns deterministic rates for testing.
 */
interface IStableFX {
    /**
     * @notice Request a quote for converting one stablecoin to another.
     * @param fromToken The source token address (e.g., USDC).
     * @param toToken The target token address (e.g., EURC).
     * @param amount The amount of fromToken to convert.
     * @return quoteId Unique identifier for this quote.
     * @return outputAmount The expected amount of toToken.
     * @return expiry Timestamp after which the quote is invalid.
     */
    function requestQuote(
        address fromToken,
        address toToken,
        uint256 amount
    ) external returns (
        bytes32 quoteId,
        uint256 outputAmount,
        uint256 expiry
    );

    /**
     * @notice Execute a previously requested quote.
     * @dev The caller must have approved this contract for the fromToken amount.
     *      Reverts if the quote has expired.
     * @param quoteId The quote identifier from requestQuote().
     * @return outputAmount The actual amount of toToken transferred.
     */
    function executeSwap(bytes32 quoteId) external returns (uint256 outputAmount);
}
```

---

## 10. Functions

### 10.1 `executePayout`

```solidity
function executePayout(
    address recipient,
    uint256 amount,
    address targetCurrency,
    bytes32 paymentRef
)
    external
    onlyRole(AP_MANAGER_ROLE)
    nonReentrant
    whenNotPaused
    returns (uint256 payoutId)
```

**Modifiers:** `onlyRole(AP_MANAGER_ROLE)`, `nonReentrant`, `whenNotPaused`

**Logic:**

1. **Validate inputs:**
   - `recipient != address(0)` -- revert `ZeroAddress()`
   - `amount > 0` -- revert `InvalidAmount()`
   - `targetCurrency != address(0)` -- revert `ZeroAddress()`

2. **Create payout record:**
   ```solidity
   payoutId = ++payoutCounter;
   payouts[payoutId] = Payout({
       recipient: recipient,
       amount: amount,
       targetCurrency: targetCurrency,
       paymentRef: paymentRef,
       status: PayoutStatus.Pending,
       timestamp: block.timestamp,
       outputAmount: 0
   });
   ```

3. **Pull funds from TreasuryVault:**
   ```solidity
   payouts[payoutId].status = PayoutStatus.Processing;
   ITreasuryVault(treasuryVault).withdrawFunds(amount);
   ```
   The TreasuryVault will auto-redeem USYC if liquid USDC is insufficient.

4. **FX conversion (if needed):**
   ```solidity
   uint256 finalAmount;
   if (targetCurrency == usdc || targetCurrency == address(0)) {
       // No conversion needed; address(0) treated as USDC
       finalAmount = amount;
   } else {
       payouts[payoutId].status = PayoutStatus.Converting;

       // Approve StableFX to spend our USDC
       IERC20(usdc).forceApprove(address(stableFX), amount);

       // Request quote and execute swap
       (bytes32 quoteId,,) = stableFX.requestQuote(usdc, targetCurrency, amount);
       finalAmount = stableFX.executeSwap(quoteId);
   }
   ```

5. **Transfer to recipient:**
   ```solidity
   payouts[payoutId].status = PayoutStatus.Settling;
   IERC20(targetCurrency).safeTransfer(recipient, finalAmount);
   ```

6. **Finalize:**
   ```solidity
   payouts[payoutId].status = PayoutStatus.Completed;
   payouts[payoutId].outputAmount = finalAmount;
   emit PayoutCreated(payoutId, recipient, amount, targetCurrency);
   emit PayoutCompleted(payoutId, finalAmount);
   ```

7. Return `payoutId`.

---

### 10.2 `batchPayout`

```solidity
function batchPayout(
    address[] calldata recipients,
    uint256[] calldata amounts,
    address[] calldata targetCurrencies,
    bytes32[] calldata paymentRefs
)
    external
    onlyRole(AP_MANAGER_ROLE)
    nonReentrant
    whenNotPaused
    returns (uint256[] memory payoutIds)
```

**Modifiers:** `onlyRole(AP_MANAGER_ROLE)`, `nonReentrant`, `whenNotPaused`

**Logic:**

1. **Validate array lengths match:**
   ```solidity
   uint256 len = recipients.length;
   if (
       len != amounts.length ||
       len != targetCurrencies.length ||
       len != paymentRefs.length
   ) revert ArrayLengthMismatch();
   if (len == 0) revert EmptyBatch();
   ```

2. **Process each payout:**
   ```solidity
   payoutIds = new uint256[](len);
   for (uint256 i = 0; i < len; ) {
       payoutIds[i] = _executePayout(
           recipients[i],
           amounts[i],
           targetCurrencies[i],
           paymentRefs[i]
       );
       unchecked { ++i; }
   }
   ```

3. Return `payoutIds`.

**Implementation note:** Factor the core logic of `executePayout` into an
`internal _executePayout()` function. The public `executePayout` and
`batchPayout` both call it. This avoids code duplication.

---

### 10.3 `updatePayoutStatus`

```solidity
function updatePayoutStatus(
    uint256 payoutId,
    PayoutStatus newStatus
)
    external
    onlyRole(OPERATOR_ROLE)
```

**Modifiers:** `onlyRole(OPERATOR_ROLE)`

**Logic:**

1. Require payout exists:
   ```solidity
   if (payouts[payoutId].timestamp == 0) revert PayoutNotFound();
   ```

2. Record old status, update:
   ```solidity
   PayoutStatus oldStatus = payouts[payoutId].status;
   payouts[payoutId].status = newStatus;
   ```

3. Emit event:
   ```solidity
   emit PayoutStatusUpdated(payoutId, oldStatus, newStatus);
   ```

**Use case:** This function is primarily used by off-chain operators to update
status for payouts that involve off-chain settlement (e.g., marking a
cross-border wire as `Completed` after bank confirmation).

---

### 10.4 `getPayoutStatus`

```solidity
function getPayoutStatus(uint256 payoutId)
    external
    view
    returns (Payout memory)
```

**Logic:**

1. Require payout exists:
   ```solidity
   if (payouts[payoutId].timestamp == 0) revert PayoutNotFound();
   ```

2. Return the full `Payout` struct.

---

### 10.5 `getPayoutsByStatus`

```solidity
function getPayoutsByStatus(PayoutStatus status)
    external
    view
    returns (uint256[] memory matchingIds)
```

**Logic:** Iterate `1..payoutCounter`, collect IDs where `payouts[i].status == status`.

> **Note:** This is O(n) and suitable for the hackathon. A production version
> would use off-chain indexing.

---

### 10.6 `getPayoutCount`

```solidity
function getPayoutCount() external view returns (uint256)
```

**Logic:** Returns `payoutCounter`. Convenience helper for frontend/off-chain consumers.

---

### 10.7 Admin Functions

```solidity
function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _pause();
}

function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _unpause();
}

function updateTreasuryVault(address _newVault) external onlyRole(DEFAULT_ADMIN_ROLE) {
    if (_newVault == address(0)) revert ZeroAddress();
    treasuryVault = ITreasuryVault(_newVault);
}

function updateStableFX(address _newFX) external onlyRole(DEFAULT_ADMIN_ROLE) {
    if (_newFX == address(0)) revert ZeroAddress();
    stableFX = IStableFX(_newFX);
}
```

---

## 11. Error Definitions

```solidity
error ZeroAddress();
error InvalidAmount();
error PayoutNotFound();
error ArrayLengthMismatch();
error EmptyBatch();
error PayoutAlreadyCompleted();
```

---

## 12. Full Contract Skeleton

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IStableFX.sol";

interface ITreasuryVault {
    function withdrawFunds(uint256 amount) external;
}

/**
 * @title PayoutRouter
 * @notice Orchestrates the payout pipeline: liquidity pull, optional FX
 *         conversion via StableFX, and settlement to recipients.
 */
contract PayoutRouter is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Errors ──────────────────────────────────────────────
    error ZeroAddress();
    error InvalidAmount();
    error PayoutNotFound();
    error ArrayLengthMismatch();
    error EmptyBatch();
    error PayoutAlreadyCompleted();

    // ─── Enums & Structs ─────────────────────────────────────
    enum PayoutStatus {
        Pending,
        Processing,
        Converting,
        Settling,
        Completed,
        Failed
    }

    struct Payout {
        address recipient;
        uint256 amount;
        address targetCurrency;
        bytes32 paymentRef;
        PayoutStatus status;
        uint256 timestamp;
        uint256 outputAmount;
    }

    // ─── Roles ───────────────────────────────────────────────
    bytes32 public constant AP_MANAGER_ROLE = keccak256("AP_MANAGER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ─── State ───────────────────────────────────────────────
    ITreasuryVault public treasuryVault;
    IStableFX public stableFX;
    address public budgetManager;
    address public usdc;

    mapping(uint256 => Payout) public payouts;
    uint256 public payoutCounter;

    // ─── Events ──────────────────────────────────────────────
    event PayoutCreated(
        uint256 indexed payoutId,
        address indexed recipient,
        uint256 amount,
        address targetCurrency
    );
    event PayoutStatusUpdated(
        uint256 indexed payoutId,
        PayoutStatus oldStatus,
        PayoutStatus newStatus
    );
    event PayoutCompleted(
        uint256 indexed payoutId,
        uint256 outputAmount
    );

    // ─── Constructor ─────────────────────────────────────────
    constructor(
        address _treasuryVault,
        address _stableFX,
        address _budgetManager,
        address _usdc,
        address _admin
    ) {
        if (_treasuryVault == address(0)) revert ZeroAddress();
        if (_stableFX == address(0)) revert ZeroAddress();
        if (_usdc == address(0)) revert ZeroAddress();
        if (_admin == address(0)) revert ZeroAddress();

        treasuryVault = ITreasuryVault(_treasuryVault);
        stableFX = IStableFX(_stableFX);
        budgetManager = _budgetManager;
        usdc = _usdc;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(AP_MANAGER_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
    }

    // ─── External Functions ──────────────────────────────────

    function executePayout(
        address recipient,
        uint256 amount,
        address targetCurrency,
        bytes32 paymentRef
    )
        external
        onlyRole(AP_MANAGER_ROLE)
        nonReentrant
        whenNotPaused
        returns (uint256 payoutId)
    {
        payoutId = _executePayout(recipient, amount, targetCurrency, paymentRef);
    }

    function batchPayout(
        address[] calldata recipients,
        uint256[] calldata amounts,
        address[] calldata targetCurrencies,
        bytes32[] calldata paymentRefs
    )
        external
        onlyRole(AP_MANAGER_ROLE)
        nonReentrant
        whenNotPaused
        returns (uint256[] memory payoutIds)
    {
        // See Section 10.2
    }

    function updatePayoutStatus(
        uint256 payoutId,
        PayoutStatus newStatus
    )
        external
        onlyRole(OPERATOR_ROLE)
    {
        // See Section 10.3
    }

    function getPayoutStatus(uint256 payoutId)
        external
        view
        returns (Payout memory)
    {
        // See Section 10.4
    }

    function getPayoutsByStatus(PayoutStatus status)
        external
        view
        returns (uint256[] memory matchingIds)
    {
        // See Section 10.5
    }

    // ─── Admin ───────────────────────────────────────────────

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function updateTreasuryVault(address _newVault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_newVault == address(0)) revert ZeroAddress();
        treasuryVault = ITreasuryVault(_newVault);
    }

    function updateStableFX(address _newFX) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_newFX == address(0)) revert ZeroAddress();
        stableFX = IStableFX(_newFX);
    }

    // ─── Internal ────────────────────────────────────────────

    function _executePayout(
        address recipient,
        uint256 amount,
        address targetCurrency,
        bytes32 paymentRef
    ) internal returns (uint256 payoutId) {
        // See Section 10.1 for full logic
    }
}
```

---

## 13. Test Cases

All tests use Foundry's `forge-std/Test.sol`. Mock contracts are required for
TreasuryVault, StableFX, USDC, and a target currency token (e.g., MockEURC).

### Test File: `packages/contracts/test/PayoutRouter.t.sol`

### Mock Contracts Needed

**MockTreasuryVault:**
- Implements `withdrawFunds(uint256)`.
- On call: transfers `amount` of MockUSDC to `msg.sender` (the PayoutRouter).
- Tracks call count and last amount for assertions.

**MockStableFX:**
- Implements `IStableFX`.
- `requestQuote()`: Returns a deterministic `quoteId`, applies a fixed FX rate
  (e.g., 0.92 for USDC -> EURC), returns `outputAmount` and `expiry`.
- `executeSwap()`: Transfers MockUSDC from caller, mints/transfers MockEURC to
  caller at the quoted rate.

**MockEURC:**
- Standard ERC20 with public `mint()`.
- Represents a Euro stablecoin for FX conversion tests.

### Test List

| # | Test Name | Description |
|---|-----------|-------------|
| 1 | `test_executePayout_createsAndCompletes` | Execute a USDC-to-USDC payout. Verify payout struct fields, status == Completed, recipient balance increased |
| 2 | `test_executePayout_withFXConversion` | Execute USDC-to-EURC payout. Verify StableFX was called, recipient received EURC, outputAmount set correctly |
| 3 | `test_executePayout_onlyAPManager` | Call from unauthorized address. Expect AccessControl revert |
| 4 | `test_executePayout_pullsFromVault` | Verify `TreasuryVault.withdrawFunds()` was called with correct amount |
| 5 | `test_executePayout_autoRedeemsUSYC` | Use a MockTreasuryVault that simulates USYC redemption. Verify payout still completes |
| 6 | `test_executePayout_incrementsCounter` | Execute 3 payouts. Verify payoutCounter == 3 and IDs are 1, 2, 3 |
| 7 | `test_executePayout_emitsEvents` | Verify both `PayoutCreated` and `PayoutCompleted` events are emitted with correct params |
| 8 | `test_executePayout_revertsZeroRecipient` | Pass `address(0)` as recipient. Expect `ZeroAddress()` |
| 9 | `test_executePayout_revertsZeroAmount` | Pass 0 as amount. Expect `InvalidAmount()` |
| 10 | `test_executePayout_setsTimestamp` | Verify `payout.timestamp == block.timestamp` |
| 11 | `test_batchPayout_processesAll` | Batch 3 payouts. Verify all 3 created, all Completed, correct amounts |
| 12 | `test_batchPayout_revertsMismatchedArrays` | Pass arrays of different lengths. Expect `ArrayLengthMismatch()` |
| 13 | `test_batchPayout_revertsEmptyBatch` | Pass empty arrays. Expect `EmptyBatch()` |
| 14 | `test_batchPayout_mixedCurrencies` | Batch with 2 USDC payouts + 1 EURC payout. Verify FX only called for the EURC one |
| 15 | `test_updatePayoutStatus_onlyOperator` | Call from non-operator. Expect revert |
| 16 | `test_updatePayoutStatus_updatesCorrectly` | Update status from Completed to Failed. Verify new status stored |
| 17 | `test_updatePayoutStatus_emitsEvent` | Verify `PayoutStatusUpdated` event with old and new status |
| 18 | `test_updatePayoutStatus_revertsNonexistentPayout` | Update payout ID 999. Expect `PayoutNotFound()` |
| 19 | `test_getPayoutStatus_returnsCorrectData` | Create payout, query it. Verify all struct fields match |
| 20 | `test_getPayoutStatus_revertsNonexistent` | Query non-existent ID. Expect `PayoutNotFound()` |
| 21 | `test_pausable_blocksPayoutsWhenPaused` | Pause, attempt executePayout. Expect revert |
| 22 | `test_pausable_blocksBatchPayoutsWhenPaused` | Pause, attempt batchPayout. Expect revert |
| 23 | `test_constructor_revertsOnZeroAddress` | Pass zero address for treasuryVault. Expect `ZeroAddress()` |
| 24 | `test_updateTreasuryVault_onlyAdmin` | Call from non-admin. Expect revert |
| 25 | `test_updateTreasuryVault_updatesAddress` | Admin updates vault address. Verify state changed |

### Test Setup Pattern

```solidity
contract PayoutRouterTest is Test {
    PayoutRouter router;
    MockTreasuryVault mockVault;
    MockStableFX mockFX;
    MockUSDC usdc;
    MockEURC eurc;

    address admin = address(1);
    address apManager = address(2);
    address operator = address(3);
    address recipient1 = address(4);
    address recipient2 = address(5);
    address unauthorized = address(6);

    uint256 constant PAYOUT_AMOUNT = 1000e6; // 1000 USDC

    function setUp() public {
        usdc = new MockUSDC();
        eurc = new MockEURC();
        mockVault = new MockTreasuryVault(address(usdc));
        mockFX = new MockStableFX(address(usdc), address(eurc));

        router = new PayoutRouter(
            address(mockVault),
            address(mockFX),
            address(0xBEEF),   // budgetManager placeholder
            address(usdc),
            admin
        );

        // Grant specific roles
        vm.startPrank(admin);
        router.grantRole(router.AP_MANAGER_ROLE(), apManager);
        router.grantRole(router.OPERATOR_ROLE(), operator);
        vm.stopPrank();

        // Fund the mock vault so withdrawFunds works
        usdc.mint(address(mockVault), 1_000_000e6);

        // Fund the mock FX so swaps work
        eurc.mint(address(mockFX), 1_000_000e6);
    }
}
```

### Example Test Implementation

```solidity
function test_executePayout_createsAndCompletes() public {
    vm.prank(apManager);
    uint256 payoutId = router.executePayout(
        recipient1,
        PAYOUT_AMOUNT,
        address(usdc),      // same currency, no FX
        bytes32("INV-001")
    );

    assertEq(payoutId, 1);
    assertEq(router.payoutCounter(), 1);

    PayoutRouter.Payout memory p = router.getPayoutStatus(payoutId);
    assertEq(p.recipient, recipient1);
    assertEq(p.amount, PAYOUT_AMOUNT);
    assertEq(p.targetCurrency, address(usdc));
    assertEq(p.paymentRef, bytes32("INV-001"));
    assertEq(uint8(p.status), uint8(PayoutRouter.PayoutStatus.Completed));
    assertEq(p.outputAmount, PAYOUT_AMOUNT);

    // Verify recipient received funds
    assertEq(usdc.balanceOf(recipient1), PAYOUT_AMOUNT);
}

function test_executePayout_withFXConversion() public {
    vm.prank(apManager);
    uint256 payoutId = router.executePayout(
        recipient1,
        PAYOUT_AMOUNT,
        address(eurc),       // FX conversion needed
        bytes32("INV-002")
    );

    PayoutRouter.Payout memory p = router.getPayoutStatus(payoutId);
    assertEq(uint8(p.status), uint8(PayoutRouter.PayoutStatus.Completed));
    assertTrue(p.outputAmount > 0);

    // Recipient should have EURC, not USDC
    assertGt(eurc.balanceOf(recipient1), 0);
}

function test_executePayout_onlyAPManager() public {
    vm.prank(unauthorized);
    vm.expectRevert();
    router.executePayout(
        recipient1,
        PAYOUT_AMOUNT,
        address(usdc),
        bytes32("INV-003")
    );
}
```

---

## 14. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/contracts/src/PayoutRouter.sol` | **Create** | Payout orchestration contract |
| `packages/contracts/src/interfaces/IStableFX.sol` | **Create** | StableFX adapter interface |
| `packages/contracts/test/PayoutRouter.t.sol` | **Create** | Full Foundry test suite |
| `packages/contracts/test/mocks/MockTreasuryVault.sol` | **Create** | Mock vault for testing |
| `packages/contracts/test/mocks/MockStableFX.sol` | **Create** | Mock FX adapter for testing |
| `packages/contracts/test/mocks/MockEURC.sol` | **Create** | Mock Euro stablecoin for FX tests |

> **Note:** `MockUSDC.sol` is shared with TreasuryVault tests and should
> already exist from `docs/technical/02-treasury-vault-contract.md`.

---

## 15. Cross-references

| Document | Relevance |
|----------|-----------|
| `docs/technical/02-treasury-vault-contract.md` | PayoutRouter calls `TreasuryVault.withdrawFunds()` -- vault must grant TREASURY_MANAGER_ROLE to the router |
| `docs/technical/05-access-control-contract.md` | Full role hierarchy, including AP_MANAGER_ROLE and OPERATOR_ROLE |
| `docs/technical/08-external-integrations.md` | StableFX backend adapter -- the on-chain IStableFX mirrors the off-chain API for the hackathon |
| `docs/technical/07-api-routes.md` | `/api/payouts` routes that call this contract from the frontend |
| `docs/technical/04-budget-manager-contract.md` | BudgetManager can trigger payouts via budget spend workflows |
| `docs/technical/01-monorepo-setup.md` | Foundry project structure, OpenZeppelin imports |
