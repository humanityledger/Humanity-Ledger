import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Humanity Ledger',
    short_name: 'Humanity Ledger',
    description: 'Enterprise Privacy Infrastructure & Decentralised Identity on the Aztec Network.',
    start_url: '/chat',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFFFFF',
    theme_color: '#ffffff',
    categories: ['finance', 'security', 'productivity', 'utilities'],
    icons: [
      {
        src: '/icon.png',
        sizes: 'any',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: 'Portfolio',
        short_name: 'Portfolio',
        description: 'View your secure zero-knowledge assets',
        url: '/portfolio',
      },
      {
        name: 'LedgerChat',
        short_name: 'Chat',
        description: 'Open encrypted P2P communications',
        url: '/terminal',
      },
      {
        name: 'Markets',
        short_name: 'Markets',
        description: 'Access institutional market streams',
        url: '/terminal?tab=markets',
      }
    ]
  };
}
