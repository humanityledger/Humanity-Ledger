// System layout  No Clerk provider needed (SIWE-native auth)

import { headers } from 'next/headers'

import { Inter, IBM_Plex_Mono } from 'next/font/google'

// app/globals-compiled.css is no longer imported here. It is a Tailwind
// build of globals.css produced by `build:railway`, so importing it next to
// globals.css shipped the same 600 KB of CSS twice, and a stale local copy
// brought back rules that had since been removed (a 0.6 zoom on every page
// at desktop widths, and serif and monospace fonts on bare headings).
// globals.css already runs through Tailwind via postcss.config.js.

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

    default: 'Humanity Ledger | Ledger Chat, the messenger where your wallet is your account',

    template: '%s | Humanity Ledger'

  },

  // Every claim here must also be true in the documentation (CLAUDE.md §1).
  description: 'Humanity Ledger builds Ledger Chat: a messenger where your Ethereum wallet is your account. Direct messages are encrypted on your device with MLS through XMTP, payments are signed in your own wallet, and private payments run on the Aztec test network. Early access.',

  keywords: [

    'Humanity Ledger', 'Ledger Chat', 'humanidfi',
    'wallet messenger', 'encrypted messaging', 'XMTP', 'MLS', 'Sign in with Ethereum',
    'Aztec', 'private payments', 'zero knowledge', 'humanidfi'

  ],

  authors: [{ name: 'Humanity Ledger', url: 'https://humanidfi.com' }],
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: '/favicon.png',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Ledger',
    statusBarStyle: 'default',
  },

  creator: 'Humanity Ledger',

  publisher: 'Humanity Ledger',

  category: 'Technology',

  other: {
    'copyright': 'Copyright 2024-2026 Humanity Ledger. All Rights Reserved.',
    'author': 'Humanity Ledger',
    'owner': 'Humanity Ledger',
    'reply-to': 'humanityledger@icloud.com',
    'dc.creator': 'Humanity Ledger',
    'dc.publisher': 'Humanity Ledger',
    'dc.rights': 'Copyright 2024-2026 Humanity Ledger. All Rights Reserved.',
    'dc.language': 'en',
    'dc.subject': 'Encrypted messaging, wallet based identity, private payments',
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

    title: 'Humanity Ledger | Ledger Chat',

    description: 'A messenger where your wallet is your account. Encrypted direct messages, communities, calls and payments you sign yourself. Early access.',

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

    title: 'Humanity Ledger | Ledger Chat',

    description: 'A messenger where your wallet is your account. Encrypted direct messages, communities, calls and payments you sign yourself. Early access.',

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



  // Structured data for search engines. Every statement must also be true in
  // the documentation (CLAUDE.md §1): no company exists yet, the code is
  // source available rather than open source, and there is no token.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://humanidfi.com/#organization",
        "name": "Humanity Ledger",
        "description": "Humanity Ledger builds Ledger Chat, a private messenger where your Ethereum wallet is your account. Direct messages are encrypted on your device with MLS through XMTP, and payments are signed in your own wallet.",
        "url": "https://humanidfi.com",
        "logo": "https://humanidfi.com/logo-mark.png",
        "email": "contact@humanidfi.com",
        "foundingDate": "2024",
        "sameAs": [
          "https://es.linkedin.com/company/humanity-ledger",
          "https://github.com/humanityledger/Humanity-Ledger"
        ]
      },
      {
        "@type": "WebSite",
        "@id": "https://humanidfi.com/#website",
        "url": "https://humanidfi.com/",
        "name": "Humanity Ledger",
        "publisher": { "@id": "https://humanidfi.com/#organization" },
        "inLanguage": "en"
      },
      {
        "@type": "WebApplication",
        "name": "Ledger Chat",
        "applicationCategory": "CommunicationApplication",
        "operatingSystem": "Web browser",
        "url": "https://humanidfi.com/chat",
        "publisher": { "@id": "https://humanidfi.com/#organization" },
        "description": "The private messenger where your wallet is your account. Early access.",
        "featureList": [
          "Sign in with Ethereum (EIP-4361)",
          "Direct messages encrypted with MLS through XMTP",
          "Communities with channels and roles",
          "Voice and video calls over WebRTC",
          "Payments signed in your own wallet",
          "Private payments on the Aztec test network"
        ],
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" }
      },
      {
        "@type": "SoftwareSourceCode",
        "name": "Humanity Ledger source code",
        "codeRepository": "https://github.com/humanityledger/Humanity-Ledger",
        "programmingLanguage": ["TypeScript", "Noir", "Solidity"],
        "author": { "@id": "https://humanidfi.com/#organization" },
        "copyrightHolder": { "@id": "https://humanidfi.com/#organization" },
        "license": "https://humanidfi.com/docs/content-policy",
        "description": "Source available under a proprietary licence: published so it can be read and checked, not redistributed."
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



