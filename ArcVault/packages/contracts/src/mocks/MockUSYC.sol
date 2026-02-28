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
