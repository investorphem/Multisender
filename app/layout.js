// app/layout.js
import './globals.css';
import { WalletProviders } from './providers';

export const metadata = {
  title: 'Multi-Sender DApp',
  description: 'Send batch tokens easily on Base Chain',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <WalletProviders>
          {children} 
        </WalletProviders>
      </body>
    </html>
  );
}
