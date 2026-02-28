export const TreasuryVaultABI = [
  { type: 'function', name: 'depositFunds', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'withdrawFunds', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'getLiquidBalance', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getUSYCBalance', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getTotalValue', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getYieldAccrued', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'liquidityThreshold', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'setLiquidityThreshold', inputs: [{ name: 'newThreshold', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'TREASURY_MANAGER_ROLE', inputs: [], outputs: [{ name: '', type: 'bytes32' }], stateMutability: 'view' },
  { type: 'function', name: 'CFO_ROLE', inputs: [], outputs: [{ name: '', type: 'bytes32' }], stateMutability: 'view' },
  // Events
  { type: 'event', name: 'Deposited', inputs: [{ name: 'amount', type: 'uint256', indexed: false }] },
  { type: 'event', name: 'Withdrawn', inputs: [{ name: 'amount', type: 'uint256', indexed: false }] },
  { type: 'event', name: 'SweptToUSYC', inputs: [{ name: 'amount', type: 'uint256', indexed: false }] },
  { type: 'event', name: 'RedeemedFromUSYC', inputs: [{ name: 'amount', type: 'uint256', indexed: false }] },
  { type: 'event', name: 'ThresholdUpdated', inputs: [{ name: 'value', type: 'uint256', indexed: false }] },
] as const;
