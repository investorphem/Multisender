'use client'; 

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from 'wagmi';
import { MULTISENDER_CONTRACTS, MULTISENDER_ABI, TOKEN_ADDRESS_TO_SEND } from '@/constants/contracts';
import { parseEther } from 'viem';
import { base, mainnet } from 'wagmi/chains'; // Import the chains you support

export default function MultiSenderPage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { chains, switchChain } = useSwitchChain();
  const [recipientList, setRecipientList] = useState('');
  const [statusMessage, setStatusMessage] = useState('Enter recipients and amounts below.');

  const contractAddress = MULTISENDER_CONTRACTS[chainId];

  const { data: hash, writeContract, isPending: isSending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleListChange = (e) => setRecipientList(e.target.value);

  const parseInput = () => {
    const lines = recipientList.trim().split('\n');
    const recipients = [];
    const amounts = [];
    
    try {
      lines.forEach(line => {
        // Split by comma or space, remove empty entries
        const parts = line.split(/[,\s]+/).filter(p => p.length > 0); 
        if (parts.length === 2) {
          recipients.push(parts[0]);
          amounts.push(parseEther(parts[1])); // Convert human readable number (1.5) to wei (18 decimals)
        }
      });
      return { recipients, amounts };
    } catch (error) {
        setStatusMessage("Error parsing input. Ensure format is 'address, amount' per line.");
        return null;
    }
  };


  const handleSubmit = async () => {
    if (!isConnected || !contractAddress || !TOKEN_ADDRESS_TO_SEND) {
      setStatusMessage("Wallet is disconnected or contract address is missing.");
      return;
    }

    const parsedData = parseInput();
    if (!parsedData || parsedData.recipients.length === 0) return;

    setStatusMessage(`Sending ${parsedData.recipients.length} payments...`);

    // IMPORTANT: In a real dApp, you MUST first prompt the user to APPROVE the tokens. 
    // This code assumes approval has already happened.
    
    writeContract({
      address: contractAddress,
      abi: MULTISENDER_ABI,
      functionName: 'sendTokens',
      args: [TOKEN_ADDRESS_TO_SEND, parsedData.recipients, parsedData.amounts],
    });
  };

  useEffect(() => {
    if (isConfirmed) setStatusMessage("Transaction successful!");
    if (isConfirming) setStatusMessage("Waiting for transaction confirmation...");
    if (isSending) setStatusMessage("Check your wallet to confirm the transaction...");
  }, [isConfirmed, isConfirming, isSending]);


  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md">
        <h1 className="text-3xl font-extrabold mb-4 text-center text-blue-400">Batch Sender DApp</h1>
        <p className="mb-6 text-center text-gray-400">Send tokens to multiple addresses in one transaction.</p>
        
        {!isConnected ? (
          <div className="text-center p-4 bg-gray-700 rounded">
            Please connect your wallet to begin. (Your AppKit Connect Button should be visible here from your layout)
          </div>
        ) : (
          <div>
            <div className="mb-4 p-3 bg-gray-700 rounded flex justify-between items-center">
                <span>Network: </span>
                <select 
                    value={chainId} 
                    onChange={(e) => switchChain({ chainId: parseInt(e.target.value) })}
                    className="bg-gray-600 p-1 rounded text-white"
                >
                    {chains.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>

            <textarea
              className="w-full h-48 p-4 border border-gray-700 rounded-lg resize-none bg-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="Enter addresses and amounts (e.g., 0xAbCd...123, 0.01) one per line."
              value={recipientList}
              onChange={handleListChange}
            />

            <button
              onClick={handleSubmit}
              disabled={!contractAddress || isSending || isConfirming}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-lg disabled:opacity-50 transition duration-150 ease-in-out shadow-lg"
            >
              {isSending || isConfirming ? 'Processing Transaction...' : 'Execute Batch Send'}
            </button>

            <div className={`mt-4 p-3 rounded-lg text-sm ${isConfirmed ? 'bg-green-900' : isSending || isConfirming ? 'bg-blue-900' : 'bg-gray-700'}`}>
                {statusMessage}
            </div>
            {hash && <p className="mt-2 text-xs text-gray-500 truncate">Tx Hash: {hash}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

