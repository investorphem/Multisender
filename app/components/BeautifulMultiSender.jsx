'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from 'wagmi';
import { MULTISENDER_CONTRACTS, MULTISENDER_ABI, TOKEN_ADDRESS_TO_SEND } from '@/constants/contracts';
import { parseEther } from 'viem';
import { cn, shorten } from '@/lib/utils';

export default function BeautifulMultiSender() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { chains, switchChain } = useSwitchChain();
  const [recipientList, setRecipientList] = useState('');
  const [statusMessage, setStatusMessage] = useState('Enter recipients and amounts below.');
  const [autoChunkSize, setAutoChunkSize] = useState(120);
  const [isParsing, setIsParsing] = useState(false);
  const [txHashForUI, setTxHashForUI] = useState(null);

  // contract address mapping from your constants file
  const contractAddress = MULTISENDER_CONTRACTS[chainId];

  // Wagmi write hook (we use it similar to your original file)
  const { data: hash, writeContract, isPending: isSending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isConfirmed) setStatusMessage('Transaction successful!');
    else if (isConfirming) setStatusMessage('Waiting for transaction confirmation...');
    else if (isSending) setStatusMessage('Check your wallet to confirm the transaction...');
  }, [isConfirmed, isConfirming, isSending]);

  // parse input lines like: 0xAbC..., 1.5
  const parseInput = () => {
    setIsParsing(true);
    try {
      const lines = recipientList
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

      const recipients = [];
      const amounts = [];

      lines.forEach((line, idx) => {
        // allow comma, semicolon or whitespace separation
        const parts = line.split(/[,\s;]+/).filter(p => p.length > 0);
        if (parts.length >= 2) {
          recipients.push(parts[0]);
          // parseEther expects a string like "1.5"
          amounts.push(String(parts.slice(1).join(''))); // keep raw string to convert later
        }
      });

      setIsParsing(false);
      return { recipients, amounts };
    } catch (err) {
      setIsParsing(false);
      setStatusMessage("Error parsing input. Ensure each line is: `address, amount`");
      return null;
    }
  };

  // split lists into chunks of size `autoChunkSize`
  const chunkArray = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const handleSubmit = async () => {
    setStatusMessage('Preparing...');
    setTxHashForUI(null);

    if (!isConnected) {
      setStatusMessage('Please connect your wallet first.');
      return;
    }
    if (!contractAddress || !TOKEN_ADDRESS_TO_SEND) {
      setStatusMessage('Contract address or token address is missing for this network.');
      return;
    }

    const parsed = parseInput();
    if (!parsed || parsed.recipients.length === 0) {
      setStatusMessage('No valid recipients parsed.');
      return;
    }

    try {
      // Convert amounts to wei using parseEther for each
      const recipients = parsed.recipients;
      const amountsRaw = parsed.amounts;
      const amountsWei = amountsRaw.map(a => parseEther(a)); // using viem parseEther like your file

      // chunk recipients and amounts by autoChunkSize and call writeContract for each chunk
      const recipientChunks = chunkArray(recipients, autoChunkSize);
      const amountChunks = chunkArray(amountsWei, autoChunkSize);

      setStatusMessage(`Sending ${recipients.length} payments in ${recipientChunks.length} chunk(s)...`);

      for (let i = 0; i < recipientChunks.length; i++) {
        const args = [TOKEN_ADDRESS_TO_SEND, recipientChunks[i], amountChunks[i]];
        // Trigger the wagmi writeContract call
        writeContract({
          address: contractAddress,
          abi: MULTISENDER_ABI,
          functionName: 'sendTokens',
          args,
        });
        // We rely on useWaitForTransactionReceipt to update status; in case multiple chunks, user will confirm subsequent txs as needed.
      }
    } catch (err) {
      console.error(err);
      setStatusMessage(err?.data?.message || err?.message || 'Failed to send batch');
    }
  };

  // small UI pieces
  const recipientCount = useMemo(() => {
    return recipientList.split('\n').map(l => l.trim()).filter(Boolean).length;
  }, [recipientList]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xl shadow-xl">MS</div>
            <div>
              <h1 className="text-2xl font-extrabold">MultiSender</h1>
              <p className="text-sm text-gray-300">Send ERC-20 tokens to many addresses — test on a testnet first.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isConnected ? (
              <div className="bg-white/5 px-3 py-1 rounded-md">
                <div className="text-sm">{shorten(address || '')}</div>
              </div>
            ) : (
              <div className="text-sm text-gray-300">Wallet not connected</div>
            )}
          </div>
        </header>

        <main className="bg-gray-800/60 p-6 rounded-2xl shadow-2xl border border-gray-700">
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: form */}
            <div className="lg:col-span-2">
              <label className="block mb-2 text-sm text-gray-300">Network</label>
              <div className="mb-4 flex gap-3 items-center">
                <select
                  value={chainId}
                  onChange={(e) => switchChain({ chainId: parseInt(e.target.value) })}
                  className="bg-gray-700 text-white p-2 rounded-md border border-gray-600"
                >
                  {chains.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <div className="ml-auto text-sm text-gray-300">Contract: <span className="font-mono">{contractAddress ? shorten(contractAddress) : '—'}</span></div>
              </div>

              <label className="block text-sm text-gray-300 mb-2">Recipients (one per line)</label>
              <textarea
                value={recipientList}
                onChange={(e) => setRecipientList(e.target.value)}
                placeholder="0xAbCd...123, 0.01"
                className="w-full rounded-lg p-4 bg-gray-700 text-white placeholder-gray-400 border border-gray-600 h-56 resize-none focus:outline-none"
              />

              <div className="flex items-center gap-3 mt-3">
                <div className="text-sm text-gray-300">Auto chunk size</div>
                <input
                  type="number"
                  value={autoChunkSize}
                  onChange={(e) => setAutoChunkSize(Number(e.target.value || 120))}
                  className="w-28 p-2 rounded bg-gray-700 border border-gray-600"
                />
                <div className="ml-auto text-sm text-gray-300">Lines: <span className="font-semibold">{recipientCount}</span></div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={!isConnected || isSending || isConfirming}
                  className={cn(
                    'px-6 py-3 rounded-xl font-semibold shadow-lg transition',
                    !isConnected ? 'bg-gray-600 text-gray-300' : 'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-900'
                  )}
                >
                  {isSending || isConfirming ? 'Processing Transaction...' : 'Execute Batch Send'}
                </button>

                <button
                  onClick={() => {
                    setRecipientList('');
                    setStatusMessage('Enter recipients and amounts below.');
                    setTxHashForUI(null);
                  }}
                  className="px-4 py-3 rounded-xl bg-white/5"
                >
                  Clear
                </button>
              </div>

              <div className="mt-4 rounded-lg p-3 bg-gray-700 border border-gray-600 text-sm">
                <div className="mb-1"><strong>Status:</strong> {statusMessage}</div>
                {hash && <div className="mt-2 text-xs text-gray-400 truncate">Tx Hash: {hash}</div>}
              </div>
            </div>

            {/* Right: preview & tips */}
            <aside className="p-4 rounded-xl bg-gradient-to-b from-gray-900/60 to-gray-800/40 border border-gray-700">
              <h3 className="text-lg font-semibold mb-3">Preview & Tips</h3>

              <div className="mb-3 text-sm text-gray-300">
                <div>Parsed rows: <strong>{recipientCount}</strong></div>
                <div className="mt-3">First 5 preview lines:</div>
                <pre className="mt-2 text-xs bg-gray-800 p-2 rounded h-36 overflow-auto text-gray-200">
{recipientList.split('\n').filter(Boolean).slice(0,5).join('\n') || '—'}
                </pre>
              </div>

              <div className="text-sm text-gray-300 space-y-2">
                <div>• Test on a testnet first.</div>
                <div>• Approve token to the contract before sending (required).</div>
                <div>• Chunk size helps avoid gas limits.</div>
                <div>• Use token decimals when parsing if not 18.</div>
              </div>
            </aside>
          </section>
        </main>

        <footer className="mt-6 text-center text-sm text-gray-400">
          Made with ❤️ — remember to test on a testnet before mainnet.
        </footer>
      </div>
    </div>
  );
}