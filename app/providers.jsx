// app/providers.jsx
'use client'; 

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { base, mainnet } from 'wagmi/chains' 
import { ConnectButton } from './components/ConnectButton'; // We will create this next

const projectId = process.env.NEXT_PUBLIC_PROJECT_ID; 

if (!projectId) {
    console.error('NEXT_PUBLIC_PROJECT_ID is not defined. Wallet connection will fail.');
}

// 2. Create the wagmi config outside the component
const wagmiConfig = createConfig({
  chains: [mainnet, base],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
  },
  projectId,
});

const queryClient = new QueryClient();

export function WalletProviders({ children }) {
  // We don't need the 'ready' state here anymore as we use ConnectButton
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        {/* The ConnectButton will manage its own connection state */}
        <header className="p-4 bg-gray-800 shadow-md flex justify-end">
            <ConnectButton />
        </header>
        {children}
      </WagmiProvider>
    </QueryClientProvider>
  )
}
