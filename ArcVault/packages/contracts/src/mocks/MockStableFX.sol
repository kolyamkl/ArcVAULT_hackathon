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
