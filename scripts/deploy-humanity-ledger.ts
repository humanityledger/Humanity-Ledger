#!/usr/bin/env ts-node
/**
 * scripts/deploy-humanity-ledger.ts
 *
 * Deploys the HumanityLedger (QDs Token) contract to Aztec Mainnet.
 * Compatible with @aztec/aztec.js v5 SDK (using @aztec/wallets).
 */

require('dotenv').config();

const AZTEC_PXE_URL = process.env.AZTEC_PXE_URL || 'https://node.aztec.network';
const RELAYER_KEY_HEX = process.env.AZTEC_RELAYER_PRIVATE_KEY || process.env.AZTEC_RELAYER_SECRET_KEY;

async function main() {
  console.log('\n🐋 ================================================');
  console.log('   Humanity Ledger (QDs) → Aztec Mainnet (v5)');
  console.log('   ================================================\n');

  if (!RELAYER_KEY_HEX) {
    console.error('❌ AZTEC_RELAYER_PRIVATE_KEY is not set in .env');
    process.exit(1);
  }

  // ── Dynamic imports: v5 SDK ──────────────────────────────────────────────
  const { Fr }            = await import('@aztec/foundation/curves/bn254');
  const { Contract }      = await import('@aztec/aztec.js/contracts');
  const { EmbeddedWallet } = await import('@aztec/wallets/embedded');
  const fs   = await import('fs');
  const path = await import('path');

  console.log(`🔌 Connecting to Aztec node: ${AZTEC_PXE_URL}`);
  
  // Initialize Embedded Wallet connected to PXE node
  const wallet = await EmbeddedWallet.create(AZTEC_PXE_URL, { ephemeral: true });
  
  // ── Load relayer key ─────────────────────────────────────────────────────
  console.log('🔐 Loading relayer account from key...');
  const cleanHex = RELAYER_KEY_HEX.replace(/^0x/i, '');
  const secretKey    = Fr.fromHexString(cleanHex);
  const salt         = new Fr(0n);
  
  // Register the Schnorr account within the embedded wallet
  const accountManager = await wallet.createSchnorrAccount(secretKey, salt);
  const relayerAddress = accountManager.address;
  
  // Wait for the account to be fully registered/deployed
  // (In v5 testnet, funding/registering usually happens via faucet, or is implicitly handled if funded)
  /*
  try {
    const deployMethod = await accountManager.getDeployMethod();
    await deployMethod.send({ from: relayerAddress });
  } catch (e: any) {
    if (!e.message?.includes('already')) {
      console.warn('⚠️ Account deploy warning (might be already deployed):', e.message);
    }
  }
  */

  console.log(`📬 Relayer address: ${relayerAddress.toString()}\n`);

  // ── Load contract artifact ───────────────────────────────────────────────
  const artifactPath = path.resolve(process.cwd(), 'lib/aztec/artifacts/humanity_ledger-HumanityLedger.json');
  if (!fs.existsSync(artifactPath)) {
    console.error(`❌ Artifact not found at: ${artifactPath}`);
    process.exit(1);
  }

  console.log('📦 Loading HumanityLedger artifact...');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
  console.log(`✅ Artifact loaded: ${artifact.name} (${artifact.functions?.length ?? '?'} functions)\n`);

  // ── Deploy contract ──────────────────────────────────────────────────────
  console.log('🚀 Deploying HumanityLedger contract to Aztec Mainnet...');
  console.log('   (This may take 30–120 seconds — ZK proof generation in progress)\n');

  try {
    const deployMethod = Contract.deploy(wallet, artifact, []);
    const result = await deployMethod.send({ from: relayerAddress });
    
    const contractAddress = result.contract.address.toString();
    const txHash = 'n/a'; // receipt tx hash not easily extractable from result object in this TS context


    console.log('\n✅ ================================================');
    console.log('   DEPLOYMENT SUCCESSFUL!');
    console.log('   ================================================');
    console.log(`\n📍 Contract Address : ${contractAddress}`);
    console.log(`🔗 Tx Hash          : ${txHash}`);
    console.log(`🔍 Explorer         : https://aztecscan.xyz/tx/${txHash}\n`);

    console.log('📋 ADD THESE TO YOUR .env AND Railway dashboard:\n');
    console.log(`AZTEC_TOKEN_CONTRACT_ADDRESS=${contractAddress}`);
    console.log(`AZTEC_QDS_CONTRACT_ADDRESS=${contractAddress}`);
    console.log(`NEXT_PUBLIC_AZTEC_QDS_ADDRESS=${contractAddress}`);
    console.log(`AZTEC_PXE_URL=${AZTEC_PXE_URL}`);
    console.log(`AZTEC_NETWORK=alpha-testnet\n`);

    // ── Write to .env.aztec ──────────────────────────────────────────────────
    const envContent = [
      `# Aztec Mainnet — QDs Contract (auto-generated ${new Date().toISOString()})`,
      `AZTEC_TOKEN_CONTRACT_ADDRESS=${contractAddress}`,
      `AZTEC_QDS_CONTRACT_ADDRESS=${contractAddress}`,
      `NEXT_PUBLIC_AZTEC_QDS_ADDRESS=${contractAddress}`,
      `AZTEC_PXE_URL=${AZTEC_PXE_URL}`,
      `AZTEC_NETWORK=alpha-testnet`,
      '',
    ].join('\n');

    fs.writeFileSync('.env.aztec', envContent);
    console.log('💾 Written to .env.aztec — copy these values to Railway env vars\n');
  } finally {
    await wallet.stop();
  }
}

main().catch(err => {
  console.error('\n❌ Deployment failed:', err?.message || err);
  process.exit(1);
});
