'use client';

import { useConnect, useDisconnect, useAccount } from 'wagmi';
// CORRECTED WAGMI IMPORT:
import { injected } from 'wagmi/connectors';
// CORRECTED HELPERS IMPORT PATH:
import { shortenAddress } from '../../src/utils/helpers'; 

export default function ConnectButton() {
  const { address, isConnected } = useAccount();
  // Use the 'injected' connector which covers MetaMask, Coinbase Wallet, etc.
  const { connect } = useConnect({ connector: injected() });
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <div className="flex items-center space-x-4">
        <span className="text-sm bg-blue-600 p-2 rounded-lg">
          {shortenAddress(address)}
        </span>
        <button 
          className="bg-red-500 hover:bg-red-600 p-2 rounded-lg text-sm transition duration-150" 
          onClick={() => disconnect()}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button 
      className="bg-green-600 hover:bg-green-700 p-2 rounded-lg text-sm transition duration-150" 
      onClick={() => connect()}
    >
      Connect Wallet
    </button>
  );
}
