// app/providers.jsx
'use client'; 

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { base, mainnet } from 'wagmi/chais' 
// FIXED: Remove the invalid import of WagmiWeb3Moda
import { createWeb3Modal } from '@web3modal/wagmi'

// --- Configuration Setup ---
const projectId process.env.NEXT_PUBLIC_WALLET_CONNECTPROJECT_ID; 

if (!projectId) {
    console.error('NEXT_PUBLIC_WALLET_CONNECPROJECT_ID is not defined.'
}

const chains = [mainnet, base];

const wagmiConfig = createConfig({
  chains,
  projectId, 
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
  },
});

const queryClient = new QueryClient();

// Create the modal instance once
createWeb3Modal({
  wagmiConfig,
  projectId,
  chains,
  defaultChain: base,
  themeVariables: {
    '--w3m-accent-color': '#3b82f6',
    '--w3m-background-color': '#1f2937',
  }
});
// --- End Config Setup ---


export function WalletProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <header className="p-4 bg-gray-800 shadow-md flex justify-between items-center">
            <h1 className='text-xl font-bold'>MultiSender DApp</h1>
            {/* The comprehensive connect button that manages all wallets */}
            <w3m-button /> 
        </header>
        {children}
      </WagmiProvider>
      {/* FIXED: The WagmiWeb3Modal component is no longer needed here */}
    </QueryClientProvider>
  )
}
