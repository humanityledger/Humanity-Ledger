// System layout  No Clerk provider needed (SIWE-native auth)

import { headers } from 'next/headers'

import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'

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



const plexSans = IBM_Plex_Sans({ 

  subsets: ['latin'], 

  weight: ['400', '500', '600', '700'],

  variable: '--font-inter' // Reusing the inter variable to override all sans usages safely

})



const aztecFont = IBM_Plex_Sans({

  subsets: ['latin'],

  weight: ['400', '600', '700'],

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

    default: 'Humanity Ledger | Privacy Infrastructure on Aztec',

    template: '%s | Humanity Ledger'

  },

  description: 'Humanity Ledger is a workspace opened by a wallet signature. Ledger Chat is the messenger inside that workspace. Message bodies are encrypted on the device via XMTP.',

  keywords: [

    'humanity ledger', 'Sovereign Identity', 'studio provenance', 'LedgerChat', 'decentralised identity',

    'zero knowledge proofs', 'privacy', 'noir language', 'verifiable credentials'

  ],

  authors: [{ name: 'Humanity Ledger' }],
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon.png', type: 'image/png', sizes: '192x192' },
    ],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },

  creator: 'Humanity Ledger',

  publisher: 'Humanity Ledger',

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

  appleWebApp: {

    capable: true,

    title: 'Humanity Ledger',

    statusBarStyle: 'default',

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

        "@type": "WebSite",

        "url": "https://humanidfi.com/",

        "name": "Humanity Ledger",

        "description": "Privacy-preserving identity verification solution integrating zero knowledge proofs.",

        "potentialAction": {

          "@type": "SearchAction",

          "target": {

            "@type": "EntryPoint",

            "urlTemplate": "https://humanidfi.com/?q={search_term_string}"

          },

          "query-input": "required name=search_term_string"

        },

        "publisher": {

          "@id": "https://humanidfi.com/#organization"

        }

      },

      {

        "@type": "Organization",

        "@id": "https://humanidfi.com/#organization",

        "name": "Humanity Ledger",

        "alternateName": ["Humanity Ledger Ecosystem", "Humanity Ledger Protocol"],

        "url": "https://humanidfi.com",

        "logo": "https://humanidfi.com/logo-mark.png",

        "sameAs": [

          "https://github.com/humanityledger/Humanity-Ledger"

        ]

      },

      {

        "@type": "WebApplication",

        "name": "Humanity Ledger Platform",

        "applicationCategory": "SecurityApplication",

        "operatingSystem": "Web",

        "offers": {

          "@type": "Offer",

          "price": "0",

          "priceCurrency": "USD"

        },

        "creator": {

          "@id": "https://humanidfi.com/#organization"

        },

        "description": "Privacy-preserving identity verification and portfolio management.",

        "featureList": [

          "Identity Verification",

          "Zero Knowledge Proofs",

          "Attestation Tools",

          "Privacy-Preserving Infrastructure"

        ]

      },

      {

        "@type": "ItemList",

        "itemListElement": [

          {

            "@type": "SiteNavigationElement",

            "position": 1,

            "name": "Docs",

            "description": "Humanity Ledger SDK enables privacy-preserving identity verification.",

            "url": "https://humanidfi.com/developers/api-docs"

          },

          {

            "@type": "SiteNavigationElement",

            "position": 2,

            "name": "Portfolio App",

            "description": "Track cross-chain capital flows and asset balances locally. Portfolio data is computed locally on your device.",

            "url": "https://humanidfi.com/portfolio"

          },

          {

            "@type": "SiteNavigationElement",

            "position": 3,

            "name": "Humanity Ledger Registry Explorer",

            "description": "Explore countries with supported documents, view coverage and node density.",

            "url": "https://humanidfi.com/registry"

          }

        ]

      }

    ]

  };



  return (

    <html lang="en" className={`light bg-white ${plexSans.variable} ${aztecFont.variable} ${plexMono.variable}`} suppressHydrationWarning data-scroll-behavior="smooth">

      <head>

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


