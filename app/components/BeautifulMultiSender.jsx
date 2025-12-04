'use client'; 

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
// CORRECTED PATHS:
import { MULTISENDER_CONTRACTS, MULTISENDER_ABI, TOKEN_ADDRESS_TO_SEND } from '../../src/constants/contracts'; 
import { parseEther } from 'viem';
// Assuming you have the 'cn' utility from your other packages
import { cn } from '../../src/lib/utils'; 

export default function BeautifulMultiSender() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
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
          recipients.push(parts[0]); // Address
          amounts.push(parseEther(parts[1])); // Amount (assuming 18 decimals like ETH)
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
    
    // IMPORTANT: Ensure you have approved the contract to spend your tokens first!

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
            Please connect your wallet using the button in the top right.
          </div>
        ) : (
          <div>
            <div className="mb-4 p-3 bg-gray-700 rounded">
                Current Contract Address: <span className='truncate'>{contractAddress ? contractAddress : 'Unsupported Chain'}</span>
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
              className={cn(
                "mt-6 w-full font-bold p-3 rounded-lg transition duration-150 ease-in-out shadow-lg",
                {"bg-blue-600 hover:bg-blue-700 text-white": contractAddress && !isSending && !isConfirming},
                {"bg-gray-500 opacity-50 cursor-not-allowed": !contractAddress || isSending || isConfirming}
              )}
            >
              {isSending || isConfirming ? 'Processing Transaction...' : 'Execute Batch Send'}
            </button>

            <div className={cn(
                "mt-4 p-3 rounded-lg text-sm",
                {"bg-green-900": isConfirmed},
                {"bg-blue-900": isSending || isConfirming},
                {"bg-gray-700": !isConfirmed && !isConfirming && !isSending}
            )}>
                {statusMessage}
            </div>
            {hash && <p className="mt-2 text-xs text-gray-500 truncate">Tx Hash: {hash}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
