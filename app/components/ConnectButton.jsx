// app/components/ConnectButton.jsx
'use client';

import { useConnect, useDisconnect, useAccount } from 'wagmi';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { shortenAddress } from '@/utils/helpers'; // Create this helper next

export default function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <div className="flex items-center space-x-4">
        <span className="text-sm bg-blue-600 p-2 rounded-lg">{shortenAddress(address)}</span>
        <button className="bg-red-500 hover:bg-red-600 p-2 rounded-lg text-sm" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button 
      className="bg-green-600 hover:bg-green-700 p-2 rounded-lg text-sm" 
      onClick={() => connect({ connector: new MetaMaskConnector() })}
    >
      Connect Wallet
    </button>
  );
}
