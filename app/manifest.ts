import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ledger Chat',
    short_name: 'Ledger Chat',
    description: 'Enterprise Privacy Infrastructure & Decentralised Identity on the Aztec Network.',
    start_url: '/chat',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFFFFF',
    theme_color: '#FFFFFF',
    categories: ['finance', 'security', 'productivity', 'utilities'],
    icons: [
      {
        src: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: 'Chat',
        short_name: 'Chat',
        description: 'Open encrypted P2P communications',
        url: '/chat',
      },
      {
        name: 'Communities',
        short_name: 'Communities',
        description: 'Open your communities',
        url: '/communities',
      }
    ]
  };
}
