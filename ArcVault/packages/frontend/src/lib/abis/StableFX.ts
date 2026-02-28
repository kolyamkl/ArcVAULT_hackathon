export const StableFXABI = [
  {
    type: 'function',
    name: 'requestQuote',
    inputs: [
      { name: 'fromToken', type: 'address' },
      { name: 'toToken', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [
      { name: 'quoteId', type: 'bytes32' },
      { name: 'outputAmount', type: 'uint256' },
      { name: 'expiry', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executeSwap',
    inputs: [{ name: 'quoteId', type: 'bytes32' }],
    outputs: [{ name: 'outputAmount', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'rates',
    inputs: [
      { name: 'fromToken', type: 'address' },
      { name: 'toToken', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;
