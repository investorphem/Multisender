'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useBalance } from 'wagmi';
import { Alchemy, Network } from 'alchemy-sdk';
// CORRECTED PATHS:
import { MULTISENDER_CONTRACTS, MULTISENDER_ABI } from '../../src/constants/contracts'; 
import { ERC20_ABI } from '../../src/constants/erc20abi'; // Import the new ABI file
import { parseEther, formatUnits, parseUnits } from 'viem';

// Configure Alchemy (make sure NEXT_PUBLIC_ALCHEMY_API_KEY is set in .env.local)
const alchemyConfig = {
  apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
  // Dynamically set network based on chainId (this requires mapping chainId to Network enum)
  // For Base, we use Network.BASE_MAINNET, etc. You might need a helper function here.
  network: Network.BASE_MAINNET, // Default to Base for this example
};
const alchemy = new Alchemy(alchemyConfig);


export default function BeautifulMultiSender() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [recipientList, setRecipientList] = useState('');
  const [statusMessage, setStatusMessage] = useState('Enter recipients and amounts below.');
  const [tokens, setTokens] = useState([]);
  const [selectedTokenAddress, setSelectedTokenAddress] = useState('');
  const [isApproved, setIsApproved] = useState(false); // Track approval state
  const [totalAmountNeeded, setTotalAmountNeeded] = useState(0n); // Store total needed amount as BigInt

  const contractAddress = MULTISENDER_CONTRACTS[chainId];
  const { data: nativeBalance } = useBalance({ address });
  const selectedToken = useMemo(() => tokens.find(t => t.address === selectedTokenAddress), [selectedTokenAddress, tokens]);

  // --- Main Batch Send Hooks ---
  const { data: hash, writeContract, isPending: isSending, error: sendError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } = useWaitForTransactionReceipt({ hash });

  // --- Approval Hooks ---
  const { data: approvalHash, writeContract: approveContract, isPending: isApproving, error: approveError } = useWriteContract();
  const { isLoading: isApprovalConfirming, isSuccess: isApprovalConfirmed } = useWaitForTransactionReceipt({ hash: approvalHash });


  // Function to fetch all ERC20 token balances using Alchemy API
  const fetchTokenBalances = useCallback(async () => {
    if (!address || !chainId || !nativeBalance || !alchemyConfig.apiKey) return;

    try {
      // 1. Add Native Token
      const nativeToken = {
          address: 'NATIVE',
          symbol: nativeBalance.symbol,
          balanceFormatted: nativeBalance.formatted,
          decimals: nativeBalance.decimals,
          balanceRaw: nativeBalance.value,
      };

      // 2. Fetch ERC20 tokens with non-zero balances using Alchemy
      const balancesResponse = await alchemy.core.getTokenBalances(address);
      const nonZeroBalances = balancesResponse.tokenBalances.filter((token) => token.tokenBalance !== '0');

      const tokenDetails = await Promise.all(nonZeroBalances.map(async (token) => {
        const metadata = await alchemy.core.getTokenMetadata(token.contractAddress);
        return {
          address: token.contractAddress,
          symbol: metadata.symbol,
          decimals: metadata.decimals,
          balanceRaw: BigInt(token.tokenBalance),
          balanceFormatted: formatUnits(BigInt(token.tokenBalance), metadata.decimals || 18),
        };
      }));

      setTokens([nativeToken, ...tokenDetails.filter(t => t.symbol)]); // Filter out tokens without symbols for cleaner UI
      setSelectedTokenAddress('NATIVE');
    } catch (error) {
      console.error("Failed to fetch token balances:", error);
      setStatusMessage("Failed to fetch token balances. Check your Alchemy API key/network configuration.");
    }
  }, [address, chainId, nativeBalance]);

  useEffect(() => {
    if (isConnected) {
      fetchTokenBalances();
    } else {
        setTokens([]);
    }
  }, [isConnected, fetchTokenBalances]);

  const handleListChange = (e) => {
    setRecipientList(e.target.value);
    setIsApproved(false); // Reset approval status if input changes
  }

  const parseInput = () => {
    const lines = recipientList.trim().split('\n');
    const recipients = [];
    const amounts = [];
    let totalAmount = 0n;

    if (!selectedToken) return null;
    const decimals = selectedToken.decimals || 18;

    try {
      lines.forEach(line => {
        const parts = line.split(/[,\s]+/).filter(p => p.length > 0); 
        if (parts.length === 2) {
          recipients.push(parts[0]);
          const amountParsed = parseUnits(parts[1], decimals);
          amounts.push(amountParsed);
          totalAmount = totalAmount + amountParsed; // Calculate total sum
        }
      });
      setTotalAmountNeeded(totalAmount); // Store total amount needed for approval/validation
      return { recipients, amounts, totalAmount };
    } catch (error) {
        setStatusMessage("Error parsing input or invalid amount format.");
        return null;
    }
  };

  // --- Approval Logic ---
  const handleApprove = async () => {
    if (!contractAddress || !selectedToken || selectedTokenAddress === 'NATIVE') {
        setStatusMessage("Cannot approve native tokens or contract address is missing.");
        return;
    }
    
    // Recalculate total amount just in case the list was changed but state didn't update yet
    const parsed = parseInput(); 
    if (!parsed || parsed.recipients.length === 0) return;
    const amountToApprove = parsed.totalAmount;

    setStatusMessage(`Requesting approval for ${formatUnits(amountToApprove, selectedToken.decimals)} ${selectedToken.symbol}...`);
    
    approveContract({
        address: selectedTokenAddress, // Token contract address
        abi: ERC20_ABI, // Use the standard ERC20 ABI
        functionName: 'approve',
        args: [contractAddress, amountToApprove], // Approve the multisender contract
    });
  };

  // --- Main Submission Logic ---
  const handleSubmit = async () => {
    if (!isConnected || !contractAddress || !selectedToken) {
      setStatusMessage("Wallet is disconnected or token is not selected.");
      return;
    }

    const parsedData = parseInput();
    if (!parsedData || parsedData.recipients.length === 0) return;

    if (selectedTokenAddress === 'NATIVE') {
        // NOTE: This logic assumes your smart contract has a separate function for native transfers, 
        // or you implement a simple native transfer using wagmi's sendTransaction hook (which is simpler).
        setStatusMessage("Native ETH sending is not implemented in the current smart contract integration yet.");
        return;
    }

    // CRITICAL CHECK: Ensure approval is done and total amount is <= balance
    if (!isApproved) {
        setStatusMessage("Please complete step 1: Approve the contract to move your tokens.");
        return;
    }
    if (selectedToken.balanceRaw < parsedData.totalAmount) {
        setStatusMessage("Error: Insufficient token balance.");
        return;
    }

    setStatusMessage(`Sending ${parsedData.recipients.length} payments of ${selectedToken.symbol}...`);

    writeContract({
      address: contractAddress,
      abi: MULTISENDER_ABI,
      functionName: 'sendTokens',
      args: [selectedTokenAddress, parsedData.recipients, parsedData.amounts],
    });
  };
  
  // --- UI Effects & Status Messages ---
  useEffect(() => {
    if (isConfirmed || isApprovalConfirmed) setStatusMessage("Transaction successful!");
    if (isConfirming || isApprovalConfirming) setStatusMessage("Waiting for transaction confirmation...");
    if (isSending || isApproving) setStatusMessage("Check your wallet to confirm the transaction...");
    if (sendError || approveError || confirmError) setStatusMessage(`Error: ${sendError?.shortMessage || approveError?.shortMessage || confirmError?.shortMessage || "An unknown error occurred."}`);
  }, [isConfirmed, isConfirming, isSending, isApproving, isApprovalConfirmed, sendError, approveError, confirmError]);

  // Reset approval status if user switches token
  useEffect(() => {
    setIsApproved(false);
  }, [selectedTokenAddress]);


  // Helper functions for dynamic class names
  const getStatusClasses = () => {
      // ... same as before, maybe add an error state class ...
      const base = "mt-4 p-3 rounded-lg text-sm";
      if (isConfirmed || isApprovalConfirmed) return `${base} bg-green-900`;
      if (sendError || approveError || confirmError) return `${base} bg-red-900`;
      if (isSending || isConfirming || isApproving || isApprovalConfirming) return `${base} bg-blue-900`;
      return `${base} bg-gray-700`;
  };
  
  const getButtonClasses = (isMainButton = false) => {
    const base = "mt-4 w-full font-bold p-3 rounded-lg transition duration-150 ease-in-out shadow-lg";
    
    // Disable if wallet disconnected, no token selected, or currently processing a tx
    const isDisabled = !contractAddress || !selectedTokenAddress || isSending || isConfirming || isApproving || isApprovalConfirming;
    
    if (isDisabled) {
        return `${base} bg-gray-500 opacity-50 cursor-not-allowed`;
    }

    if (isMainButton && !isApproved && selectedTokenAddress !== 'NATIVE') {
         // Main send button is disabled until approval happens
         return `${base} bg-gray-500 opacity-50 cursor-not-allowed`;
    }
    
    // Active state styles
    if (isMainButton) {
        return `${base} bg-blue-600 hover:bg-blue-700 text-white`;
    } else {
        // Approval button specific styles (yellow/orange)
        return `${base} bg-yellow-600 hover:bg-yellow-700 text-gray-900`;
    }
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
            
            {/* Step 1: Approval Button (Conditional Display) */}
            {selectedTokenAddress && selectedTokenAddress !== 'NATIVE' && !isApproved && totalAmountNeeded > 0n && (
                <button
                    onClick={handleApprove}
                    disabled={isApproving || isApprovalConfirming || !selectedTokenAddress || totalAmountNeeded === 0n}
                    className={getButtonClasses(false)}
                >
                    {isApproving || isApprovalConfirming ? 'Confirming Approval...' : '1. Approve Contract to Spend Tokens'}
                </button>
            )}

            {/* Step 2: Main Send Button */}
            <button
              onClick={handleSubmit}
              disabled={!contractAddress || isSending || isConfirming || !selectedTokenAddress || totalAmountNeeded === 0n || (!isApproved && selectedTokenAddress !== 'NATIVE')}
              className={getButtonClasses(true)}
            >
              {isSending || isConfirming ? 'Processing Transaction...' : (selectedTokenAddress === 'NATIVE' ? 'Native Send (Disabled)' : '2. Execute Batch Send')}
            </button>

            <div className={getStatusClasses()}>
                {statusMessage}
            </div>
            {(hash || approvalHash) && <p className="mt-2 text-xs text-gray-500 truncate">Tx Hash: {hash || approvalHash}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
