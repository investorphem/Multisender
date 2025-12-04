// app/providers.jsx
'use client'; 

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { base, mainnet } from 'wagmi/chains' 
import { createWeb3Modal, WagmiWeb3Modal } from '@web3modal/wagmi'

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID; 

if (!projectId) {
    console.error('NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not defined.');
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
      <WagmiWeb3Modal />
    </QueryClientProvider>
  )
}
