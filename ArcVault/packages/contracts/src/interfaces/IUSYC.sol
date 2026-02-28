// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IUSYC {
    function deposit(uint256 usdcAmount) external returns (uint256 usycMinted);
    function redeem(uint256 usycAmount) external returns (uint256 usdcReturned);
    function balanceOf(address account) external view returns (uint256);
    function exchangeRate() external view returns (uint256);
}
