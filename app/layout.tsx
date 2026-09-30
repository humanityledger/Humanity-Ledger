// System layout  No Clerk provider needed (SIWE-native auth)

import { headers } from 'next/headers'

import { Inter, IBM_Plex_Mono } from 'next/font/google'

import './globals-compiled.css'

import './globals.css'

import './smooth-scroll.css'

import Providers from "@/components/Providers";

import { ClientLayout } from "@/components/layout/ClientLayout";

import { Toaster } from 'sonner'

import { CookieProvider } from "@/components/privacy/CookieContext";

import { ErrorSuppressor } from "@/components/ui/ErrorSuppressor";

import { ReactNode } from "react";

import { MobileEnforcer } from '@/components/layout/MobileEnforcer';

import { DynamicIsland } from "@/components/ui/DynamicIsland";

import { ClientOverlays } from "@/components/layout/ClientOverlays";

import { GlobalErrorBoundary } from "@/components/ui/GlobalErrorBoundary";

import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";

import { AntiTamperCore } from "@/components/security/AntiTamperCore";

import { AztecProvider } from "@/context/AztecContext";

import { AztecNativeProvider } from "@/context/AztecNativeContext";

import { WalletConnectProvider } from '@/components/walletconnect/WalletConnectProvider';

const inter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-inter',
  display: 'swap'
})

const aztecFont = Inter({
  subsets: ['latin'],
  variable: '--font-aztec-serif',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-aztec-mono',
  display: 'swap',
})



export const metadata = {

  title: {

    default: 'Humanity Ledger | Privacy & Sovereign Identity on Aztec Network',

    template: '%s | Humanity Ledger — by Stefan Antonio Cirisanu'

  },

  description: 'Humanity Ledger is the privacy-first sovereign identity and encrypted messaging protocol built on the Aztec Network. Founded and created by Stefan Antonio Cirisanu. Includes LedgerChat (E2E encrypted messenger), QD Token economy, Studio Provenance, and Zero Knowledge proof infrastructure.',

  keywords: [

    'Humanity Ledger', 'Stefan Antonio Cirisanu', 'Stefan Cirisanu', 'LedgerChat',
    'Sovereign Identity', 'Aztec Network', 'Zero Knowledge Proofs', 'ZK Messenger',
    'QD Token', 'Studio Provenance', 'decentralized identity', 'encrypted messaging',
    'privacy protocol', 'XMTP messenger', 'Noir language ZK', 'privacy infrastructure blockchain',
    'on-chain identity verification', 'Aztec sequencer testnet', 'humanidfi', 'humanidfi.com'

  ],

  authors: [{ name: 'Stefan Antonio Cirisanu', url: 'https://humanidfi.com' }],
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon.png', type: 'image/png', sizes: '192x192' },
    ],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Ledger',
    statusBarStyle: 'black-translucent',
  },

  creator: 'Stefan Antonio Cirisanu',

  publisher: 'Humanity Ledger — Stefan Antonio Cirisanu',

  category: 'Technology',

  other: {
    'copyright': 'Copyright 2024-2026 Stefan Antonio Cirisanu. All Rights Reserved.',
    'author': 'Stefan Antonio Cirisanu',
    'owner': 'Stefan Antonio Cirisanu',
    'reply-to': 'legal@humanidfi.com',
    'dc.creator': 'Stefan Antonio Cirisanu',
    'dc.publisher': 'Humanity Ledger',
    'dc.rights': 'Copyright 2024-2026 Stefan Antonio Cirisanu. All Rights Reserved.',
    'dc.language': 'en',
    'dc.subject': 'Privacy Infrastructure, Sovereign Identity, Zero Knowledge Proofs, Aztec Network',
  },

  metadataBase: new URL('https://humanidfi.com'),

  alternates: {

    canonical: '/',

  },

  robots: {

    index: true,

    follow: true,

    nocache: false,

    googleBot: {

      index: true,

      follow: true,

      noimageindex: false,

      'max-video-preview': -1,

      'max-image-preview': 'large',

      'max-snippet': -1,

    },

  },

  openGraph: {

    title: 'Humanity Ledger | Privacy Infrastructure on Aztec',

    description: 'Claim your decentralised identity, access Studio Provenance, and communicate securely via Ledger Chat using zero knowledge proofs.',

    url: 'https://humanidfi.com',

    siteName: 'Humanity Ledger',

    images: [

      {

        url: '/logo-mark.png',

        width: 1200,

        height: 1200,

        alt: 'Humanity Ledger Logo',

      },

    ],

    locale: 'en_US',

    type: 'website',

  },

  twitter: {

    card: 'summary_large_image',

    title: 'Humanity Ledger | Privacy Infrastructure on Aztec',

    description: 'Claim your decentralised identity, access Studio Provenance, and communicate securely via Ledger Chat using zero knowledge proofs.',

    images: ['/logo-mark.png'],

    site: '@humanityledger',

    creator: '@humanityledger',

  },

}




export const viewport = {

  themeColor: '#FFFFFF',

  width: 'device-width',

  initialScale: 1,

  maximumScale: 1,

  userScalable: false,

  viewportFit: 'cover',

  interactiveWidget: 'resizes-content',

}



export default async function RootLayout({

  children,

  }: {

  children: React.ReactNode

}) {

  const headersList = await headers();

  const cookies = headersList.get('cookie');

  const nonce = headersList.get('x-nonce') || '';



  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": "https://humanidfi.com/#founder",
        "name": "Stefan Antonio Cirisanu",
        "alternateName": "Stefan Cirisanu",
        "jobTitle": "Founder & CEO",
        "description": "Stefan Antonio Cirisanu is the sole founder, creator, and owner of Humanity Ledger — a privacy-first sovereign identity and encrypted communications protocol built on the Aztec Network.",
        "url": "https://humanidfi.com",
        "email": "legal@humanidfi.com",
        "sameAs": [
          "https://github.com/humanityledger",
          "https://humanidfi.com"
        ],
        "worksFor": { "@id": "https://humanidfi.com/#organization" },
        "founder": { "@id": "https://humanidfi.com/#organization" }
      },
      {
        "@type": "Organization",
        "@id": "https://humanidfi.com/#organization",
        "name": "Humanity Ledger",
        "legalName": "Humanity Ledger",
        "alternateName": ["Humanity Ledger Protocol", "Humanity Ledger Ecosystem", "humanidfi"],
        "description": "Humanity Ledger is a privacy-preserving sovereign identity and encrypted messaging protocol built on the Aztec Network. Founded and owned by Stefan Antonio Cirisanu.",
        "url": "https://humanidfi.com",
        "logo": "https://humanidfi.com/logo-mark.png",
        "email": "legal@humanidfi.com",
        "foundingDate": "2024",
        "founders": [{ "@id": "https://humanidfi.com/#founder" }],
        "sameAs": [
          "https://github.com/humanityledger/Humanity-Ledger",
          "https://humanidfi.com"
        ]
      },
      {
        "@type": "WebSite",
        "@id": "https://humanidfi.com/#website",
        "url": "https://humanidfi.com/",
        "name": "Humanity Ledger",
        "description": "Privacy-first sovereign identity protocol and encrypted messenger by Stefan Antonio Cirisanu.",
        "publisher": { "@id": "https://humanidfi.com/#organization" },
        "author": { "@id": "https://humanidfi.com/#founder" },
        "copyrightHolder": { "@id": "https://humanidfi.com/#founder" },
        "copyrightYear": "2024",
        "inLanguage": "en-US",
        "potentialAction": {
          "@type": "SearchAction",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": "https://humanidfi.com/?q={search_term_string}"
          },
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@type": "WebApplication",
        "name": "Humanity Ledger Platform",
        "alternateName": "LedgerChat",
        "applicationCategory": "SecurityApplication",
        "operatingSystem": "Web, iOS, Android",
        "url": "https://humanidfi.com",
        "author": { "@id": "https://humanidfi.com/#founder" },
        "creator": { "@id": "https://humanidfi.com/#founder" },
        "copyrightHolder": { "@id": "https://humanidfi.com/#founder" },
        "copyrightYear": "2024",
        "description": "LedgerChat is an end-to-end encrypted sovereign messenger by Stefan Antonio Cirisanu.",
        "featureList": [
          "End-to-End Encrypted Messaging",
          "Sovereign Identity (wallet-native)",
          "Zero Knowledge Proof Verification",
          "QD Token Payments in Chat",
          "Studio Provenance for Artists",
          "Aztec Network Sequencer Integration"
        ],
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
      },
      {
        "@type": "SoftwareSourceCode",
        "name": "Humanity Ledger Source Code",
        "codeRepository": "https://github.com/humanityledger/Humanity-Ledger",
        "programmingLanguage": ["TypeScript", "Rust", "Noir", "Solidity"],
        "author": { "@id": "https://humanidfi.com/#founder" },
        "copyrightHolder": { "@id": "https://humanidfi.com/#founder" },
        "copyrightYear": "2024",
        "license": "https://humanidfi.com/legal/ownership",
        "description": "Source code for the Humanity Ledger protocol — written by Stefan Antonio Cirisanu. Unauthorized commercial use is prohibited."
      },
      {
        "@type": "ItemList",
        "itemListElement": [
          { "@type": "SiteNavigationElement", "position": 1, "name": "Ledger Chat", "url": "https://humanidfi.com/ledger-chat" },
          { "@type": "SiteNavigationElement", "position": 2, "name": "Sovereign Identity", "url": "https://humanidfi.com/sovereign-identity" },
          { "@type": "SiteNavigationElement", "position": 3, "name": "QD Token", "url": "https://humanidfi.com/qd-token" },
          { "@type": "SiteNavigationElement", "position": 4, "name": "Studio Provenance", "url": "https://humanidfi.com/studio-provenance" },
          { "@type": "SiteNavigationElement", "position": 5, "name": "Developer API Docs", "url": "https://humanidfi.com/developers/api-docs" },
          { "@type": "SiteNavigationElement", "position": 6, "name": "Legal & Ownership", "url": "https://humanidfi.com/legal/ownership" }
        ]
      }
    ]
  };




  return (

    <html lang="en" className={`light bg-white ${inter.variable} ${aztecFont.variable} ${plexMono.variable}`} suppressHydrationWarning data-scroll-behavior="smooth">

      <head>
        <meta charSet="utf-8" />
        {/* Proper viewport already handled by Next.js `viewport` export above */}
        <meta name="apple-mobile-web-app-capable" content="yes" />

        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        {/* Prevent iOS Safari from auto-detecting phone numbers as links */}

        <meta name="format-detection" content="telephone=no" />

        <meta name="mobile-web-app-capable" content="yes" />

        {/*  localStorage  sessionStorage polyfill for incognito (iOS/Android) 

            Runs BEFORE any script so WalletConnect pairing data can be stored.

            In iOS Safari Private, localStorage quota is 0  this patches it

            with sessionStorage so WC v2 sessions survive within the tab. */}

        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: `(function(){

  try{

    window.localStorage.setItem('__humanid_probe__','1');

    window.localStorage.removeItem('__humanid_probe__');

  }catch(e){

    try{

      var _ss=window.sessionStorage;

      Object.defineProperty(window,'localStorage',{

        configurable:true,enumerable:true,

        get:function(){return _ss;}

      });

    }catch(e2){}

  }

})();` }} />

        {/*  Global ChunkLoadError Recovery 

            Catches router-level dynamic import failures (stale deployment)

            that bubble past React Error Boundaries. */}

        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: `(function(){

  // ?????? ChunkLoadError Recovery v2 ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

  // After a Railway deploy, old JS chunk URLs (with old content hashes) return

  // 404. This causes React hydration failures and broken layouts. The fix:

  // 1. Detect the error  2. Clear ALL SW caches  3. Hard-reload from server

  var RELOAD_KEY = 'chunk_reload_v2';

  var RELOAD_TS_KEY = 'chunk_reload_ts';



  function isChunkError(msg) {

    return msg && (

      msg.includes('ChunkLoadError') ||

      msg.includes('dynamically imported module') ||

      msg.includes('Failed to fetch dynamically') ||

      msg.includes('Loading chunk') ||

      msg.includes('Loading CSS chunk')

    );

  }



  function clearCachesAndReload() {

    var now = Date.now();

    var lastReload = parseInt(sessionStorage.getItem(RELOAD_TS_KEY) || '0', 10);

    // Prevent reload loops: only allow one auto-reload per 10 seconds

    if (now - lastReload < 10000) { return; }

    sessionStorage.setItem(RELOAD_TS_KEY, now.toString());

    // Tell the Service Worker to clear all its caches before we reload

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {

      var mc = new MessageChannel();

      mc.port1.onmessage = function() { window.location.reload(true); };

      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_ALL_CACHES' }, [mc.port2]);

      // Fallback: reload after 800ms even if SW doesn't respond

      setTimeout(function() { window.location.reload(true); }, 800);

    } else {

      // No SW ??? also manually delete caches via CacheStorage API

      if (window.caches) {

        window.caches.keys().then(function(keys) {

          return Promise.all(keys.map(function(k) { return window.caches.delete(k); }));

        }).then(function() { window.location.reload(true); }).catch(function() { window.location.reload(true); });

      } else {

        window.location.reload(true);

      }

    }

      }
    }
  }

  window.addEventListener('unhandledrejection', function(event) {
    var msg = event.reason ? (event.reason.message || event.reason.name || String(event.reason) || '') : '';
    if (isChunkError(msg)) {
      event.preventDefault();
      clearCachesAndReload();
    }
    // Non-chunk errors: log to console only — do NOT show visible red divs in production
  });

  window.addEventListener('error', function(event) {
    var msg = (event.message || '') + ' ' + (event.filename || '') + ':' + (event.lineno || '');
    if (isChunkError(msg)) {
      clearCachesAndReload();
    }
    // Non-chunk errors: log to console only — do NOT show visible red divs in production
  }, true);

  // ?????? Nuclear Service Worker Purge ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
  // If the user is stuck with a broken SW returning HTML for CSS (un-styled page)

  // or an old cached HTML, we force an unregister ONCE per session.

  // MOBILE FIX: Do NOT auto-reload on mobile as it creates infinite refresh loops

  // on iOS Safari where sessionStorage persists across same-domain navigations.

  var NUCLEAR_KEY = 'sw_nuclear_purge_v6';

  var isMobileSW = /android|iphone|ipad|ipod/i.test(navigator.userAgent || '');

  if (!sessionStorage.getItem(NUCLEAR_KEY)) {

    sessionStorage.setItem(NUCLEAR_KEY, '1');

    if ('serviceWorker' in navigator && !isMobileSW) {

      navigator.serviceWorker.getRegistrations().then(function(regs) {

        if (!regs || regs.length === 0) return; // no SW ??? nothing to do, skip reload

        var unregs = regs.map(function(r) { return r.unregister(); });

        Promise.all(unregs).then(function() {

          if (window.caches) {

            window.caches.keys().then(function(keys) {

              Promise.all(keys.map(function(k) { return window.caches.delete(k); }))

                .then(function() { window.location.reload(true); })

                .catch(function() { window.location.reload(true); });

            });

          } else {

            window.location.reload(true);

          }

        });

      });

    }

  }



})();` }} />

        <script

          nonce={nonce}

          type="application/ld+json"

          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}

        />

      </head>

      <body

        className="bg-white text-black antialiased selection:bg-black/10 transition-colors duration-300"

        suppressHydrationWarning

      >





        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] bg-black text-white px-4 py-2 rounded-lg font-bold text-sm">

          Skip to main content

        </a>

        <ScrollProgressBar />

        <DynamicIsland />

        <Providers cookies={cookies}>

          <GlobalErrorBoundary>

            <MobileEnforcer>

              <AztecProvider>

                <AztecNativeProvider>

                  <ClientLayout>

                    <CookieProvider>

                      <ErrorSuppressor />

                      <AntiTamperCore />

                      {children}

                      <Toaster richColors position="top-right" />

                      {/* Cookie banner completely eradicated per user request */}

                      <ClientOverlays />

                      <WalletConnectProvider />

                    </CookieProvider>

                  </ClientLayout>

                </AztecNativeProvider>

              </AztecProvider>

            </MobileEnforcer>

          </GlobalErrorBoundary>

        </Providers>

      </body>

    </html>

  )

}


