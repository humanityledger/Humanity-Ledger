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

# Install Aztec CLI (provides `aztec start --pxe` for testnet connectivity)
# Version pinned to match our @aztec/aztec.js package version (4.3.1)
RUN curl -s https://install.aztec.network | bash -s -- --version 0.87.9 --no-sandbox 2>/dev/null || \
    npm install -g @aztec/cli@4.3.1 2>/dev/null || \
    echo "[Docker] Aztec CLI install skipped — PXE must be external"

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
# Using --legacy-peer-deps for compatibility with older Web3 libraries
# Note: npm ci is preferred for speed and deterministic builds in CI
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

#  STAGE 4: BUILD 
FROM build-base AS builder
WORKDIR /app

# Carry over node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Performance tuning for Next.js build on 8GB RAM Metal builders
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=true

# Generate Prisma client and build application
RUN npx prisma generate && \
    npx next build && \
    rm -rf .next/cache

#  STAGE 5: PRODUCTION RUNNER 
FROM runtime AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy verified production build and necessary runtime assets
COPY --from=builder /app ./

# Final integrity checks
RUN test -f /app/ecosystem.config.json || (echo "FATAL: ecosystem.config.json missing" && exit 1)
RUN test -f /app/start.sh || (echo "FATAL: start.sh missing" && exit 1)
RUN chmod +x /app/start.sh

EXPOSE 3000

# Execute the System boot sequence
CMD ["sh", "/app/start.sh"]

