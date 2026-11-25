# Quick start

Two ways in. Each fits on one screen.

## Use Ledger Chat

1. Open **[ledgerchat.org/beta](https://ledgerchat.org/beta)** and request an invitation, or enter the single-use code you were given.
2. Connect an Ethereum wallet and sign in with one signature (SIWE). No phone number, email or password.
3. Read the beta notice and unlock. Messages work at once; private payments need cUSDC (bridged with human.tech's Shield) and Fee Juice on your Aztec account ([`beta/TESTER_GUIDE.md`](beta/TESTER_GUIDE.md)).

The beta is closed (at most 100 members, until 23 Feb 2027), capped per payment and not externally audited yet: [`TRUST.md`](TRUST.md).

## Run it locally

Requirements: **Node 22 or newer** (enforced by `engines` and `engine-strict`), npm 10, Docker.

```bash
git clone https://github.com/humanityledger/humanity-ledger.git && cd humanity-ledger
npm ci
POSTGRES_PASSWORD=postgres docker compose up -d postgres redis   # compose requires POSTGRES_PASSWORD
cat > .env.local <<EOF
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/humanity_ledger"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
EOF
npx prisma generate && npx prisma db push
npm run dev
```

Open http://localhost:3000/chat. `JWT_SECRET` is the only variable `middleware.ts` refuses to start without; third-party keys (WalletConnect, Moralis, Stripe) are optional and only the screens that use them fail without them. On a port other than 3000, add `APP_ALLOWED_ORIGINS="http://localhost:PORT"` or mutations answer 403 (CSRF fails closed). Details and pitfalls: [`RUN-LOCAL.md`](RUN-LOCAL.md) (Spanish).

## Verify

```bash
npm run test:run                        # unit and integration tests (Vitest)
npm run test:contracts                  # Solidity, including the portal (Hardhat)
node scripts/check-forbidden-copy.mjs   # docs and UI make no claim the code does not support
node scripts/forbidden-patterns.mjs     # security patterns
```

The aztec-nr contracts compile and run their TXE tests in CI with the Aztec 6.0.0 toolchain. To run them yourself, install that toolchain (`VERSION=6.0.0` with the official installer) and follow [`.github/workflows/aztec-contracts.yml`](../.github/workflows/aztec-contracts.yml).

## Next

[`AZTEC.md`](AZTEC.md) for the Aztec integration · [`audit/START_HERE.md`](audit/START_HERE.md) for reviewers · [`../CONTRIBUTING.md`](../CONTRIBUTING.md) to contribute.
