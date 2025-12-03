# Multi-Chain Batch Sender

This dApp is a decentralized application designed to facilitate bulk token transfers on any EVM-compatible blockchain. By utilizing a deployed smart contract, users can send cryptocurrency to multiple recipients in a single transaction, significantly reducing gas fees and simplifying mass payment processes.

## Features

- **Multi-Chain Support:** Works seamlessly across multiple EVM chains, including Base, Ethereum, and Polygon.
- **Gas Efficiency:** Consolidates multiple transfers into one transaction, optimizing gas costs.
- **ERC20 Token Compatibility:** Supports the batch transfer of any standard ERC20 token.
- **Intuitive UI:** A user-friendly interface built with Next.js and Tailwind CSS for a smooth experience.
- **Web3 Integration:** Securely connects to user wallets via Wagmi for seamless on-chain interaction.

## How It Works

The application operates in two main steps:

1.  **Approval:** Users first approve the `MultiSender` smart contract to move their tokens on their behalf.
2.  **Batch Transfer:** The smart contract's `sendTokens` function is invoked with the list of recipients and amounts. The contract then executes all individual transfers.

## Tech Stack

- **Frontend:** Next.js, React, Wagmi, Viem, Tailwind CSS
- **Smart Contracts:** Solidity (built using OpenZeppelin standards)
- **Deployment:** Vercel for the dApp, Hardhat/Foundry for smart contracts

## Getting Started

Follow these steps to run the dApp locally or contribute:

### Prerequisites

- [Node.js](nodejs.org) (v18 or later)
- [Hardhat](hardhat.org) or [Foundry](getfoundry.sh) (for contract interaction)
- [Metamask](metamask.io) or other EVM wallet

### Installation

```bash
# Clone the repository
git clone github.com

# Navigate to the project directory
cd your-repo-name

# Install frontend dependencies
npm install

# Run the development server
npm run dev

Contributing

We welcome contributions! Please open an issue or submit a pull request with any improvements.

License

This project is licensed under the MIT License.

### GitHub Tags (Topics)


*   `dapp`
*   `web3`
*   `blockchain`
*   `ethereum`
*   `base-chain`
*   `solidity`
*   `multisender`
*   `erc20`
*   `nextjs`
*   `wagmi`
