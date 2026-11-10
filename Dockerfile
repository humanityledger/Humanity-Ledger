# 
# SOVEREIGN TERMINAL  INSTITUTIONAL MULTI-STAGE DOCKER PIPELINE
# Railway Hobby Plan: 8 vCPU / 8 GB RAM
# Architecture: 5-stage build  minimal production runner
# 

#  STAGE 1: RUNTIME BASE 
# Updated to ubuntu:24.04 to satisfy @aztec/bb.js requirements (GLIBCXX_3.4.32 / GCC 13).
FROM ubuntu:24.04 AS runtime
WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive

# Install runtime libraries + tools needed for Aztec PXE, and Node 22
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    libstdc++6 \
    procps \
    curl \
    bash \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Aztec Network Node & Sequencer Configuration (October 2026 Upgrade Suite)
# Testnet node moves to v6.0.0-rc.3 (azteclabs/aztec:6.0.0-rc.3)
# Mainnet sequencer on v5.2.0 (Rollup deploy block: 25428902 with Nethermind 2.0.0)
# V6 Governance Signalling proposer payload: 0x68396cde7891ADCC65F11e8A5Cec1898AF6AD970
ENV AZTEC_TESTNET_IMAGE="azteclabs/aztec:6.0.0-rc.3" \
    AZTEC_TESTNET_VERSION="v6.0.0-rc.3" \
    AZTEC_MAINNET_VERSION="v5.2.0" \
    GOVERNANCE_PROPOSER_PAYLOAD_ADDRESS="0x68396cde7891ADCC65F11e8A5Cec1898AF6AD970" \
    AZTEC_ROLLUP_DEPLOY_BLOCK="25428902" \
    AZTEC_NETHERMIND_VERSION="2.0.0"

#  STAGE 2: BUILD DEPENDENCIES 
FROM runtime AS build-base

# Consolidate all build-time tools into one layer.
# Retry loop: if the mirror has a transient 404 (e.g. linux-libc-dev removed mid-roll),
# re-run apt-get update to pick up the refreshed index and retry the install.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libc6-dev \
    python3 \
    make \
    g++ \
    gcc \
    cmake \
    git \
    build-essential \
    wget \
    pkg-config \
    libssl-dev \
    || (echo "[build-base] apt-get install failed  refreshing package index and retrying..." \
        && sleep 15 \
        && apt-get update \
        && apt-get install -y --no-install-recommends \
            libc6-dev \
            python3 \
            make \
            g++ \
            gcc \
            cmake \
            git \
            build-essential \
            wget \
            pkg-config \
            libssl-dev) \
    && rm -rf /var/lib/apt/lists/*

#  STAGE 3: INSTALL DEPENDENCIES 
FROM build-base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
# Copy scripts/ before npm ci — required because the postinstall hook runs
# `node scripts/cross-fetch-patch.js` and needs the file to be present.
COPY scripts/ ./scripts/
# Using --legacy-peer-deps for compatibility with older Web3 libraries
# Note: npm ci is preferred for speed and deterministic builds in CI
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

#  STAGE 4: BUILD 
FROM build-base AS builder
WORKDIR /app

# Carry over node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Memory safety and worker controls for Next.js build:
# Restrict workers to 1 so memory is never duplicated across multiple builder cores.
# Set max-old-space-size to 6144MB to comfortably accommodate Next.js + Aztec + Webpack compilation without V8 heap exhaustion.
ENV NEXT_BUILD_WORKERS=1
ENV NODE_OPTIONS="--max-old-space-size=6144"
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=true
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dummy"
ENV DATABASE_URL_UNPOOLED="postgresql://postgres:postgres@localhost:5432/dummy"
ENV NEXTAUTH_SECRET="build_time_dummy_secret_ledgerchat_org_0123456789"
ENV NEXTAUTH_URL="https://ledgerchat.org"
ENV NEXT_PUBLIC_APP_URL="https://ledgerchat.org"

# Step 1: Generate Prisma client
RUN npx prisma generate

# Step 2: Build Next.js application
RUN npx next build

# Step 3: Remove build cache to keep final image compact
RUN rm -rf .next/cache

# STAGE 5: PRODUCTION RUNNER 
FROM runtime AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# Create nextjs system user/group first
RUN id -u nextjs >/dev/null 2>&1 || (groupadd --system --gid 1001 nodejs 2>/dev/null || true; useradd --system --uid 1001 -g nodejs nextjs 2>/dev/null || useradd --system --uid 1001 nextjs 2>/dev/null || true)

# Copy verified production build and necessary runtime assets
COPY --from=builder /app ./

# Fast permission setup: only .next cache needs write access at runtime, NEVER chown 200,000+ files in node_modules
RUN mkdir -p /app/.next/cache && chown -R nextjs:nodejs /app/.next/cache 2>/dev/null || true

# Final integrity checks
RUN test -f /app/ecosystem.config.json || (echo "FATAL: ecosystem.config.json missing" && exit 1)
RUN test -f /app/start.sh || (echo "FATAL: start.sh missing" && exit 1)
RUN chmod +x /app/start.sh

USER nextjs

EXPOSE 3000 8080

# Execute the System boot sequence
CMD ["sh", "/app/start.sh"]

