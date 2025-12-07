// app/layout.js
import './globals.css';
import { WalletProviders } from './providers';

export const metadata = {
  title: 'Multi-Sender DAppk
  description: 'Send batch tokelly Be Chain',
export default function RootLayout({child }) {
  return
    <html lang="en">
      <body
        <WalletProviders>
          {children} 
        </WalletProviders>
      </body>
    </html>
  );
}
