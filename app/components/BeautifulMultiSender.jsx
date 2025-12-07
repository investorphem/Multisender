'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useBalance } fro'wagmi';
import { Alchemy, Network } from 'alchemy-sdk';
import { MULTISENDER_CONTRACTS, MULTISENDER_ABI } from '../../src/constants/contracts'; 
import { ERC20_ABI } fr '../../src/constants/erc20abi
import { parseUnits, forni, isAddress } from 'vie
import { ChevronDown, X, Sea, DollarSign } from 'lucide-react'; 

// Configure Ahemy (Make s NEXT_PUBLIC_ALCHEMY_API_KEY is set in .env.local)
const alchemyConfig = {
  apiKey: proce.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
  network Network.BASE_MAINNET, 
};
const alchemy = new Alchemy(alchemyConfig);

// --- Token Selector Modal Component (UI remains the same) ---
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
  const [totalAmountNeeded, setTotalAmountNeeded] = useState(0n); // Key state
  const [isModalOpen, setIsModalOpen] = useState(false); 

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
      // ... (fetching logic remains the same) ...
      const nativeToken = { address: 'NATIVE', symbol: nativeBalance.symbol, name: 'Native ' + nativeBalance.symbol, balanceFormatted: nativeBalance.formatted, decimals: nativeBalance.decimals, balanceRaw: nativeBalance.value, };
      const balancesResponse = await alchemy.core.getTokenBalances(address);
      const nonZeroBalances = balancesResponse.tokenBalances.filter((token) => token.tokenBalance !== '0');
      const tokenDetails = await Promise.all(nonZeroBalances.map(async (token) => {
        const metadata = await alchemy.core.getTokenMetadata(token.contractAddress);
        return { address: token.contractAddress, symbol: metadata.symbol, name: metadata.name, decimals: metadata.decimals || 18, balanceRaw: BigInt(token.tokenBalance), balanceFormatted: formatUnits(BigInt(token.tokenBalance), metadata.decimals || 18), };
      }));
      const finalTokens = [nativeToken, ...tokenDetails.filter(t => t.symbol && t.balanceRaw > 0n)];
      setAllUserTokens(finalTokens); setFilteredTokens(finalTokens); setSelectedTokenAddress('NATIVE');
    } catch (error) { console.error("Failed to fetch token balances:", error); setStatusMessage("Failed to fetch token balances."); }
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
        token.symbol?.toLowerCase().includes(lowerCaseSearch) || token.name?.toLowerCase().includes(lowerCaseSearch) || token.address?.toLowerCase().includes(lowerCaseSearch)
    );
    setFilteredTokens(results);
  }, [tokenSearchTerm, allUserTokens]);


  // --- Handlers & Logic ---

  // CRITICAL CHANGE: parseInput is called immediately here
  const handleListChange = (e) => {
    const newListContent = e.target.value;
    setRecipientList(newListContent);
    setIsApproved(false); 
    parseInput(newListContent, selectedToken); // Pass the current list content and selected token context
  }

  const handleTokenSelect = (address) => {
    setSelectedTokenAddress(address);
    setIsApproved(false);
    // Find the newly selected token immediately for the next parseInput call
    const newlySelectedToken = allUserTokens.find(t => t.address === address);
    parseInput(recipientList, newlySelectedToken);
  }

  // Helper function to calculate total amount needed from the input list
  const parseInput = (listContent, tokenContext) => {
    const lines = listContent.trim().split('\n');
    let totalAmount = 0n;
    // Use tokenContext if provided, otherwise use current state (which might be slightly delayed)
    const decimals = tokenContext?.decimals || selectedToken?.decimals || 18; 

    lines.forEach(line => {
        const parts = line.split(/[,\s]+/).filter(p => p.length > 0); 
        if (parts.length === 2 && isAddress(parts)) { 
            try {
                const amountParsed = parseUnits(parts[1], decimals); // Ensure parsing the amount part
                totalAmount = totalAmount + amountParsed;
            } catch (e) { /* invalid number, ignore line */ }
        }
    });
    // Update the state used by the button logic
    setTotalAmountNeeded(totalAmount); 
    // Return total amount for immediate use in handlers
    return totalAmount;
  };

  const handleApprove = async () => {
    if (!contractAddress || !selectedToken || selectedTokenAddress === 'NATIVE') { 
        return setStatusMessage("Cannot approve native tokens or contract address is missing."); 
    }
    
    // Use the value already calculated and stored in state
    const amountToApprove = totalAmountNeeded; 
    
    if (amountToApprove === 0n) return;

    if (selectedToken.balanceRaw < amountToApprove) {
        return setStatusMessage("Error: Insufficient token balance to cover the total send amount.");
    }

    setStatusMessage(`Requesting approval for ${formatUnits(amountToApprove, selectedToken.decimals)} ${selectedToken.symbol}...`);
    
    console.log("Attempting Approval with parameters:", {
        tokenAddress: selectedTokenAddress,
        spenderAddress: contractAddress,
        amountRaw: amountToApprove.toString(),
        amountFormatted: formatUnits(amountToApprove, selectedToken.decimals),
    });

    approveContract({
        address: selectedTokenAddress, 
        abi: ERC20_ABI, 
        functionName: 'approve',
        args: [contractAddress, amountToApprove], 
    });
  };

  const handleSubmit = async () => {
    if (!isConnected || !selectedToken) return setStatusMessage("Wallet disconnected or token not selected.");
    
    // Use the value already calculated and stored in state
    const amountToSend = totalAmountNeeded;
    
    if (amountToSend === 0n) return setStatusMessage("Please enter valid recipients and amounts.");
    if (selectedTokenAddress === 'NATIVE') return setStatusMessage("Native ETH sending is not implemented in this version.");
    if (!isApproved) return setStatusMessage("Please complete step 1: Approve the contract to move your tokens.");
    
    // Recalculate full data structure for the actual contract call arguments
    const parsedData = (listContent) => {
        const lines = listContent.trim().split('\n');
        const recipients = [];
        const amounts = [];
        const decimals = selectedToken?.decimals || 18; 
        lines.forEach(line => {
            const parts = line.split(/[,\s]+/).filter(p => p.length > 0); 
            if (parts.length === 2 && isAddress(parts)) { 
                recipients.push(parts[0]);
                amounts.push(parseUnits(parts[1], decimals));
            }
        });
        return { recipients, amounts };
    };
    const finalArgs = parsedData(recipientList);


    setStatusMessage(`Sending ${finalArgs.recipients.length} payments of ${selectedToken.symbol}...`);
    writeContract({
      address: contractAddress, 
      abi: MULTISENDER_ABI, 
      functionName: 'sendTokens', 
      args: [selectedTokenAddress, finalArgs.recipients, finalArgs.amounts],
    });
  };
  
  // ... (UI effects and helper functions remain the same) ...
  useEffect(() => {
    if (isApprovalConfirmed) { setIsApproved(true); setStatusMessage("Approval successful! You can now proceed to Step 2: Execute Batch Send."); }
    if (isConfirmed) setStatusMessage("Transaction successful!");
    if (isConfirming || isApprovalConfirming) setStatusMessage("Waiting for transaction confirmation...");
    if (isSending || isApproving) setStatusMessage("Check your wallet to confirm the transaction...");
    if (sendError || approveError || confirmError) {
        console.error("Wagmi Error Details:", sendError || approveError || confirmError);
        setStatusMessage(`Error: ${sendError?.shortMessage || approveError?.shortMessage || confirmError?.shortMessage || "An unknown error occurred. Check Console for details."}`);
    }
  }, [isConfirmed, isConfirming, isSending, isApproving, isApprovalConfirmed, sendError, approveError, confirmError]);

  useEffect(() => {
    setIsApproved(false);
  }, [selectedTokenAddress]);


  const getStatusClasses = () => { /* ... */ 
      const base = "mt-4 p-3 rounded-lg text-sm";
      if (isConfirmed || isApprovalConfirmed) return `${base} bg-green-900`;
      if (sendError || approveError || confirmError) return `${base} bg-red-900`;
      if (isSending || isConfirming || isApproving || isApprovalConfirming) return `${base} bg-blue-900`;
      return `${base} bg-gray-700`;
  };
  
  const getButtonClasses = (isMainButton = false) => {
    const base = "mt-4 w-full font-bold p-3 rounded-lg transition duration-150 ease-in-out shadow-lg";
    const hasValidInput = totalAmountNeeded > 0n; 
    const isDisabled = !contractAddress || !selectedTokenAddress || !hasValidInput || isSending || isConfirming || isApproving || isApprovalConfirming;

    if (isMainButton) {
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
        <h1 className="text-3xl font-extrabold mb-4 text-center text-blue-400">Batch Sender DApp</h1>
        <p className="mb-6 text-center text-gray-400">Send tokens to multiple addresses in one transaction.</p>

        {!isConnected ? (
           <div className="text-center p-4 bg-gray-700 rounded">
            Please connect your wallet using the button in the top right.
          </div>
        ) : (
          <div>
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
            
            {/* Step 1: Approval Button (Conditional Display, now correctly reacting to input) */}
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
