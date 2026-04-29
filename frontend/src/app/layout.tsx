import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kitti | The Premium 9-Card Multiplayer Platform',
  description: 'Experience the ultimate real-time 9-card Kitti game. Join public tables or host private rooms with friends. Secure, fast, and beautifully designed.',
  keywords: 'kitti card game, 9 card game, multiplayer cards, real-time gaming, card shark',
  authors: [{ name: 'Kitti Platform Team' }],
  openGraph: {
    title: 'Kitti | The Royal 9-Card Game',
    description: 'Play live Kitti with friends in a premium casino-style environment.',
    type: 'website',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kitti | The Royal 9-Card Game',
    description: 'The most beautiful way to play Kitti online.',
    images: ['/og-image.jpg'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="antialiased">
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1a0f05',
              color: '#f5e6c8',
              border: '1px solid #8b6914',
              fontFamily: 'Crimson Pro, serif',
              fontSize: '15px',
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}
