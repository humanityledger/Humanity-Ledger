# Humanity Ledger — Local Development & Quickstart Guide

**Document Reference:** HL-DEV-QUICKSTART-2026.1  
**Target Environment:** Local Node.js Development Environment  
**Version:** 1.1  
**Date:** 2 November 2026

---

## 1. System Requirements

- **Operating System:** Linux, macOS, or Windows (WSL2 or PowerShell)
- **Node.js:** v20.x or higher LTS
- **Package Manager:** npm v10.x+
- **Database:** PostgreSQL v15+ (local or containerized)
- **Cache:** Redis v7+ (local or containerized)
- **Hardware Minimum:** 8 GB RAM, 4 CPU cores (required for local WebAssembly proof synthesis and Hardhat EVM Cancun test execution)

---

## 2. Installation & Setup

### Step 1: Clone the Repository
```bash
git clone https://github.com/humanityledger/Humanity-Ledger.git
cd Humanity-Ledger
```

### Step 2: Install Pinned Dependencies
```bash
npm ci
```

### Step 3: Configure Environment Variables
Copy the development environment template:
```bash
cp .env.example .env.local
```

Ensure cryptographic secrets meet the 16-character minimum to prevent fail-closed startup aborts:
```bash
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCLAVE_PIN_PEPPER=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
CRON_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
INTERNAL_INGEST_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

### Step 4: Database Schema Initialization
Generate the Prisma client and synchronize the local schema:
```bash
npx prisma generate
npx prisma db push
```

### Step 5: Start Local Development Server
```bash
npm run dev
```

The application interface is accessible at:
```
http://localhost:3000
```

---

## 3. Verification Suite Execution

Before making any code modifications, verify that the local environment reproduces the baseline test passes:

```bash
# Execute unit and integration test suite (1,076 tests)
npm run test:run

# Execute L1 smart contract invariant suite (43 Hardhat tests)
npm run test:contracts

# Execute traceability and security pattern scans
npm run check:traceability
node scripts/forbidden-patterns.mjs
```

---

## 4. Documentation References

- Protocol Invariants & Normative Specification: [`docs/PROTOCOL_SPEC.md`](PROTOCOL_SPEC.md)
- Testing Architecture & Verification Battery: [`docs/TESTING.md`](TESTING.md)
- Aztec Foundation Review Dossier: [`docs/AZTEC_FOUNDATION_DOSSIER.md`](AZTEC_FOUNDATION_DOSSIER.md)
- Coordinated Vulnerability Disclosure Policy: [`docs/BUG_BOUNTY.md`](BUG_BOUNTY.md)
