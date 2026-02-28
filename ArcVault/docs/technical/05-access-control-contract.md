# 05 — ArcVaultAccessControl.sol + Mock Contracts Specification

> **Standalone implementation document.** An agent can implement all three contracts (ArcVaultAccessControl, MockUSYC, MockStableFX) using only the information in this file.

---

## Part A: ArcVaultAccessControl.sol

### Overview

| Field | Value |
|---|---|
| **Contract** | `ArcVaultAccessControl.sol` |
| **Purpose** | Lightweight base contract providing shared role constants and emergency pause/unpause for the ArcVault system. |
| **Solidity Version** | `^0.8.20` |
| **License** | MIT |
| **Location** | `packages/contracts/src/ArcVaultAccessControl.sol` |
| **Test File** | `packages/contracts/test/ArcVaultAccessControl.t.sol` |

### Design Rationale

For a hackathon-scoped project, each operational contract (TreasuryVault, PayoutRouter, BudgetManager) inherits from OpenZeppelin's `AccessControl` and `Pausable` directly and defines its own role constants. This `ArcVaultAccessControl` contract serves as:

1. A **reference implementation** of the shared role constants.
2. A **lightweight base** that contracts *may* inherit from to avoid re-declaring the same role bytes32 values.
3. A **standalone contract** that can be deployed if a centralized role registry is preferred.

Either approach (inheritance vs. standalone) is acceptable. The key requirement is that role constant values are consistent across all contracts.

> **Current status:** In the codebase, `ArcVaultAccessControl` is **standalone and not inherited** by any operational contract. Each contract (TreasuryVault, PayoutRouter, BudgetManager) defines its own role constants independently. The contract is also **not deployed** by `Deploy.s.sol`.

### Imports

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
```

### Role Constants

```solidity
bytes32 public constant CFO_ROLE = keccak256("CFO_ROLE");
bytes32 public constant TREASURY_MANAGER_ROLE = keccak256("TREASURY_MANAGER_ROLE");
bytes32 public constant AP_MANAGER_ROLE = keccak256("AP_MANAGER_ROLE");
bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
```

### Role Hierarchy and Permissions

| Role | Granted To | Permissions |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | Deployer / multisig | Can grant and revoke **all** roles. This is OpenZeppelin's built-in admin role (`0x00`). |
| `CFO_ROLE` | CFO wallet | **TreasuryVault:** `setLiquidityThreshold`. **BudgetManager:** `createBudget`, `reallocate`. **All contracts:** `pause`, `unpause`. Highest operational role. |
| `TREASURY_MANAGER_ROLE` | Treasury operations wallet | **TreasuryVault:** `withdrawFunds`. Used by BudgetManager and PayoutRouter contracts when pulling funds from the vault. |
| `AP_MANAGER_ROLE` | Accounts Payable manager | **PayoutRouter:** `executePayout`, `batchPayout`. Creates and triggers payment workflows. |
| `OPERATOR_ROLE` | Backend automation / keeper | **PayoutRouter:** `updatePayoutStatus`. Automated status updates from off-chain payment processors. |

### Constructor

```solidity
constructor(address _admin) {
    require(_admin != address(0), "Invalid admin address");
    _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    _grantRole(CFO_ROLE, _admin);
}
```

The deployer address receives both `DEFAULT_ADMIN_ROLE` and `CFO_ROLE`. Additional roles are granted post-deployment by the admin.

### Emergency Functions

```solidity
function pause() external onlyRole(CFO_ROLE) {
    _pause();
}

function unpause() external onlyRole(CFO_ROLE) {
    _unpause();
}
```

When inherited by operational contracts, `whenNotPaused` modifier is applied to critical state-changing functions (e.g., `spendFromBudget`, `executePayout`, `withdrawFunds`).

### Implementation Pattern for Consuming Contracts

Each consuming contract follows this pattern (independently defining its roles):

```solidity
contract TreasuryVault is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant CFO_ROLE = keccak256("CFO_ROLE");
    bytes32 public constant TREASURY_MANAGER_ROLE = keccak256("TREASURY_MANAGER_ROLE");

    constructor(address _admin, /* ... */) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(CFO_ROLE, _admin);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    function withdrawFunds(uint256 amount)
        external
        onlyRole(TREASURY_MANAGER_ROLE)
        whenNotPaused
        nonReentrant
    { /* ... */ }
}
```

> **Note on pause roles:** There is an inconsistency across contracts:
> - **TreasuryVault** and **PayoutRouter** use `DEFAULT_ADMIN_ROLE` for `pause`/`unpause`.
> - **BudgetManager** and **ArcVaultAccessControl** use `CFO_ROLE` for `pause`/`unpause`.

### Full Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ArcVaultAccessControl
 * @notice Shared role definitions and emergency controls for the ArcVault system.
 * @dev Contracts may inherit this directly or replicate the role constants.
 *      The key requirement is that keccak256 values are identical across the system.
 */
contract ArcVaultAccessControl is AccessControl, Pausable {
    bytes32 public constant CFO_ROLE = keccak256("CFO_ROLE");
    bytes32 public constant TREASURY_MANAGER_ROLE = keccak256("TREASURY_MANAGER_ROLE");
    bytes32 public constant AP_MANAGER_ROLE = keccak256("AP_MANAGER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    constructor(address _admin) {
        require(_admin != address(0), "Invalid admin address");
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(CFO_ROLE, _admin);
    }

    function pause() external onlyRole(CFO_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(CFO_ROLE) {
        _unpause();
    }
}
```

### Test Cases (Foundry)

**File:** `packages/contracts/test/ArcVaultAccessControl.t.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ArcVaultAccessControl.sol";

contract ArcVaultAccessControlTest is Test {
    ArcVaultAccessControl public ac;

    address admin = address(0xA);
    address cfo = address(0xB);
    address randomUser = address(0xC);

    function setUp() public {
        ac = new ArcVaultAccessControl(admin);
    }

    // ... test functions below
}
```

| # | Test Name | Description |
|---|---|---|
| 1 | `test_roles_correctlyDefined` | Assert `CFO_ROLE == keccak256("CFO_ROLE")`, `TREASURY_MANAGER_ROLE == keccak256("TREASURY_MANAGER_ROLE")`, etc. Ensures no typos in role hashes. |
| 2 | `test_cfo_canPause` | Grant `CFO_ROLE` to `cfo`. Call `pause()` from `cfo`. Assert `paused() == true`. |
| 3 | `test_cfo_canUnpause` | Pause the contract, then call `unpause()` from `cfo`. Assert `paused() == false`. |
| 4 | `test_nonCFO_cannotPause` | Call `pause()` from `randomUser`. Expect revert with AccessControl error message. |
| 5 | `test_admin_canGrantRoles` | Admin grants `TREASURY_MANAGER_ROLE` to an address. Assert `hasRole(TREASURY_MANAGER_ROLE, addr) == true`. |
| 6 | `test_admin_canRevokeRoles` | Admin grants then revokes `AP_MANAGER_ROLE`. Assert `hasRole(AP_MANAGER_ROLE, addr) == false` after revocation. |
| 7 | `test_roleHierarchy_works` | Non-admin cannot grant roles. Expect revert. Verify that `DEFAULT_ADMIN_ROLE` is the admin of all custom roles (OpenZeppelin default behavior). |

---

## Part B: MockUSYC.sol

### Overview

| Field | Value |
|---|---|
| **Contract** | `MockUSYC.sol` |
| **Purpose** | ERC-20 mock of Hashnote's USYC (US Yield Coin) with simulated yield accrual. For development and demo environments only. |
| **Solidity Version** | `^0.8.20` |
| **License** | MIT |
| **Location** | `packages/contracts/src/mocks/MockUSYC.sol` |
| **Test File** | `packages/contracts/test/MockUSYC.t.sol` |

### Imports

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IUSYC.sol";
```

> **Note:** MockUSYC implements the `IUSYC` interface (`ERC20, Ownable, IUSYC`).

### State Variables

```solidity
uint256 public exchangeRate;    // Current USYC:USDC rate, scaled to 1e18. Starts at 1e18 (1:1).
uint256 public yieldRateBps;    // Annual yield in basis points. 500 = 5.00% APY.
uint256 public lastUpdate;      // Timestamp of the last exchange rate update.
address public usdc;            // Address of the USDC token (or mock USDC).
```

### Constructor

```solidity
constructor(address _usdc) ERC20("Mock USYC", "mUSYC") Ownable(msg.sender) {
    require(_usdc != address(0), "Invalid USDC address");
    usdc = _usdc;
    exchangeRate = 1e18;          // 1 USYC = 1 USDC initially
    yieldRateBps = 500;           // 5% APY default
    lastUpdate = block.timestamp;
}
```

### Functions

#### 1. `deposit`

```solidity
function deposit(uint256 usdcAmount) external returns (uint256 usycMinted) {
    require(usdcAmount > 0, "Amount must be > 0");

    // Pull USDC from the sender
    require(
        IERC20(usdc).transferFrom(msg.sender, address(this), usdcAmount),
        "USDC transfer failed"
    );

    // Update exchange rate to account for accrued yield
    _updateExchangeRate();

    // Calculate USYC to mint: usdcAmount * 1e18 / exchangeRate
    // If exchangeRate > 1e18, user gets fewer USYC per USDC (USYC is worth more)
    usycMinted = usdcAmount * 1e18 / exchangeRate;

    _mint(msg.sender, usycMinted);
}
```

**Logic:** User deposits USDC, receives USYC tokens proportional to the current exchange rate. As the exchange rate increases over time (simulating yield), each USDC buys fewer USYC tokens.

#### 2. `redeem`

```solidity
function redeem(uint256 usycAmount) external returns (uint256 usdcReturned) {
    require(usycAmount > 0, "Amount must be > 0");

    // Update exchange rate to account for accrued yield
    _updateExchangeRate();

    // Calculate USDC to return: usycAmount * exchangeRate / 1e18
    usdcReturned = usycAmount * exchangeRate / 1e18;

    _burn(msg.sender, usycAmount);

    require(
        IERC20(usdc).transfer(msg.sender, usdcReturned),
        "USDC transfer failed"
    );
}
```

**Logic:** User burns USYC, receives USDC. Because the exchange rate has grown, the user receives more USDC than they originally deposited (the yield).

#### 3. `setYieldRate`

```solidity
function setYieldRate(uint256 bps) external onlyOwner {
    _updateExchangeRate(); // Settle accrued yield at the old rate first
    yieldRateBps = bps;
}
```

**Access:** `onlyOwner` (deployer). Allows changing the simulated yield rate for demo purposes.

#### 4. `_updateExchangeRate` (internal)

```solidity
function _updateExchangeRate() internal {
    uint256 elapsed = block.timestamp - lastUpdate;
    if (elapsed == 0) return;

    // exchangeRate += exchangeRate * yieldRateBps * elapsed / (365 days * 10_000)
    // This is simple linear interpolation of annual yield
    exchangeRate += exchangeRate * yieldRateBps * elapsed / (365 days * 10_000);
    lastUpdate = block.timestamp;
}
```

**Math:** Linear accrual approximation. For a hackathon demo this is sufficient. Production would use compound interest.

#### 5. `getExchangeRate` (view helper)

```solidity
function getExchangeRate() external view returns (uint256) {
    uint256 elapsed = block.timestamp - lastUpdate;
    if (elapsed == 0) return exchangeRate;
    return exchangeRate + exchangeRate * yieldRateBps * elapsed / (365 days * 10_000);
}
```

**Note:** This is a view function that calculates the *current* exchange rate without updating storage. Useful for frontend display.

### Full Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IUSYC.sol";

contract MockUSYC is ERC20, Ownable, IUSYC {
    address public usdc;
    uint256 public override exchangeRate;
    uint256 public yieldRateBps;
    uint256 public lastUpdate;

    constructor(address _usdc) ERC20("Mock USYC", "mUSYC") Ownable(msg.sender) {
        usdc = _usdc;
        exchangeRate = 1e18;
        yieldRateBps = 500; // 5% APY
        lastUpdate = block.timestamp;
    }

    function deposit(uint256 usdcAmount) external override returns (uint256 usycMinted) {
        require(usdcAmount > 0, "Amount must be > 0");
        IERC20(usdc).transferFrom(msg.sender, address(this), usdcAmount);
        _updateExchangeRate();
        usycMinted = (usdcAmount * 1e18) / exchangeRate;
        _mint(msg.sender, usycMinted);
    }

    function redeem(uint256 usycAmount) external override returns (uint256 usdcReturned) {
        require(usycAmount > 0, "Amount must be > 0");
        _updateExchangeRate();
        usdcReturned = (usycAmount * exchangeRate) / 1e18;
        _burn(msg.sender, usycAmount);
        IERC20(usdc).transfer(msg.sender, usdcReturned);
    }

    function getExchangeRate() external view returns (uint256) {
        uint256 elapsed = block.timestamp - lastUpdate;
        if (elapsed == 0) return exchangeRate;
        return exchangeRate + (exchangeRate * yieldRateBps * elapsed) / (365 days * 10_000);
    }

    function balanceOf(address account) public view override(ERC20, IUSYC) returns (uint256) {
        return super.balanceOf(account);
    }

    function setYieldRate(uint256 bps) external onlyOwner {
        _updateExchangeRate();
        yieldRateBps = bps;
    }

    function _updateExchangeRate() internal {
        uint256 elapsed = block.timestamp - lastUpdate;
        if (elapsed > 0) {
            exchangeRate += (exchangeRate * yieldRateBps * elapsed) / (365 days * 10_000);
            lastUpdate = block.timestamp;
        }
    }
}
```

### Test Cases (Foundry)

**File:** `packages/contracts/test/MockUSYC.t.sol`

**Setup:** Deploy a MockUSDC (standard ERC-20 with mint), deploy MockUSYC with MockUSDC address. Mint 1M USDC to the test user. Approve MockUSYC to spend user's USDC.

| # | Test Name | Description |
|---|---|---|
| 1 | `test_deposit_mintsCorrectAmount` | Deposit 1000 USDC at initial rate (1e18). Assert 1000e18 USYC minted. Assert USDC transferred from user to contract. |
| 2 | `test_redeem_returnsAppreciatedAmount` | Deposit 1000 USDC. Warp 180 days (`vm.warp`). Redeem all USYC. Assert USDC returned > 1000 USDC (yield accrued). Calculate expected: `1000e6 * (1 + 0.05 * 180/365)` approximately. |
| 3 | `test_exchangeRate_increasesOverTime` | Record `getExchangeRate()`. Warp 365 days. Record again. Assert new rate is approximately `1e18 * 1.05` (5% annual yield). Allow 0.1% tolerance for rounding. |
| 4 | `test_setYieldRate_onlyOwner` | Non-owner calls `setYieldRate`. Expect revert with Ownable error. Owner calls successfully. Assert `yieldRateBps` updated. |

---

## Part C: MockStableFX.sol

### Overview

| Field | Value |
|---|---|
| **Contract** | `MockStableFX.sol` |
| **Purpose** | Simulated FX RFQ (Request for Quote) and PvP (Payment vs Payment) swap engine. Mimics institutional FX execution for dev/demo. |
| **Solidity Version** | `^0.8.20` |
| **License** | MIT |
| **Location** | `packages/contracts/src/mocks/MockStableFX.sol` |
| **Test File** | `packages/contracts/test/MockStableFX.t.sol` |

### Imports

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStableFX.sol";
```

> **Note:** MockStableFX implements the `IStableFX` interface (`Ownable, IStableFX`).

### State Variables

```solidity
struct Quote {
    address fromToken;      // Source token address (e.g., USDC)
    address toToken;        // Destination token address (e.g., EURC)
    uint256 inputAmount;    // Amount of fromToken the user will send
    uint256 outputAmount;   // Amount of toToken the user will receive
    uint256 expiry;         // Timestamp after which the quote is invalid
    address requester;      // Address that requested the quote (msg.sender)
    bool executed;          // Whether the swap has been completed
}

mapping(bytes32 => Quote) public quotes;   // quoteId => Quote
uint256 public quoteCounter;               // Monotonic counter for unique quote generation

// Rate lookup: rates[fromToken][toToken] = rate scaled to 1e18
// Example: rates[USDC][EURC] = 0.9235e18 means 1 USDC = 0.9235 EURC
mapping(address => mapping(address => uint256)) public rates;
```

### Constructor

```solidity
constructor() Ownable(msg.sender) {}
```

Minimal constructor with explicit `Ownable(msg.sender)` (required by OZ v5). Rates are set post-deployment via `setRate`.

### Events

> **Note:** The current implementation does **not** emit events. The events below are from the original spec and may be added later.

```solidity
// Not emitted in current code — included for reference
// event QuoteRequested(bytes32 indexed quoteId, address fromToken, address toToken, uint256 inputAmount, uint256 outputAmount, uint256 expiry);
// event SwapExecuted(bytes32 indexed quoteId, uint256 outputAmount);
// event RateUpdated(address fromToken, address toToken, uint256 rate);
```

### Functions

#### 1. `requestQuote`

```solidity
function requestQuote(
    address fromToken,
    address toToken,
    uint256 amount
) external override returns (bytes32 quoteId, uint256 outputAmount, uint256 expiry) {
    uint256 rate = rates[fromToken][toToken];
    if (rate == 0) {
        rate = 1e18; // default 1:1
    }

    outputAmount = (amount * rate) / 1e18;
    expiry = block.timestamp + 30;

    quoteCounter++;
    quoteId = keccak256(abi.encodePacked(quoteCounter, msg.sender, block.timestamp));

    quotes[quoteId] = Quote({
        fromToken: fromToken,
        toToken: toToken,
        inputAmount: amount,
        outputAmount: outputAmount,
        expiry: expiry,
        requester: msg.sender,
        executed: false
    });
}
```

**Logic:**
1. Look up the exchange rate. Fall back to 1:1 if not configured.
2. Calculate output amount.
3. Set expiry to 30 seconds from now (tight window simulating real RFQ).
4. Increment counter, generate a unique `quoteId` from counter + `msg.sender` + timestamp.
5. Store the quote (including `requester` = `msg.sender`).

#### 2. `executeSwap`

```solidity
function executeSwap(bytes32 quoteId) external override returns (uint256 outputAmount) {
    Quote storage quote = quotes[quoteId];
    require(quote.expiry > 0, "Quote not found");
    require(!quote.executed, "Quote already executed");
    require(block.timestamp <= quote.expiry, "Quote expired");

    quote.executed = true;
    outputAmount = quote.outputAmount;

    IERC20(quote.fromToken).transferFrom(msg.sender, address(this), quote.inputAmount);
    IERC20(quote.toToken).transfer(msg.sender, outputAmount);
}
```

**Logic:**
1. Validate quote is not expired or already executed.
2. Mark as executed (CEI pattern — state change before external calls).
3. Pull `fromToken` from the caller.
4. Send `toToken` to the caller from the contract's balance.

**Prerequisite:** The MockStableFX contract must be pre-funded with destination tokens (EURC, etc.) for swaps to succeed. In tests and demo, mint tokens to the contract address.

#### 3. `setRate`

```solidity
function setRate(address fromToken, address toToken, uint256 rate) external onlyOwner {
    rates[fromToken][toToken] = rate;
}
```

**Access:** `onlyOwner`. Used to configure FX rates for demo.

**Example rates to set:**
| Pair | Rate | Meaning |
|---|---|---|
| USDC -> EURC | `923500000000000000` (0.9235e18) | 1 USDC = 0.9235 EURC |
| EURC -> USDC | `1082800000000000000` (1.0828e18) | 1 EURC = 1.0828 USDC |
| USDC -> GBPC | `791000000000000000` (0.791e18) | 1 USDC = 0.791 GBPC |

### Full Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStableFX.sol";

contract MockStableFX is Ownable, IStableFX {
    struct Quote {
        address fromToken;
        address toToken;
        uint256 inputAmount;
        uint256 outputAmount;
        uint256 expiry;
        address requester;
        bool executed;
    }

    mapping(bytes32 => Quote) public quotes;
    uint256 public quoteCounter;
    mapping(address => mapping(address => uint256)) public rates;

    constructor() Ownable(msg.sender) {}

    function setRate(address fromToken, address toToken, uint256 rate) external onlyOwner {
        rates[fromToken][toToken] = rate;
    }

    function requestQuote(
        address fromToken,
        address toToken,
        uint256 amount
    ) external override returns (bytes32 quoteId, uint256 outputAmount, uint256 expiry) {
        uint256 rate = rates[fromToken][toToken];
        if (rate == 0) rate = 1e18;

        outputAmount = (amount * rate) / 1e18;
        expiry = block.timestamp + 30;

        quoteCounter++;
        quoteId = keccak256(abi.encodePacked(quoteCounter, msg.sender, block.timestamp));

        quotes[quoteId] = Quote({
            fromToken: fromToken,
            toToken: toToken,
            inputAmount: amount,
            outputAmount: outputAmount,
            expiry: expiry,
            requester: msg.sender,
            executed: false
        });
    }

    function executeSwap(bytes32 quoteId) external override returns (uint256 outputAmount) {
        Quote storage quote = quotes[quoteId];
        require(quote.expiry > 0, "Quote not found");
        require(!quote.executed, "Quote already executed");
        require(block.timestamp <= quote.expiry, "Quote expired");

        quote.executed = true;
        outputAmount = quote.outputAmount;

        IERC20(quote.fromToken).transferFrom(msg.sender, address(this), quote.inputAmount);
        IERC20(quote.toToken).transfer(msg.sender, outputAmount);
    }
}
```

### Test Cases (Foundry)

**File:** `packages/contracts/test/MockStableFX.t.sol`

**Setup:** Deploy two mock ERC-20 tokens (MockUSDC and MockEURC). Deploy MockStableFX. Set rate for USDC->EURC. Mint tokens to test user and to MockStableFX (for output liquidity). Approve MockStableFX to spend user's USDC.

| # | Test Name | Description |
|---|---|---|
| 1 | `test_requestQuote_returnsValidQuote` | Request a quote for 10,000 USDC->EURC at rate 0.9235e18. Assert `outputAmount == 9235e6` (scaled appropriately). Assert `expiry == block.timestamp + 30`. Assert quote stored correctly. |
| 2 | `test_executeSwap_transfersCorrectly` | Request a quote, then execute it. Assert user's USDC decreased by inputAmount. Assert user's EURC increased by outputAmount. Assert quote marked as executed. |
| 3 | `test_executeSwap_revertsIfExpired` | Request a quote. Warp past expiry (`vm.warp(block.timestamp + 31)`). Call `executeSwap`. Expect revert "Quote expired". |
| 4 | `test_executeSwap_revertsIfAlreadyExecuted` | Request and execute a quote. Call `executeSwap` again with same quoteId. Expect revert "Quote already executed". |

---

## Part D: MockERC20.sol

### Overview

| Field | Value |
|---|---|
| **Contract** | `MockERC20.sol` |
| **Purpose** | Generic configurable ERC-20 token for testing. Used by `Deploy.s.sol` to create mock USDC and EURC tokens with the correct decimals. |
| **Solidity Version** | `^0.8.20` |
| **License** | MIT |
| **Location** | `packages/contracts/src/mocks/MockERC20.sol` |

### Full Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
```

**Key features:**
- Configurable name, symbol, and decimals at deploy time.
- Permissionless `mint()` — anyone can mint (suitable for testing only).
- Used in `Deploy.s.sol` to create `MockERC20("USD Coin", "USDC", 6)` and `MockERC20("Euro Coin", "EURC", 6)`.

---

## Files to Create / Modify

| File | Action |
|---|---|
| `packages/contracts/src/ArcVaultAccessControl.sol` | **Create** — shared role constants + pause/unpause (standalone, not inherited) |
| `packages/contracts/src/mocks/MockUSYC.sol` | **Create** — mock yield-bearing token (implements IUSYC) |
| `packages/contracts/src/mocks/MockStableFX.sol` | **Create** — mock FX RFQ engine (implements IStableFX) |
| `packages/contracts/src/mocks/MockERC20.sol` | **Create** — generic configurable ERC-20 for testing |
| `packages/contracts/test/ArcVaultAccessControl.t.sol` | **Create** — role and pause tests |
| `packages/contracts/test/MockUSYC.t.sol` | **Create** — deposit, redeem, yield tests |
| `packages/contracts/test/MockStableFX.t.sol` | **Create** — quote and swap tests |

---

## Cross-References

| Document | Relationship |
|---|---|
| `docs/technical/02-treasury-vault-contract.md` | Uses `IUSYC` interface (maps to MockUSYC in dev). Inherits role pattern from this doc. `TREASURY_MANAGER_ROLE` for withdrawals. |
| `docs/technical/03-payout-router-contract.md` | Uses `IStableFX` interface (maps to MockStableFX in dev). Inherits role pattern. `AP_MANAGER_ROLE` for payouts, `OPERATOR_ROLE` for status updates. |
| `docs/technical/04-budget-manager-contract.md` | Uses `CFO_ROLE` for budget creation and reallocation. |
| `docs/technical/06-database-schema.md` | FXQuote Prisma model stores off-chain representation of MockStableFX quotes. |
| `docs/technical/07-api-routes.md` | API routes interact with mock contracts via wagmi/viem for dev environment. |

---

## Implementation Notes

1. **Token Decimals Consistency:** MockUSYC uses 18 decimals (ERC20 default). USDC uses 6 decimals. When calculating exchange amounts, be careful with decimal scaling. The `deposit` function receives a 6-decimal USDC amount and mints 18-decimal USYC tokens.

2. **MockStableFX Liquidity:** The contract must hold sufficient `toToken` balance before swaps can execute. In test setup and demo seed scripts, mint destination tokens directly to the MockStableFX contract address.

3. **Quote Expiry:** The 30-second expiry window is intentionally tight to simulate real institutional FX RFQ behavior. Frontend should request a fresh quote immediately before the user confirms a swap.

4. **No Reentrancy Guard on Mocks:** For hackathon simplicity, the mock contracts do not use `ReentrancyGuard`. They are for dev/demo only. Production contracts should add reentrancy protection.

5. **Ownable vs AccessControl:** Mock contracts use `Ownable` (simpler, single-owner) while production contracts use `AccessControl` (multi-role). This is intentional -- mocks do not need granular permissions.
