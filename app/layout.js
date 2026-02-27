import './globals.css';
import { WalletProviders } from './providers';

export const metadata = {
  title: 'Multi-Sender DApp',
  description: 'Send batch tokens easily on Base Chain',
  openGraph: {
    title: 'Multi-Sender DApp',
    description: 'Send batch tokens easily on Base Chain',
    url: 'https://multisender-tan.vercel.app', 
    siteName: 'Multi-Sender',
    images: [
      {
        url: '/og-image.png', // Path to image in your /public folder
        width: 1200,
        height: 630,
        alt: 'Multi-Sender DApp Preview',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Multi-Sender DApp',
    description: 'Send batch tokens easily on Base Chain',
    images: ['/og-image.png'], 
  },
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
