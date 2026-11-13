const path = require('path');
const isExtension = process.env.EXT_BUILD === 'true';

// ─────────────────────────────────────────────────────────────────────────────
// [CRITICAL WINDOWS FIX] EPERM guard — must run BEFORE any webpack/glob code.
// Only applicable on Windows platform where junction points cause EPERM.
// ─────────────────────────────────────────────────────────────────────────────
if (process.platform === 'win32') {
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
}

// ─────────────────────────────────────────────────────────────────────────────
// [NODE-FETCH ESM INTERCEPTOR & CROSS-FETCH PATCH]
// node-fetch v3 is pure ESM. When CommonJS libraries (e.g. @walletconnect, cross-fetch)
// call require('node-fetch'), Node.js throws ERR_REQUIRE_ESM and crashes SSR.
// We patch cross-fetch files to use globalThis.fetch and intercept any residual calls.
// ─────────────────────────────────────────────────────────────────────────────
try {
    require('./scripts/cross-fetch-patch.js');
} catch (e) {
    console.warn('[Fetch Bridge] Failed to execute cross-fetch-patch:', e.message);
}
try {
    const Module = require('module');
    const _origModuleLoad = Module._load;
    const ponyfill = require('./lib/cross-fetch-ponyfill.js');
    Module._load = function patchedModuleLoad(request, parent, isMain) {
        if (request === 'node-fetch' || request === 'node-fetch/src/index.js') {
            return ponyfill;
        }
        return _origModuleLoad.apply(this, arguments);
    };
    console.log('[Fetch Bridge] Module._load patched — node-fetch calls redirected to native fetch.');
} catch (e) {
    console.warn('[Fetch Bridge] Failed to patch Module._load:', e.message);
}

// [LEGENDARY FIX] Ensure build doesn't crash if environment variables are missing in CI
if (!process.env.MORALIS_API_KEY) {
    process.env.MORALIS_API_KEY = 'dummy_moralis_key_to_pass_build';
}
/** @type {import('next').NextConfig} */
// Force deployment trigger [SOVEREIGN SYNC]: 2026-04-21T04:15:00Z
const nextConfig = {
    ...(process.env.IPFS_BUILD === 'true' ? { output: 'export' } : {}),
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
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
            'cross-fetch': path.resolve(__dirname, './lib/cross-fetch-ponyfill.js'),
            'node-fetch': path.resolve(__dirname, './lib/cross-fetch-ponyfill.js'),
            '@react-native-async-storage/async-storage': false,
            'porto': false,
            'porto/internal': false,
            '@x402/core/client': false,
            '@x402/evm/exact/client': false,
            '@x402/evm/upto/client': false,
            '@x402/svm/exact/client': false,
            '@x402/evm': false,
            ...(wcEthProvider ? { '@walletconnect/ethereum-provider': wcEthProvider } : {}),
            // [PRISMA GUARD] Prevent @prisma/client from leaking into client bundles.
            // serverExternalPackages handles this for Server Components, but this alias
            // provides defense-in-depth for any edge cases where the bundler tries to
            // include prisma in client-side JS (causes PrismaClient browser error).
            ...(!isServer ? {
                '@prisma/client': path.resolve(__dirname, './lib/prisma-browser-stub.js'),
                'server-only': false,
            } : {}),
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

        // [AZTEC BUILD FIX] The Aztec SDK is pure ESM and only ever runs in the
        // browser (lib/aztec/wallet/client.ts loads it with dynamic imports).
        // On the server we alias every @aztec and @aztec-labs module to our universal
        // proxy stub (lib/aztec/aztec-stub.js) so SSR compilation never breaks.
        // On the client we point each subpath directly to its pre-built JS file,
        // bypassing the string-only ESM exports field that webpack cannot resolve
        // in a CJS Next.js build context.
        const aztecStub = path.resolve(__dirname, './lib/aztec/aztec-stub.js');
        // Both scopes resolve to the 6.0.0 release (@aztec-labs/*), the version
        // the networks run. The @aztec/* nightly packages are no longer installed
        // (only @aztec/bb.js remains), so a specifier missing from this list fails
        // the build; scripts/aztec/check-sdk-single-version.mjs checks it in CI.
        const aztecJsRoot = path.resolve(__dirname, 'node_modules/@aztec-labs/aztec.js/dest/api');
        const noirRoot   = path.resolve(__dirname, 'node_modules/@aztec-labs/noir-contracts.js/dest');
        const walletsRoot = path.resolve(__dirname, 'node_modules/@aztec-labs/wallets/dest/embedded/entrypoints');
        const aztecSubpaths = {
            // aztec.js subpaths
            '@aztec/aztec.js/fields':    path.join(aztecJsRoot, 'fields.js'),
            '@aztec/aztec.js/addresses': path.join(aztecJsRoot, 'addresses.js'),
            '@aztec/aztec.js/node':      path.join(aztecJsRoot, 'node.js'),
            '@aztec/aztec.js/contracts': path.join(aztecJsRoot, 'contract.js'),
            '@aztec/aztec.js/fee':       path.join(aztecJsRoot, 'fee.js'),
            '@aztec/aztec.js/account':   path.join(aztecJsRoot, 'account.js'),
            '@aztec/aztec.js/crypto':    path.join(aztecJsRoot, 'crypto.js'),
            '@aztec/aztec.js/tx':        path.join(aztecJsRoot, 'tx.js'),
            '@aztec/aztec.js/wallet':    path.join(aztecJsRoot, 'wallet.js'),
            '@aztec/aztec.js/abi':       path.join(aztecJsRoot, 'abi.js'),
            '@aztec/aztec.js/keys':      path.join(aztecJsRoot, 'keys.js'),
            // Fee Juice balance and L1->L2 message readiness (lib/aztec/wallet/client.ts). Without these two
            // entries the browser took them from the @aztec/* nightly while everything else was 6.0.0.
            '@aztec/aztec.js/utils':     path.join(aztecJsRoot, 'utils.js'),
            '@aztec/aztec.js/messaging': path.join(aztecJsRoot, 'messaging.js'),
            // noir-contracts.js subpaths
            '@aztec/noir-contracts.js/SponsoredFPC': path.join(noirRoot, 'SponsoredFPC.js'),
            '@aztec/noir-contracts.js/Token':        path.join(noirRoot, 'Token.js'),
            // wallets/embedded
            '@aztec/wallets/embedded': path.join(walletsRoot, 'browser.js'),
            // (The kv-store/deprecated/indexeddb alias pointed at a file 6.0.0 does not ship and nothing in the
            // app imports it; the wallet uses @aztec-labs/kv-store/sqlite-opfs through lib/aztec/wallet/store.ts.)
        };
        // Mirror aliases for @aztec-labs/ scope
        const aztecLabsSubpaths = Object.fromEntries(
            Object.entries(aztecSubpaths).map(([k, v]) => [k.replace('@aztec/', '@aztec-labs/'), v])
        );

        if (isServer) {
            // Server: stub every Aztec import to the universal SSR-safe proxy stub
            const serverSubpaths = Object.fromEntries(
                [...Object.keys(aztecSubpaths), ...Object.keys(aztecLabsSubpaths)].map(k => [k, aztecStub])
            );
            config.resolve.alias = {
                ...config.resolve.alias,
                ...serverSubpaths,
                '@aztec/aztec.js$': aztecStub,
                '@aztec/aztec.js': aztecStub,
                '@aztec-labs/aztec.js$': aztecStub,
                '@aztec-labs/aztec.js': aztecStub,
                '@aztec/wallets$': aztecStub,
                '@aztec/wallets': aztecStub,
                '@aztec-labs/wallets$': aztecStub,
                '@aztec-labs/wallets': aztecStub,
                '@aztec/noir-contracts.js$': aztecStub,
                '@aztec/noir-contracts.js': aztecStub,
                '@aztec-labs/noir-contracts.js$': aztecStub,
                '@aztec-labs/noir-contracts.js': aztecStub,
                // lib/aztec/poseidon.ts (agreements); browser-only like the rest.
                '@aztec-labs/foundation/crypto/poseidon': aztecStub,
            };
        } else {
            // Client: resolve subpaths directly to their built JS files
            config.resolve.alias = {
                ...config.resolve.alias,
                ...aztecSubpaths,
                ...aztecLabsSubpaths,
                '@aztec/aztec.js$': aztecStub,
                '@aztec-labs/aztec.js$': aztecStub,
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
                // Windows protected user folders. Only the legacy junctions
                // inside Documents are ignored, never Documents itself: this
                // repository usually lives under Documents/GitHub, and
                // ignoring the whole folder silently switched off hot reload,
                // so edits did not appear until the dev server was restarted.
                'C:/Users/*/Documents/My Music/**',
                'C:/Users/*/Documents/My Pictures/**',
                'C:/Users/*/Documents/My Videos/**',
                'C:/Users/*/Documents/Mi música/**',
                'C:/Users/*/Documents/Mis imágenes/**',
                'C:/Users/*/Documents/Mis vídeos/**',
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
                '@react-three/postprocessing', 'postprocessing',
                'pino-pretty', 'lokijs', 'encoding'
            ];
        }

        config.resolve.fallback = {
            ...config.resolve.fallback,
            encoding: false,
            'web-push': false,
        };

        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                readline: false,
                os: false,
                path: false,
                crypto: require.resolve('crypto-browserify'),
                stream: require.resolve('stream-browserify'),
                // [METAMASK SDK FIX] @wagmi/connectors embeds @metamask/sdk which tries to
                // load the 'encoding' node built-in. Stub it out for browser bundles.
                encoding: false,
                'web-push': false,
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
        // Scope hoisting is disabled to break the circular-dependency TDZ
        // mechanism. Minification stays off as well (it was switched off while
        // diagnosing the crash), so no minimizer is configured: the previous
        // TerserPlugin entry was never used and made `npm run build` require a
        // devDependency, which fails under NODE_ENV=production installs.
        if (!dev) {
            config.optimization.concatenateModules = false;
            config.optimization.minimize = false;
        }


        // ─────────────────────────────────────────────────────────────────────

        // [AZTEC V6 WALLET] The browser build of @aztec-labs/* loads WebAssembly
        // (Barretenberg, ACVM, SQLite) and uses top-level await in its workers.
        if (!isServer) {
            config.experiments = {
                ...config.experiments,
                asyncWebAssembly: true,
                topLevelAwait: true,
            };
        }

        return config;
    },
    // Metadata (title, description, Open Graph) is a static object in
    // app/layout.tsx. Next 15 streams it into <body> for user agents that are
    // not on its bot list, so Lighthouse and many link-preview crawlers saw a
    // page with no meta description. Rendering it in <head> for every client
    // costs nothing here because nothing in it is fetched.
    htmlLimitedBots: /.*/,
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
    // [AZTEC & REOWN SERVER GUARD] ESM-only and native packages must never be
    // bundled by Webpack on the server. serverExternalPackages tells Next.js to load
    // them via native Node.js require() at runtime, bypassing the Webpack bundler entirely.
    // This prevents vendor-chunk missing errors (e.g. ./vendor-chunks/@reown.js).
    serverExternalPackages: [
        '@prisma/client',
        'prisma',
        'ioredis',
        'neo4j-driver',
        'snarkjs',
        'pino',
        'pino-pretty',
        'lokijs',
        'encoding',
        '@reown',
        '@reown/appkit',
        '@reown/appkit-adapter-wagmi',
        '@reown/appkit-siwe',
        '@walletconnect',
        '@walletconnect/ethereum-provider',
        '@walletconnect/universal-provider',
        '@walletconnect/sign-client',
        '@walletconnect/utils',
        '@walletconnect/core',
        '@walletconnect/web3wallet',
        '@aztec/aztec.js',
        '@aztec/foundation',
        '@aztec/stdlib',
        '@aztec/accounts',
        '@aztec/pxe',
        '@aztec/wallets',
        '@aztec/noir-contracts.js',
        '@aztec/bb.js',
        // Aztec v6 SDK (the private payments wallet). It only ever runs in the
        // browser (lib/aztec/wallet/client.ts loads it with dynamic imports);
        // the server must never bundle or execute it.
        '@aztec-labs/aztec.js',
        '@aztec-labs/wallets',
        '@aztec-labs/accounts',
        '@aztec-labs/pxe',
        '@aztec-labs/stdlib',
        '@aztec-labs/foundation',
        '@aztec-labs/noir-contracts.js',
        '@aztec-labs/kv-store',
        '@aztec-labs/bb-prover',
        '@aztec-labs/simulator',
        '@aztec-labs/native',
    ],

    experimental: {
        cpus: 1,
        // The JS/WASM served to the browser is part of the trusted computing base (it builds proofs and
        // holds keys). Subresource Integrity pins every script chunk to its build-time sha256 hash, so a
        // chunk altered on its way (CDN, proxy, cache) is refused by the browser instead of executed.
        sri: { algorithm: 'sha256' },
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

    // External packages are defined above in experimental.serverComponentsExternalPackages

    env: {
        // NEXT_PUBLIC_APP_URL: canonical production URL  MUST match WalletConnect Cloud registration.
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://ledgerchat.org',
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
    //
    // SECURITY: Content-Security-Policy-Report-Only is added here (not in middleware)
    // so it does not interfere with the enforced CSP from middleware.ts.
    // Report-only violations are collected at /api/security/csp-report.
    // Reference: docs/OBSERVABILITY.md — hl_csp_violations_total
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Content-Type-Options',              value: 'nosniff' },
                    { key: 'X-Frame-Options',                     value: 'DENY' },
                    { key: 'X-XSS-Protection',                   value: '1; mode=block' },
                    { key: 'Strict-Transport-Security',           value: 'max-age=63072000; includeSubDomains; preload' },
                    { key: 'X-Permitted-Cross-Domain-Policies',   value: 'none' },
                    { key: 'Referrer-Policy',                     value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy',                  value: 'camera=(self), microphone=(self), geolocation=(), interest-cohort=()' },
                    { key: 'X-DNS-Prefetch-Control',              value: 'off' },
                    // [SECURITY] CSP Report-Only: collects violation reports without blocking.
                    // Enforced CSP is set per-request by middleware.ts (nonce-based).
                    // Reports are collected at /api/security/csp-report.
                    { key: 'Content-Security-Policy-Report-Only', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https: wss: blob: data:; frame-src 'self' https:; object-src 'none'; base-uri 'self'; report-uri /api/security/csp-report" },
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
            // Binary releases (.exe, installers) - explicit attachment and nosniff to prevent browser download false-positives
            {
                source: '/releases/(.*)',
                headers: [
                    { key: 'Content-Type', value: 'application/octet-stream' },
                    { key: 'Content-Disposition', value: 'attachment' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Cache-Control', value: 'public, max-age=604800, immutable' },
                ],
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
