// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IStableFX {
    function requestQuote(
        address fromToken,
        address toToken,
        uint256 amount
    ) external returns (bytes32 quoteId, uint256 outputAmount, uint256 expiry);

    function executeSwap(bytes32 quoteId) external returns (uint256 outputAmount);
}
