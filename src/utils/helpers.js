// src/utils/helpers.js
export const shortenAddress = (address) => {
  if (!address) return 'No Wallet Connected';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};
