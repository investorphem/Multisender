'use client';

import { useConnect, useDisconnect, useAccount } from 'wagmi';
// Import injected (for MetaMask/extensions) and walletConnect (for mobile/QR codes)
import { injected, walletConnect } from 'wagmi/connectors'; 
import { shortenAddress } from '../../src/utils/helpers'; 

export default function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
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

  // Use a map to display available connectors when not connected
  return (
    <div>
      {/* 
        The 'connectors' array from useConnect will list all available options based on 
        your wagmiConfig in providers.jsx (Wagmi automatically detects MetaMask extension). 
        You still need to include walletConnect in your wagmiConfig for it to show up here.
      */}
      {connectors.map((connector) => (
        <button
          disabled={!connector.ready}
          key={connector.id}
          onClick={() => connect({ connector })}
          className="bg-green-600 hover:bg-green-700 p-2 rounded-lg text-sm transition duration-150"
        >
          Connect {connector.name}
          {!connector.ready && ' (unsupported)'}
        </button>
      ))}
    </div>
  );
}
