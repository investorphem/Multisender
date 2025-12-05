'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useBalance } from 'wagmi';
import { Alchemy, Network } from 'alchemy-sdk';
import { MULTISENDER_CONTRACTS, MULTISENDER_ABI } from '../../src/constants/contracts'; 
import { ERC20_ABI } from '../../src/constants/erc20abi';
import { parseUnits, formatUnits, isAddress } from 'viem';

// Configure Alchemy (Make sure NEXT_PUBLIC_ALCHEMY_API_KEY is set in .env.local)
// NOTE: This setup needs proper mapping for a production multi-chain application.
const alchemyConfig = {
  apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET, 
};
const alchemy = new Alchemy(alchemyConfig);


export default function BeautifulMultiSender() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [recipientList, setRecipientList] = useState('');
  const [statusMessage, setStatusMessage] = useState('Enter recipients and amounts below.');
  const [allUserTokens, setAllUserTokens] = useState([]); // Master list of all user tokens with balance > 0
  const [filteredTokens, setFilteredTokens] = useState([]); // List shown in the selector/search results
  const [selectedTokenAddress, setSelectedTokenAddress] = useState('');
  const [tokenSearchTerm, setTokenSearchTerm] = useState(''); 
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


  // --- Fetching Logic (Only non-zero balances) ---
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
      
      // Filter the initial response to only include non-zero balances
      const balancesResponse = await alchemy.core.getTokenBalances(address);
      const nonZeroBalances = balancesResponse.tokenBalances.filter((token) => token.tokenBalance !== '0');

      const tokenDetails = await Promise.all(nonZeroBalances.map(async (token) => {
        const metadata = await alchemy.core.getTokenMetadata(token.contractAddress);
        return {
          address: token.contractAddress,
          symbol: metadata.symbol,
          name: metadata.name,
          decimals: metadata.decimals || 18,
          balanceRaw: BigInt(token.tokenBalance),
          balanceFormatted: formatUnits(BigInt(token.tokenBalance), metadata.decimals || 18),
        };
      }));

      const finalTokens = [nativeToken, ...tokenDetails.filter(t => t.symbol && t.balanceRaw > 0n)];
      setAllUserTokens(finalTokens);
      setFilteredTokens(finalTokens);
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


  // --- Search Logic ---
  useEffect(() => {
    if (!tokenSearchTerm) {
        setFilteredTokens(allUserTokens);
        return;
    }
    const lowerCaseSearch = tokenSearchTerm.toLowerCase();
    const results = allUserTokens.filter(token => {
        return (
            token.symbol?.toLowerCase().includes(lowerCaseSearch) ||
            token.name?.toLowerCase().includes(lowerCaseSearch) ||
            token.address?.toLowerCase().includes(lowerCaseSearch)
        );
    });
    setFilteredTokens(results);
  }, [tokenSearchTerm, allUserTokens]);


  // --- Handlers & Logic ---
  const handleListChange = (e) => {
    setRecipientList(e.target.value);
    setIsApproved(false); // Reset approval status if input changes
  }

  const handleTokenSelectChange = (e) => {
    setSelectedTokenAddress(e.target.value);
    setIsApproved(false); // Reset approval status on token change
  }

  const parseInput = () => {
    // This logic calculates totalAmountNeeded which is used for validation and approval
    const lines = recipientList.trim().split('\n');
    const amounts = [];
    const recipients = [];
    let totalAmount = 0n;

    if (!selectedToken) return null;
    const decimals = selectedToken.decimals;

    lines.forEach(line => {
        const parts = line.split(/[,\s]+/).filter(p => p.length > 0); 
        if (parts.length === 2 && isAddress(parts[0])) { // Validate address
            try {
                const amountParsed = parseUnits(parts[1], decimals);
                recipients.push(parts[0]);
                amounts.push(amountParsed);
                totalAmount = totalAmount + amountParsed;
            } catch (e) {
                // Handle invalid number formats silently in parser, user sees general error later
            }
        }
    });
    setTotalAmountNeeded(totalAmount); 
    return { recipients, amounts, totalAmount };
  };

  const handleApprove = async () => {
    if (!contractAddress || !selectedToken || selectedTokenAddress === 'NATIVE') {
        setStatusMessage("Cannot approve native tokens or contract address is missing.");
        return;
    }
    
    const parsed = parseInput(); 
    if (!parsed || parsed.recipients.length === 0 || parsed.totalAmount === 0n) return;
    
    // Check if user balance is enough for approval (prevents useless gas spend)
    if (selectedToken.balanceRaw < parsed.totalAmount) {
        setStatusMessage("Error: Insufficient token balance to cover the total send amount.");
        return;
    }

    setStatusMessage(`Requesting approval for ${formatUnits(parsed.totalAmount, selectedToken.decimals)} ${selectedToken.symbol}...`);
    
    // Call the approve function on the TOKEN contract
    approveContract({
        address: selectedTokenAddress, 
        abi: ERC20_ABI, 
        functionName: 'approve',
        args: [contractAddress, parsed.totalAmount], 
    });
  };

  const handleSubmit = async () => {
    if (!isConnected || !contractAddress || !selectedToken) {
      setStatusMessage("Wallet is disconnected or token is not selected.");
      return;
    }

    const parsedData = parseInput();
    if (!parsedData || parsedData.recipients.length === 0 || parsedData.totalAmount === 0n) return;

    if (selectedTokenAddress === 'NATIVE') {
        setStatusMessage("Native ETH sending is not implemented in this version.");
        return;
    }

    if (!isApproved) {
        setStatusMessage("Please complete step 1: Approve the contract to move your tokens.");
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
    // This effect ensures the UI reacts correctly after an approval transaction is confirmed
    if (isApprovalConfirmed) {
        setIsApproved(true); // This is key to enabling the main send button
        setStatusMessage("Approval successful! You can now proceed to Step 2: Execute Batch Send.");
    }
    if (isConfirmed) setStatusMessage("Transaction successful!");
    if (isConfirming || isApprovalConfirming) setStatusMessage("Waiting for transaction confirmation...");
    if (isSending || isApproving) setStatusMessage("Check your wallet to confirm the transaction...");
    if (sendError || approveError || confirmError) setStatusMessage(`Error: ${sendError?.shortMessage || approveError?.shortMessage || confirmError?.shortMessage || "An unknown error occurred."}`);
  }, [isConfirmed, isConfirming, isSending, isApproving, isApprovalConfirmed, sendError, approveError, confirmError]);


  // Helper functions for dynamic class names (remain identical)
  const getStatusClasses = () => {
      const base = "mt-4 p-3 rounded-lg text-sm";
      if (isConfirmed || isApprovalConfirmed) return `${base} bg-green-900`;
      if (sendError || approveError || confirmError) return `${base} bg-red-900`;
      if (isSending || isConfirming || isApproving || isApprovalConfirming) return `${base} bg-blue-900`;
      return `${base} bg-gray-700`;
  };
  
  const getButtonClasses = (isMainButton = false) => {
    const base = "mt-4 w-full font-bold p-3 rounded-lg transition duration-150 ease-in-out shadow-lg";
    
    // Main button disabled conditions
    const isMainDisabled = !contractAddress || !selectedTokenAddress || totalAmountNeeded === 0n || isSending || isConfirming || isApproving || isApprovalConfirming || (!isApproved && selectedTokenAddress !== 'NATIVE');
    
    // Approval button disabled conditions
    const isApprovalDisabled = !selectedTokenAddress || selectedTokenAddress === 'NATIVE' || totalAmountNeeded === 0n || isApproving || isApprovalConfirming;

    if (isMainButton) {
        if (isMainDisabled) return `${base} bg-gray-500 opacity-50 cursor-not-allowed`;
        return `${base} bg-blue-600 hover:bg-blue-700 text-white`;
    } else { // Approval button
        if (isApprovalDisabled) return `${base} bg-gray-500 opacity-50 cursor-not-allowed`;
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
                <label className="block text-sm font-medium mb-2">Search & Select Token</label>
                
                <input
                    type="text"
                    placeholder="Search by name, symbol, or address..."
                    className="w-full p-2 mb-2 bg-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    value={tokenSearchTerm}
                    onChange={(e) => setTokenSearchTerm(e.target.value)}
                />

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
            
            {/* Step 1: Approval Button (Only appears when needed) */}
            {selectedTokenAddress && selectedTokenAddress !== 'NATIVE' && !isApproved && totalAmountNeeded > 0n && (
                <button
                    onClick={handleApprove}
                    className={getButtonClasses(false)}
                >
                    {isApproving || isApprovalConfirming ? 'Confirming Approval...' : '1. Approve Contract to Spend Tokens'}
                </button>
            )}

            {/* Step 2: Main Send Button (Should now enable correctly after approval) */}
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
