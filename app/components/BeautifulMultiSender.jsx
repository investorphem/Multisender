'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useBalance } from 'wagmi';
import { Alchemy, Network } from 'alchemy-sdk';
// CORRECTED PATHS:
import { MULTISENDER_CONTRACTS, MULTISENDER_ABI } from '../../src/constants/contracts'; 
import { ERC20_ABI } from '../../src/constants/erc20abi'; // Import the new ABI file
import { parseUnits, formatUnits, isAddress } from 'viem'; // Import isAddress helper

// Configure Alchemy (make sure NEXT_PUBLIC_ALCHEMY_API_KEY is set in .env.local)
// NOTE: You must map chain IDs to Alchemy's Network enum here more robustly in a real app.
const alchemyConfig = {
  apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
  // Defaulting to a mainnet, you need logic to pick the right network dynamically
  network: Network.BASE_MAINNET, 
};
const alchemy = new Alchemy(alchemyConfig);


export default function BeautifulMultiSender() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [recipientList, setRecipientList] = useState('');
  const [statusMessage, setStatusMessage] = useState('Enter recipients and amounts below.');
  const [allUserTokens, setAllUserTokens] = useState([]); // Master list of all user tokens
  const [filteredTokens, setFilteredTokens] = useState([]); // List shown in the selector
  const [selectedTokenAddress, setSelectedTokenAddress] = useState('');
  const [tokenSearchTerm, setTokenSearchTerm] = useState(''); // New state for search input
  const [isApproved, setIsApproved] = useState(false); 
  const [totalAmountNeeded, setTotalAmountNeeded] = useState(0n); 

  const contractAddress = MULTISENDER_CONTRACTS[chainId];
  const { data: nativeBalance } = useBalance({ address });
  const selectedToken = useMemo(() => allUserTokens.find(t => t.address === selectedTokenAddress), [selectedTokenAddress, allUserTokens]);

  // --- Wagmi Hooks ---
  const { data: hash, writeContract, isPending: isSending, error: sendError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } = useWaitForTransactionReceipt({ hash });
  const { data: approvalHash, writeContract: approveContract, isPending: isApproving, error: approveError } = useWriteContract();
  const { isLoading: isApprovalConfirming, isSuccess: isApprovalConfirmed } = useWaitForTransactionReceipt({ hash: approvalHash });


  // --- Fetching Logic (runs once on connect) ---
  const fetchTokenBalances = useCallback(async () => {
    if (!address || !chainId || !nativeBalance || !alchemyConfig.apiKey) return;

    try {
      const nativeToken = {
          address: 'NATIVE',
          symbol: nativeBalance.symbol,
          name: 'Native ' + nativeBalance.symbol,
          balanceFormatted: nativeBalance.formatted,
          decimals: nativeBalance.decimals,
          balanceRaw: nativeBalance.value,
      };

      const balancesResponse = await alchemy.core.getTokenBalances(address);
      const nonZeroBalances = balancesResponse.tokenBalances.filter((token) => token.tokenBalance !== '0');

      const tokenDetails = await Promise.all(nonZeroBalances.map(async (token) => {
        const metadata = await alchemy.core.getTokenMetadata(token.contractAddress);
        return {
          address: token.contractAddress,
          symbol: metadata.symbol,
          name: metadata.name,
          decimals: metadata.decimals,
          balanceRaw: BigInt(token.tokenBalance),
          balanceFormatted: formatUnits(BigInt(token.tokenBalance), metadata.decimals || 18),
        };
      }));

      const finalTokens = [nativeToken, ...tokenDetails.filter(t => t.symbol)];
      setAllUserTokens(finalTokens);
      setFilteredTokens(finalTokens); // Initially show all tokens
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
        setAllUserTokens([]);
        setFilteredTokens([]);
    }
  }, [isConnected, fetchTokenBalances]);


  // --- Search Logic (runs as user types) ---
  useEffect(() => {
    if (!tokenSearchTerm) {
        setFilteredTokens(allUserTokens);
        return;
    }

    const lowerCaseSearch = tokenSearchTerm.toLowerCase();
    const results = allUserTokens.filter(token => {
        // Search by symbol, name, or contract address
        return (
            token.symbol?.toLowerCase().includes(lowerCaseSearch) ||
            token.name?.toLowerCase().includes(lowerCaseSearch) ||
            token.address?.toLowerCase().includes(lowerCaseSearch)
        );
    });
    setFilteredTokens(results);
  }, [tokenSearchTerm, allUserTokens]);


  // --- Handlers & Logic (rest remains similar but cleaner) ---
  const handleListChange = (e) => {
    setRecipientList(e.target.value);
    setIsApproved(false); // Reset approval status if input changes
  }

  const handleTokenSelectChange = (e) => {
    setSelectedTokenAddress(e.target.value);
    setIsApproved(false); // Reset approval status on token change
    // Optional: Clear search bar after selection for cleaner UI
    // setTokenSearchTerm(''); 
  }

  const parseInput = () => {
    // ... (rest of the parseInput function remains identical to the previous perfect code) ...
    const lines = recipientList.trim().split('\n');
    const amounts = [];
    const recipients = [];
    let totalAmount = 0n;

    if (!selectedToken) return null;
    const decimals = selectedToken.decimals || 18;

    try {
      lines.forEach(line => {
        const parts = line.split(/[,\s]+/).filter(p => p.length > 0); 
        if (parts.length === 2 && isAddress(parts[0])) { // Basic address validation added
          recipients.push(parts[0]);
          const amountParsed = parseUnits(parts[1], decimals);
          amounts.push(amountParsed);
          totalAmount = totalAmount + amountParsed; 
        }
      });
      setTotalAmountNeeded(totalAmount); 
      return { recipients, amounts, totalAmount };
    } catch (error) {
        setStatusMessage("Error parsing input or invalid amount format.");
        return null;
    }
  };

  const handleApprove = async () => {
    // ... (rest of handleApprove remains identical) ...
    if (!contractAddress || !selectedToken || selectedTokenAddress === 'NATIVE') {
        setStatusMessage("Cannot approve native tokens or contract address is missing.");
        return;
    }
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

  const handleSubmit = async () => {
    // ... (rest of handleSubmit remains identical, assuming your contract handles native differently) ...
    if (!isConnected || !contractAddress || !selectedToken) {
        setStatusMessage("Wallet is disconnected or token is not selected.");
        return;
    }
    const parsedData = parseInput();
    if (!parsedData || parsedData.recipients.length === 0) return;

    if (selectedTokenAddress === 'NATIVE') {
        setStatusMessage("Native ETH sending is not implemented in the current smart contract integration yet.");
        return;
    }
    if (!isApproved || selectedToken.balanceRaw < parsedData.totalAmount) {
        setStatusMessage(!isApproved ? "Please approve the contract first (Step 1)." : "Error: Insufficient token balance.");
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
  
  // --- UI Effects & Status Messages (remain identical) ---
  useEffect(() => {
    if (isConfirmed || isApprovalConfirmed) setStatusMessage("Transaction successful!");
    if (isConfirming || isApprovalConfirming) setStatusMessage("Waiting for transaction confirmation...");
    if (isSending || isApproving) setStatusMessage("Check your wallet to confirm the transaction...");
    if (sendError || approveError || confirmError) setStatusMessage(`Error: ${sendError?.shortMessage || approveError?.shortMessage || confirmError?.shortMessage || "An unknown error occurred."}`);
  }, [isConfirmed, isConfirming, isSending, isApproving, isApprovalConfirmed, sendError, approveError, confirmError]);

  useEffect(() => {
    setIsApproved(false);
  }, [selectedTokenAddress]);


  // Helper functions for dynamic class names (remain identical)
  const getStatusClasses = () => { /* ... */ };
  const getButtonClasses = (isMainButton = false) => { /* ... */ };


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
            {/* Token Selector UI with Search */}
            <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Search & Select Token</label>
                
                {/* Search Input Field */}
                <input
                    type="text"
                    placeholder="Search by name, symbol, or address..."
                    className="w-full p-2 mb-2 bg-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    value={tokenSearchTerm}
                    onChange={(e) => setTokenSearchTerm(e.target.value)}
                />

                {/* Dropdown Menu (only shows filtered tokens) */}
                <select 
                    value={selectedTokenAddress} 
                    onChange={handleTokenSelectChange}
                    className="w-full p-2 bg-gray-700 rounded-lg text-white"
                >
                    <option value="">Select a token...</option>
                    {filteredTokens.map(token => (
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
