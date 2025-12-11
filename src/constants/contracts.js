// Example ABI (Application Binary In
export const MULTISENDER_ABI = [{"inputs":[{"internalType":"address","name":"tokenAddress","type":"address"},{"internalType":"address[]","name":"recipients","type":"address[]"},{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"name":"sendTokens","outputs":[],"stateMutability":"nonpayable","type":"function"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"token","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"uint256","name":"totalAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"recipientCount","type":"uint256"}],"name":"TokensSent","type":"event"}];

// Map of Chain IDs to Deployed Contract Addresses
// Base Mainnet Chain ID is 8453
// Ethereum Mainnet Chain ID is 1
export const MULTISENDER_CONTRACTS = {
  8453: '0x1baE4486b6D64A5174D32AFfAC95e5eac4df186C', 
  1: '0xYOUR_DEPLOYED_ADDRESS_ON_ETHEREUM_HERE',
  // Add other chains as needed
};

// Placeholder address for a token to send (e.g., USDC on Base Mainnet)
export const TOKEN_ADDRESS_TO_SEND = '0x833589fCD6eDb6E08f4c7C32D4f62C78D9F6a95FE';
