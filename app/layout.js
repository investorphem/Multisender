// app/layout.js
import './globals.css';
import { WalletProviders } from './providers';

export const metadata = {
  title: 'Multi-Sender DAp
  description: 'Send batch tokelly Chain',
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
