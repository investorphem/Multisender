'use client'; 

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useBalance } from 'wagmi';
// CORRECTED PATHS:
import { MULTISENDER_CONTRACTS, MULTISENDER_ABI } from '../../src/constants/contracts'; 
import { parseEther, formatUnits } from 'viem';

export default function BeautifulMultiSender() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [recipientList, setRecipientList] = useState('');
  const [statusMessage, setStatusMessage] = useState('Enter recipients and amounts below.');
  const [tokens, setTokens] = useState([]); // State to store user's tokens
  const [selectedTokenAddress, setSelectedTokenAddress] = useState('');

  const contractAddress = MULTISENDER_CONTRACTS[chainId];
  
  // Fetch native balance (ETH/Base ETH)
  const { data: nativeBalance } = useBalance({ address });

  const { data: hash, writeContract, isPending: isSending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  // Function to fetch token balances using an API (e.g., Alchemy/Etherscan)
  // This is where you would integrate an external API to get ALL balances
  const fetchTokenBalances = useCallback(async () => {
    if (!address || !chainId || !nativeBalance) return;
    
    // Placeholder logic for the native token only for now
    const nativeToken = {
        address: 'NATIVE', // Use 'NATIVE' as a special identifier
        symbol: nativeBalance.symbol,
        balanceFormatted: nativeBalance.formatted,
        decimals: nativeBalance.decimals,
    };
    setTokens([nativeToken]);
    setSelectedTokenAddress('NATIVE'); // Select native token by default

    // !!! REPLACE WITH YOUR ALCHEMY API KEY AND CORRECT NETWORK URL TO EXPAND TOKEN LIST !!!
    // The implementation for fetching all ERC20 tokens is complex and depends on an API service.
    // The current code just handles the native token.
  }, [address, chainId, nativeBalance]);

  useEffect(() => {
    if (isConnected) {
      fetchTokenBalances();
    } else {
        setTokens([]);
    }
  }, [isConnected, fetchTokenBalances]);

  const handleListChange = (e) => setRecipientList(e.target.value);

  const parseInput = () => {
    const lines = recipientList.trim().split('\n');
    const recipients = [];
    const amounts = [];
    
    // Determine decimals based on selected token (default to 18 if native/unknown)
    const selectedToken = tokens.find(t => t.address === selectedTokenAddress);
    const decimals = selectedToken ? selectedToken.decimals : 18;


    try {
      lines.forEach(line => {
        const parts = line.split(/[,\s]+/).filter(p => p.length > 0); 
        if (parts.length === 2) {
          recipients.push(parts[0]); // Address
          // Use parseUnits for flexibility with different token decimals
          amounts.push(parseUnits(parts[1], decimals)); 
        }
      });
      return { recipients, amounts };
    } catch (error) {
        setStatusMessage("Error parsing input or invalid amount format.");
        return null;
    }
  };


  const handleSubmit = async () => {
    if (!isConnected || !contractAddress || !selectedTokenAddress) {
      setStatusMessage("Wallet is disconnected or token is not selected.");
      return;
    }

    const parsedData = parseInput();
    if (!parsedData || parsedData.recipients.length === 0) return;

    setStatusMessage(`Sending ${parsedData.recipients.length} payments...`);
    
    // NOTE: If sending NATIVE tokens, the contract needs a different function 
    // that accepts `msg.value` (ETH attached to the transaction). 
    // This smart contract only handles ERC20 tokens via `transferFrom`.
    if (selectedTokenAddress === 'NATIVE') {
        setStatusMessage("This dApp only supports ERC20 tokens for batch sending, not native ETH/Base ETH yet.");
        return;
    }

    // You still need an approval step here for ERC20 tokens before calling sendTokens

    writeContract({
      address: contractAddress,
      abi: MULTISENDER_ABI,
      functionName: 'sendTokens',
      args: [selectedTokenAddress, parsedData.recipients, parsedData.amounts],
    });
  };

  useEffect(() => {
    if (isConfirmed) setStatusMessage("Transaction successful!");
    if (isConfirming) setStatusMessage("Waiting for transaction confirmation...");
    if (isSending) setStatusMessage("Check your wallet to confirm the transaction...");
  }, [isConfirmed, isConfirming, isSending]);


  // Helper function for dynamic class names (since 'cn' is missing)
  const getButtonClasses = () => {
      const base = "mt-6 w-full font-bold p-3 rounded-lg transition duration-150 ease-in-out shadow-lg";
      if (!contractAddress || isSending || isConfirming || selectedTokenAddress === 'NATIVE') {
          return `${base} bg-gray-500 opacity-50 cursor-not-allowed`;
      }
      return `${base} bg-blue-600 hover:bg-blue-700 text-white`;
  };

  const getStatusClasses = () => {
      const base = "mt-4 p-3 rounded-lg text-sm";
      if (isConfirmed) return `${base} bg-green-900`;
      if (isSending || isConfirming) return `${base} bg-blue-900`;
      return `${base} bg-gray-700`;
  };


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
            {/* Token Selector UI */}
            <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Select Token</label>
                <select 
                    value={selectedTokenAddress} 
                    onChange={(e) => setSelectedTokenAddress(e.target.value)}
                    className="w-full p-2 bg-gray-700 rounded-lg text-white"
                >
                    <option value="">Select a token...</option>
                    {tokens.map(token => (
                        <option key={token.address} value={token.address}>
                            {token.symbol} (Balance: {token.balanceFormatted})
                        </option>
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
              disabled={!contractAddress || isSending || isConfirming || !selectedTokenAddress || selectedTokenAddress === 'NATIVE'}
              className={getButtonClasses()}
            >
              {isSending || isConfirming ? 'Processing Transaction...' : 'Execute Batch Send'}
            </button>

            <div className={getStatusClasses()}>
                {statusMessage}
            </div>
            {hash && <p className="mt-2 text-xs text-gray-500 truncate">Tx Hash: {hash}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
