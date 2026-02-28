// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IUSYC.sol";

contract TreasuryVault is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant CFO_ROLE = keccak256("CFO_ROLE");
    bytes32 public constant TREASURY_MANAGER_ROLE = keccak256("TREASURY_MANAGER_ROLE");

    error InvalidAmount();
    error NothingToSweep();
    error InsufficientUSYC();
    error ZeroAddress();

    address public usdc;
    address public usyc;
    uint256 public liquidityThreshold;
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event SweptToUSYC(uint256 amount);
    event RedeemedFromUSYC(uint256 amount);
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    constructor(address _usdc, address _usyc, uint256 _threshold, address _admin) {
        if (_usdc == address(0)) revert ZeroAddress();
        if (_usyc == address(0)) revert ZeroAddress();
        if (_admin == address(0)) revert ZeroAddress();
        if (_threshold == 0) revert InvalidAmount();

        usdc = _usdc;
        usyc = _usyc;
        liquidityThreshold = _threshold;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(CFO_ROLE, _admin);
        _grantRole(TREASURY_MANAGER_ROLE, _admin);
    }

    function depositFunds(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidAmount();

        IERC20(usdc).safeTransferFrom(msg.sender, address(this), amount);
        totalDeposited += amount;

        emit Deposited(msg.sender, amount);

        // Auto-sweep if over threshold
        uint256 liquid = IERC20(usdc).balanceOf(address(this));
        if (liquid > liquidityThreshold) {
            _sweepToUSYC();
        }
    }

    function withdrawFunds(uint256 amount)
        external
        onlyRole(TREASURY_MANAGER_ROLE)
        nonReentrant
        whenNotPaused
    {
        if (amount == 0) revert InvalidAmount();

        uint256 liquid = IERC20(usdc).balanceOf(address(this));

        // If not enough liquid USDC, redeem shortfall from USYC
        if (liquid < amount) {
            uint256 shortfall = amount - liquid;
            _redeemFromUSYC(shortfall);
        }

        IERC20(usdc).safeTransfer(msg.sender, amount);
        totalWithdrawn += amount;

        emit Withdrawn(msg.sender, amount);
    }

    function setLiquidityThreshold(uint256 _threshold) external onlyRole(CFO_ROLE) {
        if (_threshold == 0) revert InvalidAmount();

        uint256 oldThreshold = liquidityThreshold;
        liquidityThreshold = _threshold;

        emit ThresholdUpdated(oldThreshold, _threshold);

        _rebalance();
    }

    function sweepToUSYC() external nonReentrant whenNotPaused {
        uint256 liquid = IERC20(usdc).balanceOf(address(this));
        if (liquid <= liquidityThreshold) revert NothingToSweep();

        _sweepToUSYC();
    }

    function redeemFromUSYC(uint256 usdcAmount) external nonReentrant whenNotPaused {
        if (usdcAmount == 0) revert InvalidAmount();

        _redeemFromUSYC(usdcAmount);
    }

    function rebalance() external {
        _rebalance();
    }

    // --- View Functions ---

    function getLiquidBalance() external view returns (uint256) {
        return IERC20(usdc).balanceOf(address(this));
    }

    function getUSYCBalance() external view returns (uint256) {
        return IUSYC(usyc).balanceOf(address(this));
    }

    function getTotalValue() external view returns (uint256) {
        uint256 liquid = IERC20(usdc).balanceOf(address(this));
        uint256 usycBal = IUSYC(usyc).balanceOf(address(this));
        uint256 rate = IUSYC(usyc).exchangeRate();
        uint256 usycValueInUsdc = (usycBal * rate) / 1e18;
        return liquid + usycValueInUsdc;
    }

    function getYieldAccrued() external view returns (uint256) {
        uint256 usycBal = IUSYC(usyc).balanceOf(address(this));
        uint256 rate = IUSYC(usyc).exchangeRate();
        uint256 usycValueInUsdc = (usycBal * rate) / 1e18;
        // Yield = current USYC value - what was deposited into USYC (approximated)
        // Simple: total value - (totalDeposited - totalWithdrawn)
        uint256 liquid = IERC20(usdc).balanceOf(address(this));
        uint256 totalValue = liquid + usycValueInUsdc;
        uint256 netDeposits = totalDeposited > totalWithdrawn ? totalDeposited - totalWithdrawn : 0;
        return totalValue > netDeposits ? totalValue - netDeposits : 0;
    }

    // --- Admin ---

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // --- Internal ---

    function _sweepToUSYC() internal {
        uint256 liquid = IERC20(usdc).balanceOf(address(this));
        if (liquid <= liquidityThreshold) return;

        uint256 excess = liquid - liquidityThreshold;
        IERC20(usdc).forceApprove(usyc, excess);
        IUSYC(usyc).deposit(excess);

        emit SweptToUSYC(excess);
    }

    function _redeemFromUSYC(uint256 usdcAmount) internal {
        uint256 rate = IUSYC(usyc).exchangeRate();
        uint256 usycNeeded = (usdcAmount * 1e18) / rate;

        uint256 usycBalance = IUSYC(usyc).balanceOf(address(this));
        if (usycBalance < usycNeeded) revert InsufficientUSYC();

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
            uint256 redeemAmount = deficit > maxRedeemable ? maxRedeemable : deficit;
            if (redeemAmount > 0) {
                _redeemFromUSYC(redeemAmount);
            }
        }
    }
}
