'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useBalance } from 'wagmi';
import { Alchemy, Network } from 'alchemy-sdk';
import { MULTISENDER_CONTRACTS, MULTISENDER_ABI } from '../../src/constants/contracts'; 
import { ERC20_ABI } from '../../src/constants/erc20abi';
import { parseUnits, formatUnits, isAddress } from 'viem';
import { ChevronDown, X, Search, DollarSign } from 'lucide-react'; // Added icons

// Configure Alchemy (Make sure NEXT_PUBLIC_ALCHEMY_API_KEY is set in .env.local)
const alchemyConfig = {
  apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET, // Change this as needed for your chain
};
const alchemy = new Alchemy(alchemyConfig);


// --- Token Selector Modal Component (New UI) ---
const TokenSelectorModal = ({ isOpen, onClose, tokens, selectedTokenAddress, onSelect, searchTerm, onSearchChange }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Select Token</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name or address"
            className="w-full pl-10 pr-4 p-2 bg-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <ul className="space-y-2">
          {tokens.map((token) => (
            <li
              key={token.address}
              onClick={() => {
                onSelect(token.address);
                onClose();
              }}
              className={`p-3 rounded-lg cursor-pointer flex justify-between items-center transition duration-150 ${
                selectedTokenAddress === token.address
                  ? 'bg-blue-600 ring-2 ring-blue-400'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <div className="flex items-center">
                {/* Placeholder for Token Icon/Logo - You can replace this */}
                <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center mr-3">
                    <DollarSign size={14} className="text-white"/>
                </div>
                <div>
                  <p className="font-semibold">{token.symbol}</p>
                  <p className="text-xs text-gray-400 truncate max-w-[200px]">{token.name}</p>
                </div>
              </div>
              <div>
                <p className="font-medium">{token.balanceFormatted}</p>
              </div>
            </li>
          ))}
        </ul>
        {tokens.length === 0 && <p className="text-center text-gray-500 mt-4">No tokens found in your wallet or matching search.</p>}
      </div>
    </div>
  );
};
// --- End Token Selector Modal Component ---


export default function BeautifulMultiSender() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [recipientList, setRecipientList] = useState('');
  const [statusMessage, setStatusMessage] = useState('Enter recipients and amounts below.');
  const [allUserTokens, setAllUserTokens] = useState([]);
  const [filteredTokens, setFilteredTokens] = useState([]); 
  const [selectedTokenAddress, setSelectedTokenAddress] = useState('');
  const [tokenSearchTerm, setTokenSearchTerm] = useState(''); 
  const [isApproved, setIsApproved] = useState(false); 
  const [totalAmountNeeded, setTotalAmountNeeded] = useState(0n); 
  const [isModalOpen, setIsModalOpen] = useState(false); // State for the new modal

  const contractAddress = MULTISENDER_CONTRACTS[chainId];
  const { data: nativeBalance } = useBalance({ address });
  const selectedToken = useMemo(() => allUserTokens.find(t => t.address === selectedTokenAddress), [selectedTokenAddress, allUserTokens]);

  const { data: hash, writeContract, isPending: isSending, error: sendError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } = useWaitForTransactionReceipt({ hash });
  const { data: approvalHash, writeContract: approveContract, isPending: isApproving, error: approveError } = useWriteContract();
  const { isLoading: isApprovalConfirming, isSuccess: isApprovalConfirmed } = useWaitForTransactionReceipt({ hash: approvalHash });


  // --- Fetching Logic (Only non-zero balances) ---
  const fetchTokenBalances = useCallback(async () => {
    if (!address || !chainId || !nativeBalance || !alchemyConfig.apiKey) return;

    try {
      // ... (fetching logic remains the same as previous code) ...
      const nativeToken = {
          address: 'NATIVE', symbol: nativeBalance.symbol, name: 'Native ' + nativeBalance.symbol, balanceFormatted: nativeBalance.formatted, decimals: nativeBalance.decimals, balanceRaw: nativeBalance.value,
      };
      const balancesResponse = await alchemy.core.getTokenBalances(address);
      const nonZeroBalances = balancesResponse.tokenBalances.filter((token) => token.tokenBalance !== '0');
      const tokenDetails = await Promise.all(nonZeroBalances.map(async (token) => {
        const metadata = await alchemy.core.getTokenMetadata(token.contractAddress);
        return {
          address: token.contractAddress, symbol: metadata.symbol, name: metadata.name, decimals: metadata.decimals || 18, balanceRaw: BigInt(token.tokenBalance), balanceFormatted: formatUnits(BigInt(token.tokenBalance), metadata.decimals || 18),
        };
      }));

      const finalTokens = [nativeToken, ...tokenDetails.filter(t => t.symbol && t.balanceRaw > 0n)];
      setAllUserTokens(finalTokens);
      setFilteredTokens(finalTokens);
      setSelectedTokenAddress('NATIVE');
    } catch (error) {
      console.error("Failed to fetch token balances:", error);
      setStatusMessage("Failed to fetch token balances.");
    }
  }, [address, chainId, nativeBalance]);

  useEffect(() => {
    if (isConnected) fetchTokenBalances();
    else { setAllUserTokens([]); setFilteredTokens([]); }
  }, [isConnected, fetchTokenBalances]);


  // --- Search Logic ---
  useEffect(() => {
    if (!tokenSearchTerm) return setFilteredTokens(allUserTokens);
    const lowerCaseSearch = tokenSearchTerm.toLowerCase();
    const results = allUserTokens.filter(token => 
        token.symbol?.toLowerCase().includes(lowerCaseSearch) ||
        token.name?.toLowerCase().includes(lowerCaseSearch) ||
        token.address?.toLowerCase().includes(lowerCaseSearch)
    );
    setFilteredTokens(results);
  }, [tokenSearchTerm, allUserTokens]);


  // --- Handlers & Logic ---
  const handleListChange = (e) => {
    setRecipientList(e.target.value);
    setIsApproved(false); 
    // CRITICAL: Call parseInput immediately on change to update totalAmountNeeded for button logic
    parseInput(e.target.value); 
  }

  const handleTokenSelect = (address) => {
    setSelectedTokenAddress(address);
    setIsApproved(false);
    // Also re-parse the input list with the new token context
    parseInput(recipientList);
  }


  const parseInput = (listContent = recipientList) => {
    const lines = listContent.trim().split('\n');
    const recipients = [];
    const amounts = [];
    let totalAmount = 0n;
    // Use currently selected token for decimals if available, else default
    const decimals = selectedToken?.decimals || 18; 

    lines.forEach(line => {
        const parts = line.split(/[,\s]+/).filter(p => p.length > 0); 
        // Rudimentary validation: 2 parts and first part looks like an address
        if (parts.length === 2 && isAddress(parts[0])) { 
            try {
                const amountParsed = parseUnits(parts[1], decimals);
                recipients.push(parts[0]);
                amounts.push(amountParsed);
                totalAmount = totalAmount + amountParsed;
            } catch (e) { /* invalid number, ignore line */ }
        }
    });
    // Update the state used by the button logic
    setTotalAmountNeeded(totalAmount); 
    // Return structured data for immediate use in handlers
    return { recipients, amounts, totalAmount };
  };

  const handleApprove = async () => {
    // ... (logic remains the same) ...
    if (!contractAddress || !selectedToken || selectedTokenAddress === 'NATIVE') { return setStatusMessage("Cannot approve native tokens or contract address is missing."); }
    const parsed = parseInput(); 
    if (!parsed || parsed.totalAmount === 0n) return;
    if (selectedToken.balanceRaw < parsed.totalAmount) { return setStatusMessage("Error: Insufficient token balance."); }
    setStatusMessage(`Requesting approval for ${formatUnits(parsed.totalAmount, selectedToken.decimals)} ${selectedToken.symbol}...`);
    approveContract({
        address: selectedTokenAddress, abi: ERC20_ABI, functionName: 'approve', args: [contractAddress, parsed.totalAmount], 
    });
  };

  const handleSubmit = async () => {
    // ... (logic remains the same, assuming parseInput was called correctly before this) ...
    if (!isConnected || !selectedToken) return setStatusMessage("Wallet disconnected or token not selected.");
    const parsedData = parseInput();
    if (!parsedData || parsedData.totalAmount === 0n) return setStatusMessage("Please enter valid recipients and amounts.");
    if (selectedTokenAddress === 'NATIVE') return setStatusMessage("Native ETH sending is not implemented in this version.");
    if (!isApproved) return setStatusMessage("Please complete step 1: Approve the contract to move your tokens.");
    
    setStatusMessage(`Sending ${parsedData.recipients.length} payments of ${selectedToken.symbol}...`);
    writeContract({
      address: contractAddress, abi: MULTISENDER_ABI, functionName: 'sendTokens', args: [selectedTokenAddress, parsedData.recipients, parsedData.amounts],
    });
  };
  
  // --- UI Effects & Status Messages ---
  useEffect(() => {
    if (isApprovalConfirmed) { setIsApproved(true); setStatusMessage("Approval successful! You can now proceed to Step 2: Execute Batch Send."); }
    if (isConfirmed) setStatusMessage("Transaction successful!");
    if (isConfirming || isApprovalConfirming) setStatusMessage("Waiting for transaction confirmation...");
    if (isSending || isApproving) setStatusMessage("Check your wallet to confirm the transaction...");
    if (sendError || approveError || confirmError) setStatusMessage(`Error: ${sendError?.shortMessage || approveError?.shortMessage || confirmError?.shortMessage || "An unknown error occurred."}`);
  }, [isConfirmed, isConfirming, isSending, isApproving, isApprovalConfirmed, sendError, approveError, confirmError]);

  useEffect(() => {
    setIsApproved(false);
  }, [selectedTokenAddress]);


  // Helper functions for dynamic class names
  const getStatusClasses = () => {
      const base = "mt-4 p-3 rounded-lg text-sm";
      if (isConfirmed || isApprovalConfirmed) return `${base} bg-green-900`;
      if (sendError || approveError || confirmError) return `${base} bg-red-900`;
      if (isSending || isConfirming || isApproving || isApprovalConfirming) return `${base} bg-blue-900`;
      return `${base} bg-gray-700`;
  };
  
  const getButtonClasses = (isMainButton = false) => {
    const base = "mt-4 w-full font-bold p-3 rounded-lg transition duration-150 ease-in-out shadow-lg";
    
    // Check if valid input is present (total amount > 0)
    const hasValidInput = totalAmountNeeded > 0n; 
    const isDisabled = !contractAddress || !selectedTokenAddress || !hasValidInput || isSending || isConfirming || isApproving || isApprovalConfirming;

    if (isMainButton) {
        // Main button is disabled if no input, or if approval is needed and not done
        if (isDisabled || (!isApproved && selectedTokenAddress !== 'NATIVE')) return `${base} bg-gray-500 opacity-50 cursor-not-allowed`;
        return `${base} bg-blue-600 hover:bg-blue-700 text-white`;
    } else { // Approval button
        if (isDisabled || selectedTokenAddress === 'NATIVE') return `${base} bg-gray-500 opacity-50 cursor-not-allowed`;
        return `${base} bg-yellow-600 hover:bg-yellow-700 text-gray-900`;
    }
  };


  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md">
        {/* ... H1 and P tags remain the same ... */}

        {!isConnected ? (
           <div className="text-center p-4 bg-gray-700 rounded">
            Please connect your wallet using the button in the top right.
          </div>
        ) : (
          <div>
            {/* Token Selection Button (replaces the old <select>) */}
            <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Selected Token</label>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="w-full p-3 bg-gray-700 hover:bg-gray-600 rounded-lg flex justify-between items-center text-left"
                >
                    {selectedToken ? (
                        <div className="flex items-center">
                            <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center mr-3">
                                <DollarSign size={14} className="text-white"/>
                            </div>
                            <span className="font-semibold">{selectedToken.symbol}</span>
                            <span className="ml-2 text-gray-400">(Balance: {selectedToken.balanceFormatted})</span>
                        </div>
                    ) : (
                        <span>Select a token...</span>
                    )}
                    <ChevronDown className="w-4 h-4 ml-2" />
                </button>
            </div>
            
            {/* The new Modal UI component */}
            <TokenSelectorModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                tokens={filteredTokens}
                selectedTokenAddress={selectedTokenAddress}
                onSelect={handleTokenSelect}
                searchTerm={tokenSearchTerm}
                onSearchChange={setTokenSearchTerm}
            />


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
                    className={getButtonClasses(false)}
                >
                    {isApproving || isApprovalConfirming ? 'Confirming Approval...' : '1. Approve Contract to Spend Tokens'}
                </button>
            )}

            {/* Step 2: Main Send Button (Enabled when ready) */}
            <button
              onClick={handleSubmit}
              className={getButtonClasses(true)}
            >
              {isSending || isConfirming ? 'Processing Transaction...' : 'Execute Batch Send'}
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
