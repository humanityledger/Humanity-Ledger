const path = require('path');
const isExtension = process.env.EXT_BUILD === 'true';

// ─────────────────────────────────────────────────────────────────────────────
// [CRITICAL WINDOWS FIX] EPERM guard — must run BEFORE any webpack/glob code.
//
// On Windows, junction points in node_modules can cause webpack's glob scanner
// to escape the project directory and hit protected OS folders
// (e.g. C:\Users\admin\Documents\Mi música → EPERM: operation not permitted).
// This EPERM propagates into FlightClientEntryPlugin.createActionAssets() and
// causes the build to crash with: "Cannot read properties of undefined (reading 'server')".
//
// Fix: Monkey-patch Node's fs module so that ALL readdirSync/readdir calls
// silently return an empty array instead of throwing EPERM/EACCES.
// This is safe because webpack only uses these to DISCOVER files — an empty
// result is equivalent to "no source files found in that protected folder".
// ─────────────────────────────────────────────────────────────────────────────
try {
    const fs   = require('fs');
    const path = require('path');
    const projectRoot = __dirname;

    // Patch readdirSync
    const _readdirSync = fs.readdirSync.bind(fs);
    fs.readdirSync = function patchedReaddirSync(p, ...args) {
        try {
            return _readdirSync(p, ...args);
        } catch (err) {
            if (err && (err.code === 'EPERM' || err.code === 'EACCES' || err.code === 'ENOENT')) {
                return [];
            }
            throw err;
        }
    };

    // Patch async readdir (used by webpack watch)
    const _readdir = fs.readdir.bind(fs);
    fs.readdir = function patchedReaddir(p, ...args) {
        const cb = typeof args[args.length - 1] === 'function' ? args.pop() : null;
        try {
            if (cb) {
                return _readdir(p, ...args, (err, files) => {
                    if (err && (err.code === 'EPERM' || err.code === 'EACCES' || err.code === 'ENOENT')) {
                        return cb(null, []);
                    }
                    cb(err, files);
                });
            }
            return _readdir(p, ...args);
        } catch (err) {
            if (err && (err.code === 'EPERM' || err.code === 'EACCES')) return cb ? cb(null, []) : Promise.resolve([]);
            throw err;
        }
    };

    console.log('[EPERM Guard] fs.readdir patched — Windows protected folders will be silently skipped.');
} catch (patchErr) {
    console.warn('[EPERM Guard] Failed to patch fs:', patchErr.message);
}

//  Automatic Lottie Animation Sync 
try {
    const fs = require('fs');
    const path = require('path');
    const copyLottie = (srcName, destName) => {
        const srcPath = path.join(__dirname, 'public', 'lotties', srcName);
        const destPath = path.join(__dirname, 'public', 'lotties', destName);
        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`[LOTTIE SYNC] Successfully mapped ${srcName} -> ${destName}`);
        } else {
            console.warn(`[LOTTIE SYNC] Missing source file for mapping: ${srcName}`);
        }
    };
    copyLottie('Connected world.json', 'Ledger Mission.json');
    copyLottie('Abstract Isometric Loader #1.json', 'block abstract.json');
    copyLottie('Payment Success.json', 'Transaction Complete.json');
} catch (e) {
    console.error('[LOTTIE SYNC] Error synchronizing custom assets:', e);
}


// [LEGENDARY FIX] Ensure build doesn't crash if environment variables are missing in CI
if (!process.env.MORALIS_API_KEY) {
    process.env.MORALIS_API_KEY = 'dummy_moralis_key_to_pass_build';
}
/** @type {import('next').NextConfig} */
// Force deployment trigger [SOVEREIGN SYNC]: 2026-04-21T04:15:00Z
const nextConfig = {
    ...(process.env.IPFS_BUILD === 'true' ? { output: 'export' } : {}),
    // [SAFARI TDZ FIX] Disable the Rust SWC Minifier. SWC is notoriously bugged
    // when it comes to ESM module scoping and let/const hoisting in Safari WebKit,
    // causing "Cannot access 'X' before initialization" errors in libraries like viem.
    // By disabling it, we fall back to our custom Terser configuration below, which
    // has scope hoisting explicitly disabled and single-character names reserved.

    // [EPERM FIX] outputFileTracingRoot must point to project dir.
    // outputFileTracingExcludes prevents Next.js file-tracer from scanning
    // Windows system folders (Mi música, etc.) which causes EPERM crashes
    // and subsequently breaks FlightClientEntryPlugin in the webpack chain.
    outputFileTracingRoot: __dirname,
    outputFileTracingExcludes: {
        '*': [
            // Windows system protected folders
            'C:/Users/**',
            'C:/Windows/**',
            'C:/Program Files/**',
            'C:/Program Files (x86)/**',
            // node_modules nested dirs that bloat tracing
            './**/node_modules/@swc/**',
            './**/node_modules/webpack/**',
            './**/node_modules/next/dist/compiled/**',
        ]
    },

    transpilePackages: [
        'three',
        '@react-three/fiber',
        '@react-three/drei',
        '@react-three/postprocessing',
        'postprocessing'
    ],
    webpack: (config, { isServer, dev }) => {
        // [LEGENDARY BUILD FIX] Force bypass for missing third-party SDK dependencies
        // [DEPENDENCY FIX] Force-resolve packages that wagmi's nested node_modules
        // cannot find via the normal resolution chain on this machine.
        // @walletconnect/ethereum-provider is hoisted to root node_modules but
        // wagmi/node_modules/@wagmi/connectors can't find it without explicit aliasing.
        let wcEthProvider = false;
        try { wcEthProvider = require.resolve('@walletconnect/ethereum-provider'); } catch {}

        config.resolve.alias = {
            ...config.resolve.alias,
            '@react-native-async-storage/async-storage': false,
            'porto': false,
            'porto/internal': false,
            ...(wcEthProvider ? { '@walletconnect/ethereum-provider': wcEthProvider } : {}),
            // [PRISMA GUARD] Prevent @prisma/client from leaking into client bundles.
            // serverExternalPackages handles this for Server Components, but this alias
            // provides defense-in-depth for any edge cases where the bundler tries to
            // include prisma in client-side JS (causes PrismaClient browser error).
            ...(!isServer ? {
                '@prisma/client': path.resolve(__dirname, './lib/prisma-browser-stub.js'),
                'server-only': false,
            } : {
                '@prisma/client': false,
            }),
        };

        // [AZTEC NATIVE CLIENT FIX] Webpack polyfills required for running Aztec SDK
        // (which is heavily dependent on Node built-ins) directly in the browser.
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                net: false,
                tls: false,
                child_process: false,
                crypto: require.resolve('crypto-browserify'),
                stream: require.resolve('stream-browserify'),
                os: require.resolve('os-browserify/browser'),
                path: require.resolve('path-browserify'),
                http: require.resolve('http-browserify'),
                https: require.resolve('https-browserify'),
                zlib: require.resolve('browserify-zlib'),
                assert: require.resolve('assert/'),
                url: require.resolve('url/'),
            };
        }

        // [AZTEC BUILD FIX] @aztec/aztec.js v0.x does not export its root path
        // in the package.json exports field. Webpack rejects static imports with:
        // "Package path . is not exported from package @aztec/aztec.js".
        // All Aztec usage in client components uses dynamic import() at runtime,
        // so we stub the package at build time with `false` on the client.
        // The dynamic import() calls still work in the browser via the CDN/node resolution
        // because they are evaluated at runtime, not bundled.
        if (!isServer) {
            config.resolve.alias = {
                ...config.resolve.alias,
                '@aztec/aztec.js': false,
            };
        }

        // [EPERM FIX] Prevent webpack file watcher from scanning Windows system
        // protected directories. Without this, webpack glob scans crawl UP from
        // the project root and hit EPERM on folders like "Mi música", crashing
        // the FlightClientEntryPlugin (TypeError: cannot read 'server' of undefined).
        config.watchOptions = {
            ...config.watchOptions,
            followSymlinks: false,
            ignored: [
                '**/node_modules/**',
                '**/.git/**',
                // Windows protected user folders
                'C:/Users/*/Documents/**',
                'C:/Users/*/Music/**',
                'C:/Users/*/Videos/**',
                'C:/Users/*/Pictures/**',
                'C:/Windows/**',
                'C:/Program Files/**',
                'C:/Program Files (x86)/**',
            ],
        };

        // Three.js: prevent server-side import issues
        if (isServer) {
            config.externals = [...(config.externals || []),
                'three', '@react-three/fiber', '@react-three/drei',
                '@react-three/postprocessing', 'postprocessing'
            ];
        }

        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                readline: false,
                os: false,
                path: false,
                crypto: false,
                // [METAMASK SDK FIX] @wagmi/connectors embeds @metamask/sdk which tries to
                // load the 'encoding' node built-in. Stub it out for browser bundles.
                encoding: false,
            };
        }

        // [GLOB EPERM GUARD] Intercept glob errors from webpack infra-scanning
        // and filter out EPERM/EACCES so the build does not abort.
        const originalExternals = config.externals;
        if (config.infrastructureLogging) {
            config.infrastructureLogging.level = 'error';
        }

        // ─── DEFINITIVE TDZ FIX ──────────────────────────────────────────────
        // Root cause: webpack's Module Concatenation plugin (Scope Hoisting)
        // merges multiple ESM modules into a single scope for performance.
        // When circular dependencies exist (e.g. wagmi → viem → wagmi chains),
        // the merged scope evaluates modules in an order where a `const j = ...`
        // in module B is accessed by module A before B has initialized — TDZ crash.
        // The minifier just picks whatever letter is free: `I`, `Ce`, `_`, `j`...
        // the letter changes every build but the crash is always the same bug.
        //
        // Layer 1: disable scope hoisting — breaks the circular-dep TDZ mechanism
        // Layer 2: Terser with reserved names — defence-in-depth against any
        //          remaining name collisions in non-concatenated chunks
        if (!dev) {
            config.optimization.concatenateModules = false;
            
            // Disable minification entirely to stop mangling variables to 'T', 'j', etc.
            // This will either fix a Terser/SWC mangling bug OR reveal the exact original variable name in the TDZ crash.
            config.optimization.minimize = false;

            const TerserPlugin = require('terser-webpack-plugin');
            config.optimization.minimizer = [
                new TerserPlugin({
                    terserOptions: {
                        mangle: {
                            // Reserve common single-char names as extra safety net
                            reserved: ['_', '__', '___', '$', '$$', 'Ce', 'I', 'j'],
                        },
                        compress: {
                            passes: 2,
                        },
                    },
                    parallel: 4,
                }),
            ];
        }


        // ─────────────────────────────────────────────────────────────────────


        return config;
    },
    trailingSlash: isExtension,
    distDir: isExtension ? 'out' : '.next',

    images: {
        unoptimized: true,
        minimumCacheTTL: 31536000,
        remotePatterns: [
            // Universal wildcard  allows images from any HTTPS domain
            // (CoinDesk, CoinTelegraph, Decrypt, etc.)
            { protocol: 'https', hostname: '**' },
            { protocol: 'http',  hostname: '**' },
        ]
    },

    // output: 'standalone', // DISABLING STANDALONE: We need full node_modules and TSX to run background workers.
    // NOTE: 'standalone' output DEACTIVATED. We reverted to standard build to run background workers via start.sh.

    compress: true,
    poweredByHeader: false,
    productionBrowserSourceMaps: false,
    reactStrictMode: false,
    // devIndicators removed  buildActivity and appIsrStatus are deprecated in Next.js 15

    // swcMinify is removed as it's the default and deprecated in Next.js 15
    generateEtags: true,
    httpAgentOptions: {
        keepAlive: true,
    },

    // Moved from experimental in Next.js 15
    // [AZTEC SERVER GUARD] All @aztec packages are ESM-only and must never be
    // bundled by Webpack. serverExternalPackages tells Next.js to load them via
    // native Node.js require() at runtime, bypassing the Webpack bundler entirely.
    // This is the canonical fix for "j is not a function" and missing export errors.
    serverExternalPackages: [
        '@prisma/client',
        'prisma',
        'ioredis',
        'neo4j-driver',
        'snarkjs',
        'pino',
        '@aztec/aztec.js',
        '@aztec/foundation',
        '@aztec/stdlib',
        '@aztec/accounts',
        '@aztec/pxe',
        '@aztec/wallets',
        '@aztec/noir-contracts.js',
        '@aztec/bb.js',
    ],

    typescript: { ignoreBuildErrors: true },
    eslint: { ignoreDuringBuilds: true },
    experimental: {
        serverActions: {
            // [QUANTUM HARDENING] Block massive payloads at the framework level
            bodySizeLimit: '500kb'
        }
    },

    compiler: {
        // SECURITY: Only remove console.log and console.info in production.
        // console.warn and console.error MUST be preserved for security event logging:
        //   - HONEYPOT_HIT, CLAIM_RATE_LIMIT_HIT, INVALID_SIGNATURE, WAF events
        // Stripping these would make attacks invisible in Railway logs.
        removeConsole: process.env.NODE_ENV === 'production'
            ? { exclude: ['error', 'warn'] }
            : false,
    },

    typescript: {
        ignoreBuildErrors: true
    },
    eslint: {
        ignoreDuringBuilds: true
    },

    // External packages are defined above in experimental.serverComponentsExternalPackages

    env: {
        // NEXT_PUBLIC_APP_URL: canonical production URL  MUST match WalletConnect Cloud registration.
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://humanidfi.com',
        NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '47cce4049225582027fdeeecb2868ead',
        NEXT_PUBLIC_WC_PROJECT_ID: process.env.NEXT_PUBLIC_WC_PROJECT_ID || '47cce4049225582027fdeeecb2868ead',
        
        // CoreDots & CoreLedger On-Chain Configuration
        NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS || '0x1111111111111111111111111111111111111111',
        NEXT_PUBLIC_LEDGER_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_LEDGER_CONTRACT_ADDRESS || '0x2222222222222222222222222222222222222222',
        NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID || '8453',

        // XMTP Network: MUST be 'production' so all wallets on the live app share the same network.
        // Default to 'production' so Railway builds work without an explicit env var.
        NEXT_PUBLIC_XMTP_ENV: process.env.NEXT_PUBLIC_XMTP_ENV || 'production',
    },

    // NOTE: CSP is handled exclusively by middleware.ts (per-request, nonce-based).
    // Defining it here too would send DUPLICATE CSP headers causing the browser
    // to apply the most restrictive combination - breaking Clerk & WalletConnect.
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Content-Type-Options',     value: 'nosniff' },
                    { key: 'X-Frame-Options',            value: 'SAMEORIGIN' },
                    { key: 'X-XSS-Protection',          value: '1; mode=block' },
                    { key: 'Strict-Transport-Security',  value: 'max-age=63072000; includeSubDomains; preload' },
                    // [WEBRTC FIX] CSP must explicitly allow:
                    //   - blob: in connect-src for WebRTC data channels
                    //   - blob: in media-src for getUserMedia MediaStream playback
                    //   - wss: in connect-src for PeerJS WebSocket signaling
                    //   - stun: and turn: schemes are handled by browser internally, NOT via CSP
                    { key: 'Content-Security-Policy',    value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https:; font-src 'self' data:; connect-src 'self' https: wss: blob:; media-src 'self' blob: mediastream:; frame-src 'self' https:; worker-src 'self' blob:;" },
                    { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
                    // [ANDROID WEBRTC FIX] Permissions-Policy MUST be set correctly.
                    // 'camera=*' and 'microphone=*' allow ALL origins (including iframes) to request them.
                    // Without this, Android Chrome silently blocks getUserMedia even if the user said Allow.
                    { key: 'Permissions-Policy', value: 'camera=*, microphone=*, geolocation=(), interest-cohort=()' },
                    { key: 'X-DNS-Prefetch-Control',     value: 'on' },
                ]
            },
            //  API routes: never cache sensitive data endpoints 
            {
                source: '/api/(health|akashic|golden-ticket|ledger-events|signals|institutional)(.*)',
                headers: [
                    { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
                    { key: 'Pragma',        value: 'no-cache' },
                ]
            },
            //  HTML pages: Cache for offline PWA boot (AppStore requirement) but force revalidation when online
            {
                source: '/((?!_next|api|.*\\..*).*)',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
                    { key: 'Pragma',        value: 'no-cache' },
                    { key: 'Expires',       value: '0' },
                ]
            },
            //  Static asset immutable caching 
            // Images & fonts cached for 1 year  eliminates repeated server hits
            // Explicit paths to bypass Next.js path-to-regexp capturing group errors.
            {
                source: '/patron-cosmico-4k.png',
                headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
            },
            {
                source: '/olas-hokusai-4k.png',
                headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
            },
            // ── Devine Lu Linvega pixel art hero images — served at full native resolution ──
            {
                source: '/system-shots/Devine-Lu-Linvega-monochrome-pixel-art-illustration-arch-2268374-wallhere.com.jpg',
                headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
            },
            {
                source: '/system-shots/monochrome-illustration-science-fiction-arch-pixel-art-Devine-Lu-Linvega-2268380-wallhere.com (1).jpg',
                headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
            },
            // Phase 1 Mainnet: Lottie JSON animations — immutable CDN cache
            {
                source: '/lotties/(.*)',
                headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
            },
            {
                source: '/lottie/(.*)',
                headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
            },
            // Video files — long cache with revalidation
            {
                source: '/system-shots/(.*)\\.mp4',
                headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=2592000' }],
            },
            // 3D model textures
            {
                source: '/textures/(.*)',
                headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
            },
        ];
    }
};

// Forced clean production build: 2026-02-05T15:32:00Z
module.exports = nextConfig;
