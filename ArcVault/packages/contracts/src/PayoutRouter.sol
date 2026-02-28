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

contract PayoutRouter is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant AP_MANAGER_ROLE = keccak256("AP_MANAGER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    error ZeroAddress();
    error InvalidAmount();
    error PayoutNotFound();
    error ArrayLengthMismatch();
    error EmptyBatch();
    error PayoutAlreadyCompleted();

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

    ITreasuryVault public treasuryVault;
    IStableFX public stableFX;
    address public budgetManager;
    address public usdc;

    mapping(uint256 => Payout) public payouts;
    uint256 public payoutCounter;

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
        if (recipients.length == 0) revert EmptyBatch();
        if (
            recipients.length != amounts.length ||
            recipients.length != targetCurrencies.length ||
            recipients.length != paymentRefs.length
        ) revert ArrayLengthMismatch();

        payoutIds = new uint256[](recipients.length);
        for (uint256 i = 0; i < recipients.length; i++) {
            payoutIds[i] = _executePayout(recipients[i], amounts[i], targetCurrencies[i], paymentRefs[i]);
        }
    }

    function updatePayoutStatus(uint256 payoutId, PayoutStatus newStatus)
        external
        onlyRole(OPERATOR_ROLE)
    {
        if (payouts[payoutId].timestamp == 0) revert PayoutNotFound();

        PayoutStatus oldStatus = payouts[payoutId].status;
        payouts[payoutId].status = newStatus;
        emit PayoutStatusUpdated(payoutId, oldStatus, newStatus);
    }

    function getPayoutStatus(uint256 payoutId) external view returns (Payout memory) {
        if (payouts[payoutId].timestamp == 0) revert PayoutNotFound();
        return payouts[payoutId];
    }

    function getPayoutsByStatus(PayoutStatus status) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= payoutCounter; i++) {
            if (payouts[i].status == status) count++;
        }

        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i <= payoutCounter; i++) {
            if (payouts[i].status == status) {
                result[idx] = i;
                idx++;
            }
        }
        return result;
    }

    function getPayoutCount() external view returns (uint256) {
        return payoutCounter;
    }

    // --- Admin ---

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

    // --- Internal ---

    function _executePayout(
        address recipient,
        uint256 amount,
        address targetCurrency,
        bytes32 paymentRef
    ) internal returns (uint256 payoutId) {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();

        payoutId = ++payoutCounter;

        payouts[payoutId] = Payout({
            recipient: recipient,
            amount: amount,
            targetCurrency: targetCurrency == address(0) ? usdc : targetCurrency,
            paymentRef: paymentRef,
            status: PayoutStatus.Pending,
            timestamp: block.timestamp,
            outputAmount: 0
        });

        // Pull USDC from vault
        payouts[payoutId].status = PayoutStatus.Processing;
        treasuryVault.withdrawFunds(amount);

        uint256 finalAmount;
        if (targetCurrency == usdc || targetCurrency == address(0)) {
            // No conversion needed
            finalAmount = amount;
        } else {
            payouts[payoutId].status = PayoutStatus.Converting;

            // Approve StableFX to spend our USDC
            IERC20(usdc).forceApprove(address(stableFX), amount);

            // Request quote and execute swap
            (bytes32 quoteId,,) = stableFX.requestQuote(usdc, targetCurrency, amount);
            finalAmount = stableFX.executeSwap(quoteId);
        }

        // Transfer to recipient
        payouts[payoutId].status = PayoutStatus.Settling;
        address token = targetCurrency == address(0) ? usdc : targetCurrency;
        IERC20(token).safeTransfer(recipient, finalAmount);

        // Finalize
        payouts[payoutId].status = PayoutStatus.Completed;
        payouts[payoutId].outputAmount = finalAmount;

        emit PayoutCreated(payoutId, recipient, amount, token);
        emit PayoutCompleted(payoutId, finalAmount);
    }
}
