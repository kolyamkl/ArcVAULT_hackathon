export const PayoutRouterABI = [
  // executePayout(address,uint256,address,bytes32) → uint256
  {
    type: 'function',
    name: 'executePayout',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'targetCurrency', type: 'address' },
      { name: 'paymentRef', type: 'bytes32' },
    ],
    outputs: [{ name: 'payoutId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  // batchPayout(address[],uint256[],address[],bytes32[]) → uint256[]
  {
    type: 'function',
    name: 'batchPayout',
    inputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
      { name: 'targetCurrencies', type: 'address[]' },
      { name: 'paymentRefs', type: 'bytes32[]' },
    ],
    outputs: [{ name: 'payoutIds', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
  },
  // getPayoutStatus(uint256) → tuple
  {
    type: 'function',
    name: 'getPayoutStatus',
    inputs: [{ name: 'payoutId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'recipient', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'targetCurrency', type: 'address' },
          { name: 'paymentRef', type: 'bytes32' },
          { name: 'status', type: 'uint8' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'outputAmount', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  // getPayoutCount() → uint256
  {
    type: 'function',
    name: 'getPayoutCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Events
  {
    type: 'event',
    name: 'PayoutCreated',
    inputs: [
      { name: 'payoutId', type: 'uint256', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'targetCurrency', type: 'address', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PayoutCompleted',
    inputs: [
      { name: 'payoutId', type: 'uint256', indexed: true },
      { name: 'outputAmount', type: 'uint256', indexed: false },
    ],
  },
] as const;
