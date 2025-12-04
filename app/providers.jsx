// app/providers.jsx
'use client'; 

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { base, mainnet } from 'wagmi/chains' 
// Import connectors explicitly
import { injected, walletConnect } from 'wagmi/connectors' 
// FIXED IMPORT: Remove curly braces as ConnectButton is a default export
import ConnectButton from './components/ConnectButton'; 

// --- Configuration Setup ---
// Use the specific environment variable name
const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID; 

if (!projectId) {
    console.error('NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not defined. Wallet connection will fail.');
}

// Create the wagmi config outside the component
const wagmiConfig = createConfig({
  chains: [mainnet, base],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
  },
  projectId,
  // Explicitly list connectors to ensure multi-platform support
  connectors: [
    injected(),
    walletConnect({ projectId }),
  ],
});

const queryClient = new QueryClient();
// --- End Config Setup ---


export function WalletProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        {/* The ConnectButton will manage its own connection state */}
        <header className="p-4 bg-gray-800 shadow-md flex justify-end">
            <ConnectButton />
        </header>
        {/* Render the main application content wrapped by the providers */}
        {children}
      </WagmiProvider>
    </QueryClientProvider>
  )
}
