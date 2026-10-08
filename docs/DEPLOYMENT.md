# Deployment Guide: Gasless System

## Quick Start (30 minutes to production)

### Step 1: WalletConnect Setup (5 min)

1. Go to https://cloud.walletconnect.com
2. Sign up / Log in
3. Click "Create Project"
4. Name: "Polymarket Wallet"
5. Copy **Project ID**
6. Save as `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

---

### Step 2: Generate Relayer Wallet (2 min)

```bash
# Generate private key
node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"

# Output example: 0xabcd1234...
# Save this as RELAYER_PRIVATE_KEY
```

**Derive Public Address:**
```bash
# Using ethers.js
node -e "const ethers = require('ethers'); const wallet = new ethers.Wallet('YOUR_PRIVATE_KEY'); console.log(wallet.address);"

# Save as RELAYER_ADDRESS
```

---

### Step 3: Fund Relayer (5 min)

1. Go to https://www.alchemy.com/faucets/base-sepolia
2. Enter your `RELAYER_ADDRESS`
3. Request 0.1 ETH
4. Verify on https://sepolia.basescan.org/address/YOUR_ADDRESS

---

### Step 4: Deploy Contracts (10 min)

```bash
# 1. Deploy Governance Contract
npx hardhat run scripts/deploy-base.ts --network baseSepolia

# Output: Contract deployed to: 0x123...
# Save as NEXT_PUBLIC_GOVERNANCE_CONTRACT_ADDRESS

# 2. Deploy Zap Contract
npx hardhat run scripts/deploy-zap-gasless.ts --network baseSepolia

# Output: Contract deployed to: 0x456...
# Save as NEXT_PUBLIC_ZAP_GASLESS_CONTRACT_ADDRESS
```

---

### Step 5: Configure Railway (Step-by-Step Tutorial)

1. **Prepare your Repository**: Ensure your GitHub repository contains the `railway.json` and `Dockerfile` (or `docker-compose.yml` if using full stack).
2. **Login to Railway**: Go to the Railway Dashboard (https://railway.app/).
3. **Create New Project**: Click on `New Project` -> `Deploy from GitHub repo`.
4. **Select Repository**: Search for `humanityledger/humanityledger` and select it.
5. **Add Environment Variables**: Go to the `Variables` tab of your new service and paste all variables from your local `.env`. Ensure to use production RPCs and keys.
6. **Set Continuous Deployment**: Ensure "Automatic Deployments" is on so that pushing to `main` updates the app automatically.
7. **Generate Domain**: Go to `Settings` -> `Networking` and click `Generate Domain` to get your public URL.
8. **Check Prisma (If using PostgreSQL)**: If you are not using MongoDB/Supabase, make sure to add a Database Service in Railway, and link its `DATABASE_URL` to your app service.

**Required Variables for System Terminal:**
```bash
NEXT_PUBLIC_SITE_URL="https://your-domain.up.railway.app"
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="your_wallet_connect_id"
DATABASE_URL="postgresql://..." 
MONGODB_URI="mongodb+srv://..."
JWT_SECRET="your_jwt_secret_here"
PRISMA_GENERATE_DATAPROXY="true"
```

---

### Step 6: Verify Deployment (3 min)

1. Visit your Railway URL
2. Open Network Tab (F12) to ensure WebSockets connect without 502 errors.
3. Connect your wallet using the System QR Handshake.
4. Verify market telemetry is streaming in.

---

## Troubleshooting (Common Issues)

### 1. Issue: "Unknown Network"
**Symptoms:** The terminal connects but cannot fetch blockchain data or complains about unsupported chain.
**Solution:** Ensure `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set and you are connected to a supported network (Ethereum Mainnet or Base).

### 2. Issue: "Relayer out of funds"
**Symptoms:** Unable to broadcast internal transactions for execution/minting.
**Solution:** Fund relayer wallet with more ETH on the respective chain.

### 3. Issue: "Contract not found" / "Invalid parameters"
**Symptoms:** Deploying or interacting throws RPC parameter errors (e.g., passing a float instead of a string to `ethers`).
**Solution:** Verify contract addresses and ensure you are passing stringified integers to EVM methods.

### 4. Issue: "Signature verification failed"
**Symptoms:** WalletConnect signs but the backend rejects the transaction.
**Solution:** Check `chainId` matches exactly. Restart the Railway app to flush the Next.js cache.

### 5. Issue: "WebSocket 502 Bad Gateway"
**Symptoms:** Active alerts do not appear. Terminal shows "Reconnecting...".
**Solution:** Railway might be routing to the wrong internal port. Ensure your worker exposes the correct WebSocket port and the Railway firewall allows it.

---

## Monitoring

### Check Relayer Balance
```bash
curl "https://sepolia.base.org" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["YOUR_RELAYER_ADDRESS","latest"],"id":1}'
```

### Check Transaction Status
```bash
# Visit
https://sepolia.basescan.org/address/YOUR_RELAYER_ADDRESS
```

---

## Maintenance

### Weekly Tasks
- [ ] Check relayer balance
- [ ] Review error logs
- [ ] Monitor gas prices

### Monthly Tasks
- [ ] Rotate JWT_SECRET
- [ ] Review security
- [ ] Update dependencies

---

**Need Help?** Check `TESTING.md` for detailed test cases.
