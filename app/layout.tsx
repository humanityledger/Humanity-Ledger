// System layout  No Clerk provider needed (SIWE-native auth)

import { headers } from 'next/headers'
import { LANDING_TREE_HEADER } from '@/lib/landing/device'

import { Inter, IBM_Plex_Mono, Instrument_Serif } from 'next/font/google'

// app/globals-compiled.css is no longer imported here. It is a Tailwind
// build of globals.css produced by `build:railway`, so importing it next to
// globals.css shipped the same 600 KB of CSS twice, and a stale local copy
// brought back rules that had since been removed (a 0.6 zoom on every page
// at desktop widths, and serif and monospace fonts on bare headings).
// globals.css already runs through Tailwind via postcss.config.js.

import './globals.css'
import './glassmorphism.css'

import './smooth-scroll.css'

import Providers from "@/components/Providers";

import { ClientLayout } from "@/components/layout/ClientLayout";


import { CookieProvider } from "@/components/privacy/CookieContext";

import { ErrorSuppressor } from "@/components/ui/ErrorSuppressor";

import { ReactNode } from "react";

import { MobileEnforcer } from '@/components/layout/MobileEnforcer';

import { LiveActivityLayer } from "@/components/activities/LiveActivityLayer";

import { ClientOverlays } from "@/components/layout/ClientOverlays";

import { GlobalErrorBoundary } from "@/components/ui/GlobalErrorBoundary";

import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";


import { getServerLocale, getT, loadMessages } from '@/lib/i18n/server';
import { I18nProvider } from '@/lib/i18n/client';
import { HTML_LANG } from '@/lib/i18n/locales';


// No global WalletConnect *wallet* SDK (WalletConnectProvider): it opened a second WalletConnect core and
// relay WebSocket on every page, for a pairing screen nothing in the app shows. Sign-in uses AppKit.

const inter = Inter({ 
  subsets: ['latin', 'latin-ext', 'cyrillic'], 
  variable: '--font-inter',
  display: 'swap'
})

// One Inter instance; --font-aztec-serif is mapped to it in app/globals.css (no second download).

// Editorial display face for headings on the public pages (landing, docs,
// /connect, footer). Body text stays Inter.
const displaySerif = Instrument_Serif({
  subsets: ['latin', 'latin-ext'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['400', '500', '700'],
  variable: '--font-aztec-mono',
  display: 'swap',
})



export const metadata = {

  title: {

    default: 'Humanity Ledger | Ledger Chat, the messenger where your wallet is your account',

    template: '%s | Humanity Ledger'

  },

  applicationName: 'Ledger Chat',

  // Every claim here must also be true in the documentation (CLAUDE.md §1).
  description: 'Humanity Ledger builds Ledger Chat: a messenger where your Ethereum wallet is your account. Direct messages are encrypted on your device with MLS through XMTP, payments are signed in your own wallet, and private payments run on Aztec Network.',

  keywords: [

    'Humanity Ledger', 'Ledger Chat', 'ledgerchat',
    'wallet messenger', 'encrypted messaging', 'XMTP', 'MLS', 'Sign in with Ethereum',
    'Aztec', 'private payments', 'zero knowledge', 'ledgerchat'

  ],

  authors: [{ name: 'Humanity Ledger', url: 'https://ledgerchat.org' }],
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
    title: 'Ledger Chat',
    statusBarStyle: 'default',
  },

  creator: 'Humanity Ledger',

  publisher: 'Humanity Ledger',

  category: 'Technology',

  other: {
    'copyright': 'Copyright 2024-2026 Stefan Antonio Cirisanu and the Humanity Ledger contributors. MIT OR Apache-2.0.',
    'author': 'Humanity Ledger',
    'owner': 'Humanity Ledger',
    'reply-to': 'humanityledger@icloud.com',
    'dc.creator': 'Humanity Ledger',
    'dc.publisher': 'Humanity Ledger',
    'dc.rights': 'MIT OR Apache-2.0',
    'dc.language': 'en',
    'dc.subject': 'Encrypted messaging, wallet based identity, private payments',
  },

  metadataBase: new URL('https://ledgerchat.org'),

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

    description: 'A messenger where your wallet is your account. Encrypted direct messages, communities, calls and payments you sign yourself.',

    url: 'https://ledgerchat.org',

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

    description: 'A messenger where your wallet is your account. Encrypted direct messages, communities, calls and payments you sign yourself.',

    images: ['/logo-mark.png'],

    site: '@humanityledger',

    creator: '@humanityledger',

  },

}




export const viewport = {

  themeColor: '#FFFFFF',

  width: 'device-width',

  initialScale: 1,

  // The page is never laid out wider than the screen. Without it, one element wider than a phone
  // made Safari and Chrome lay the whole app out at ~780 px and show it at half size (tablet
  // layout, tiny text), so focusing the message field zoomed in and Send was off screen.
  // Zooming in still works.
  minimumScale: 1,

  // Pinch zoom stays enabled: maximumScale 1 / userScalable false blocked
  // zooming, which fails WCAG 1.4.4 (Resize text) and the Lighthouse
  // meta-viewport audit.
  viewportFit: 'cover',

}



export default async function RootLayout({

  children,

  }: {

  children: React.ReactNode

}) {
  const t = await getT();
  // The language of this request (cookie hl_locale, else Accept-Language): rendered in it from the first byte.
  const locale = await getServerLocale();
  const messages = await loadMessages(locale);

  const headersList = await headers();

  const cookies = headersList.get('cookie');

  const nonce = headersList.get('x-nonce') || '';
  // The phone landing (/, a phone; set by middleware.ts from lib/landing/device.ts) is a page of
  // plain HTML: none of the app's fixed layers or providers, which cost frames while scrolling and
  // which it does not use. Its links into the app are full page loads, so the app arrives with
  // this whole shell. Every other request gets the shell below, unchanged.
  const mobileLanding = headersList.get(LANDING_TREE_HEADER) === 'mobile';



  // Structured data for search engines. Every statement must also be true in
  // the documentation (CLAUDE.md §1): no company exists yet, the code is
  // open source (MIT OR Apache-2.0), and there is no token.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://ledgerchat.org/#organization",
        "name": "Humanity Ledger",
        "description": "Humanity Ledger builds Ledger Chat, a private messenger where your Ethereum wallet is your account. Direct messages are encrypted on your device with MLS through XMTP, and payments are signed in your own wallet.",
        "url": "https://ledgerchat.org",
        "logo": "https://ledgerchat.org/logo-mark.png",
        "email": "contact@ledgerchat.org",
        "foundingDate": "2024",
        "sameAs": [
          "https://es.linkedin.com/company/humanity-ledger",
          "https://github.com/humanityledger/Humanity-Ledger"
        ]
      },
      {
        "@type": "WebSite",
        "@id": "https://ledgerchat.org/#website",
        "url": "https://ledgerchat.org/",
        "name": "Humanity Ledger",
        "publisher": { "@id": "https://ledgerchat.org/#organization" },
        "inLanguage": "en"
      },
      {
        "@type": "WebApplication",
        "name": "Ledger Chat",
        "applicationCategory": "CommunicationApplication",
        "operatingSystem": "Web browser",
        "url": "https://ledgerchat.org/chat",
        "publisher": { "@id": "https://ledgerchat.org/#organization" },
        "description": "The private messenger where your wallet is your account.",
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
        "author": { "@id": "https://ledgerchat.org/#organization" },
        "copyrightHolder": { "@id": "https://ledgerchat.org/#organization" },
        "license": ["https://opensource.org/licenses/MIT", "https://www.apache.org/licenses/LICENSE-2.0"],
        "description": "Open source, dual-licensed MIT OR Apache-2.0 at your option."
      }
    ]
  };


  return (

    <html lang={HTML_LANG[locale]} className={`light bg-white ${inter.variable} ${plexMono.variable} ${displaySerif.variable}`} suppressHydrationWarning data-scroll-behavior="smooth">

      <head>
        {/* The boot mark's image (components/layout/BootMark.tsx): fetched before the first paint so it never pops in. */}
        <link rel="preload" href="/boot-mark.webp" as="image" type="image/webp" />
        <meta charSet="utf-8" />
        {/* Proper viewport already handled by Next.js `viewport` export above */}
        {/* Wallet in-app browsers (MetaMask, Trust, Coinbase, Rainbow, OKX, Phantom…) draw pages larger
            than Safari or Chrome on the same phone, so Ledger Chat looked zoomed in. There the page
            is laid out ~10% wider and shown at 0.9, which matches what the phone's own browser shows.
            On iPhone only a wallet's own browser counts (its name is in the user agent): Safari with a wallet
            extension also has window.ethereum, but draws at the normal size.
            minimum-scale equal to the initial scale keeps the layout at the phone's width even if something
            overflows, so the page is never shrunk to fit. On iOS, maximum-scale equal to the initial scale stops
            Safari zooming into the message field when it is tapped. Since iOS 10 Safari ignores
            maximum-scale for pinch zoom, so pinching still works there (WCAG 1.4.4).
            Android (Chrome and others): the cap is set only while a text field is in use, from the touch
            that focuses it until it loses focus, so typing never zooms and pinch zoom works the rest of
            the time. The cap is also released when the focused field is removed from the page (a sheet closes on
            Send), when a touch never lands focus in a field, when the keyboard closes and when the tab is
            hidden, so pinch zoom can never stay locked. data-hl-device (phone | tablet | desktop) comes
            from the physical screen, so a phone never gets the tablet or desktop layout. Next.js rewrites the tag on navigation, so it is put back whenever it changes. */}
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `(function(){try{
var ua=navigator.userAgent||'';var mobile=/iPhone|iPad|iPod|Android/i.test(ua);
var named=/MetaMaskMobile|TrustWallet|Trust\\/|CoinbaseWallet|CoinbaseBrowser|Rainbow|OKApp|Phantom|imToken|TokenPocket|BitKeep|Bitget|Zerion|BinanceWeb3|Rabby|SafePal|Uniswap/i.test(ua);
var ios=/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
var de=document.documentElement;
var dev=function(){try{var sw=Math.min(screen.width,screen.height);var coarse=!!(window.matchMedia&&matchMedia('(pointer: coarse)').matches);var d=((coarse||mobile||ios)&&sw<768)||(coarse&&screen.width<1024)?'phone':(coarse||mobile||ios)?'tablet':'desktop';if(de.getAttribute('data-hl-device')!==d)de.setAttribute('data-hl-device',d)}catch(e){}};
dev();window.addEventListener('resize',dev,{passive:true});window.addEventListener('orientationchange',dev);
if(!mobile&&!ios)return;
var wallet=!!(named||(window.ethereum&&!ios));
if(wallet)document.documentElement.setAttribute('data-wallet-browser','1');
var scale=wallet?'0.9':'1';
var base='width=device-width, initial-scale='+scale+', minimum-scale='+scale+', viewport-fit=cover'+(wallet?', interactive-widget=resizes-content':'');
var locked=ios;
var tag=function(){return base+(locked?', maximum-scale='+scale:'')};
var busy=false;
var si=function(){if(busy)return;busy=true;try{var c=tag();var m=document.querySelectorAll('meta[name="viewport"]');if(!m.length){var n=document.createElement('meta');n.name='viewport';n.content=c;document.head.appendChild(n)}else{for(var i=0;i<m.length;i++)if(m[i].getAttribute('content')!==c)m[i].setAttribute('content',c)}}finally{busy=false}};
var mo=null;var watch=function(){try{if(mo)mo.disconnect();var m=document.querySelector('meta[name="viewport"]');if(m){mo=new MutationObserver(si);mo.observe(m,{attributes:true,attributeFilter:['content']})}}catch(e){}};
var queued=false;var onHead=function(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;si();watch()})};
si();watch();document.addEventListener('DOMContentLoaded',function(){si();watch()},{once:true});
try{new MutationObserver(onHead).observe(document.head,{childList:true})}catch(e){}
if(ios)return;
var editable=function(el){if(!el||el.nodeType!==1)return false;var t=el.tagName;if(t==='TEXTAREA'||el.isContentEditable)return true;if(t!=='INPUT')return false;return !/^(button|checkbox|radio|range|color|file|image|submit|reset|hidden)$/i.test(el.type||'')};
var on=function(e){var el=e.target&&e.target.closest?e.target.closest('input,textarea,[contenteditable]'):null;if(editable(el)&&!locked){locked=true;si()}};
var chk=function(){if(locked&&!editable(document.activeElement)){locked=false;si()}};
var off=function(){setTimeout(chk,250)};
var arm=function(){setTimeout(chk,900)};
document.addEventListener('touchend',arm,{capture:true,passive:true});
document.addEventListener('visibilitychange',chk);
if(window.visualViewport)window.visualViewport.addEventListener('resize',function(){setTimeout(chk,120)});
var pend=false;try{new MutationObserver(function(){if(locked&&!pend){pend=true;setTimeout(function(){pend=false;chk()},80)}}).observe(document.documentElement,{childList:true,subtree:true})}catch(e){}
document.addEventListener('touchstart',on,{capture:true,passive:true});
document.addEventListener('focusin',on,true);
document.addEventListener('focusout',off,true);
}catch(e){}})();` }} />
        <meta name="apple-mobile-web-app-capable" content="yes" />

        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        {/* Prevent iOS Safari from auto-detecting phone numbers as links */}

        <meta name="format-detection" content="telephone=no" />

        <meta name="mobile-web-app-capable" content="yes" />

        {/*  localStorage  sessionStorage polyfill for incognito (iOS/Android) 

            Runs BEFORE any script so WalletConnect pairing data can be stored.

            In iOS Safari Private, localStorage quota is 0  this patches it

            with sessionStorage so WC v2 sessions survive within the tab. */}

        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `(function(){

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

        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `(function(){

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

  // Clean up only the retired /ledger-sw.js worker if still lingering, without wiping /sw.js
  // or forcing a hard reload on every new tab (ChunkLoadError recovery above already handles
  // stale deployment chunks safely if one ever misses).
  if (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        if (regs && regs.length > 0) {
          Promise.all(regs.map(function(r) { return r.unregister(); })).then(function() {
            if (window.caches) {
              caches.keys().then(function(keys) {
                Promise.all(keys.map(function(k) { return caches.delete(k); })).then(function() {
                  window.location.reload(true);
                });
              });
            }
          });
        }
      });
    }
  } else if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(regs) {
      for (var i = 0; i < regs.length; i++) {
        var url = (regs[i].active && regs[i].active.scriptURL) || '';
        if (url.endsWith('/ledger-sw.js')) {
          regs[i].unregister().catch(function(){});
        }
      }
    }).catch(function(){});
  }

})();` }} />

        <script

          nonce={nonce} suppressHydrationWarning

          type="application/ld+json"

          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}

        />

      </head>

      <body

        className="bg-white text-black antialiased selection:bg-black/10 transition-colors duration-300"

        suppressHydrationWarning

      >





        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] bg-black text-white px-4 py-2 rounded-lg font-bold text-sm">

          {t("Skip to main content")}

        </a>

        <I18nProvider locale={locale} messages={messages}>
        {mobileLanding ? children : (<>
        <ScrollProgressBar />

        <LiveActivityLayer />

        <Providers cookies={cookies}>

          <GlobalErrorBoundary>

            <MobileEnforcer>

                  <ClientLayout>

                    <CookieProvider>

                      <ErrorSuppressor />

                      {children}

                      {/* Toasts are drawn by the island (components/activities/ToastBridge.tsx). */}

                      {/* Cookie banner completely eradicated per user request */}

                      <ClientOverlays />

                    </CookieProvider>

                  </ClientLayout>

            </MobileEnforcer>

          </GlobalErrorBoundary>

        </Providers>
        </>)}
        </I18nProvider>

      </body>

    </html>

  )

}



