// app/layout.js
import './globals.css';
import { WalletProviders } from './providers';

export const metadata = {
  title: 'Multi-Sender DApp',
  description: 'Send batch tokens easily on Base Chain',
  other: {
    "talentapp:project_verification":
      "09c2e8dafc60f7cee345b410d08b59b87cfaf565309726109399e1b5f848db8de28a4dc5bc3e287110dcf99f3f3706f479ff68a371aaf24335aa9f4d5789b36a",
  },
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