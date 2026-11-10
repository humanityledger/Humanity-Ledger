/**
 * lib/aztec/wallet/client.ts
 *
 * The private payments wallet, running entirely in the browser:
 *
 *   - an Aztec PXE (Private eXecution Environment) with its own storage in the
 *     browser, created by @aztec-labs/wallets;
 *   - a Schnorr account whose keys are derived from a signature by the user's
 *     Ethereum wallet (see keys.ts);
 *   - the tokens configured for the network.
 *
 * Fees, per network (lib/aztec/fees.ts, lib/aztec/fee-juice.ts):
 *   - test network: the canonical Sponsored FPC pays, as before;
 *   - Aztec Alpha (only when enabled in config.ts): Fee Juice. A new account
 *     waits in phase 'needs-fee-juice' until the user bridges AZTEC from L1
 *     (bridgeFeeJuice), then deploys itself by claiming that deposit in the
 *     same transaction. Afterwards it pays from its Fee Juice balance, and any
 *     further ready deposit is claimed by the next transaction.
 *
 * Every balance shown comes from the token contracts through the PXE. Every
 * action is a real transaction, proven on the device and sent to the Aztec
 * test network. Nothing is simulated, and the server is never involved.
 *
 * The Aztec SDK is loaded with dynamic imports so it never reaches the server
 * bundle or the first page load.
 */

import { AZTEC_WALLET_CONFIG, FAUCET_AMOUNT, assertNetworkAllowed, isWalletConfigured, networkLabel, tokenConfig, walletTypedData, type TokenKey } from './config';
import { deriveAccountKeys, deriveFeeJuiceClaimSecrets, type WalletTypedData } from './keys';
import { isValidAztecAddress } from '../grumpkin';
import { parseUnits } from './amounts';
import { loadLocalActivity, mergeActivity, upsertActivity, type Activity, type ActivityKind } from './history';
import { assertFeeChoice, identifyNode } from '../fees';
import { valueActionsRunning } from '../single-flight';
import { BINDING_SCHEME, bindingStatement, sdkBindingCrypto, verifyAddressProof, type AddressProof } from '../peer-binding';
import {
  assertNodeFeeJuiceMatchesPins,
  assertNodeForValue,
  agreementFeeCheck,
  bridgeFeeJuice as bridgeOnL1,
  feePlan,
  loadClaims,
  mergeClaims,
  nextSecretIndex,
  recoverClaims,
  saveClaims,
  type BridgeStep,
  type FeeJuiceClaim,
  type FeePlan,
  type L1Clients,
} from '../fee-juice';

/** How many claim secrets are derived (and scanned when recovering deposits). */
const CLAIM_SECRETS = 16;


export type WalletPhase = 'idle' | 'signing' | 'starting' | 'needs-fee-juice' | 'deploying' | 'ready' | 'error';

/** Fee Juice state on Aztec Alpha (absent on the test network). */
export interface FeeJuiceState {
  /** Base units (18 decimals) held by the account. */
  balance: bigint;
  /** Deposits made on L1 and not yet claimed, with whether each can be claimed now. */
  claims: { claim: FeeJuiceClaim; ready: boolean }[];
  /** How the next transaction will pay. */
  plan: FeePlan['kind'];
}

export interface TokenBalance {
  key: TokenKey;
  symbol: string;
  decimals: number;
  /** Base units held in private notes. */
  privateUnits: bigint;
  /** Base units held in the public balance (needs shielding before it is private). */
  publicUnits: bigint;
}

export interface WalletSnapshot {
  phase: WalletPhase;
  /** What the wallet is doing right now, in plain words, for the interface. */
  step?: string;
  error?: string;
  aztecAddress?: string;
  balances: TokenBalance[];
  activity: Activity[];
  busy: boolean;
  /** Aztec Alpha only. */
  feeJuice?: FeeJuiceState;
}

export type SignTypedData = (typedData: WalletTypedData) => Promise<string>;

type Listener = (s: WalletSnapshot) => void;

interface Sdk {
  Fr: any;
  Fq: any;
  AztecAddress: any;
  createAztecNodeClient: (url: string, opts?: any) => any;
  waitForTx: (node: any, txHash: any, opts?: any) => Promise<any>;
  getContractInstanceFromInstantiationParams: (artifact: any, opts: any) => Promise<any>;
  SponsoredFeePaymentMethod: any;
  FeeJuicePaymentMethodWithClaim: any;
  getFeeJuiceBalance: (owner: any, node: any) => Promise<bigint>;
  isL1ToL2MessageReady: (node: any, messageHash: any) => Promise<boolean>;
  computeSecretHash: (secret: any) => Promise<any>;
  NO_FROM: any;
  NO_WAIT: any;
  SponsoredFPCContract: any;
  TokenContract: any;
  EmbeddedWallet: any;
}

async function loadSdk(): Promise<Sdk> {
  const [fields, addresses, node, contracts, fee, account, fpc, token, wallets, utils, messaging, crypto] = await Promise.all([
    import('@aztec/aztec.js/fields'),
    import('@aztec/aztec.js/addresses'),
    import('@aztec/aztec.js/node'),
    import('@aztec/aztec.js/contracts'),
    import('@aztec/aztec.js/fee'),
    import('@aztec/aztec.js/account'),
    import('@aztec/noir-contracts.js/SponsoredFPC'),
    import('@aztec/noir-contracts.js/Token'),
    import('@aztec/wallets/embedded'),
    import('@aztec/aztec.js/utils'),
    import('@aztec/aztec.js/messaging'),
    import('@aztec/aztec.js/crypto'),
  ]);
  return {
    Fr: (fields as any).Fr,
    Fq: (fields as any).Fq,
    AztecAddress: (addresses as any).AztecAddress,
    createAztecNodeClient: (node as any).createAztecNodeClient,
    waitForTx: (node as any).waitForTx,
    getContractInstanceFromInstantiationParams: (contracts as any).getContractInstanceFromInstantiationParams,
    SponsoredFeePaymentMethod: (fee as any).SponsoredFeePaymentMethod,
    FeeJuicePaymentMethodWithClaim: (fee as any).FeeJuicePaymentMethodWithClaim,
    getFeeJuiceBalance: (utils as any).getFeeJuiceBalance,
    isL1ToL2MessageReady: (messaging as any).isL1ToL2MessageReady,
    computeSecretHash: (crypto as any).computeSecretHash,
    NO_FROM: (account as any).NO_FROM,
    NO_WAIT: (contracts as any).NO_WAIT,
    SponsoredFPCContract: (fpc as any).SponsoredFPCContract,
    TokenContract: (token as any).TokenContract,
    EmbeddedWallet: (wallets as any).EmbeddedWallet,
  };
}

const AZTEC_ADDRESS_RE = /^0x[0-9a-fA-F]{64}$/;

/** Public RPC endpoints (drpc free tier) refuse JSON-RPC batches larger than 3. */
const RPC_OPTIONS = { maxBatchSize: AZTEC_WALLET_CONFIG.rpcMaxBatch };

export function isAztecAddress(value: string): boolean {
  return AZTEC_ADDRESS_RE.test(value.trim());
}

/** Payment request encoded in the receive QR code. */
export function encodePaymentRequest(aztecAddress: string, token?: TokenKey, amount?: string): string {
  const params = new URLSearchParams();
  params.set('network', AZTEC_WALLET_CONFIG.network === 'mainnet' ? 'alpha' : 'testnet');
  if (token) params.set('token', token);
  if (amount) params.set('amount', amount);
  return `aztec:${aztecAddress}?${params.toString()}`;
}

/** Accepts a bare address or an `aztec:` payment request. */
export function decodePaymentRequest(raw: string): { address: string; token?: TokenKey; amount?: string } | null {
  const text = raw.trim();
  if (isAztecAddress(text)) return { address: text.toLowerCase() };
  const m = /^aztec:(0x[0-9a-fA-F]{64})(?:\?(.*))?$/.exec(text);
  if (!m) return null;
  const params = new URLSearchParams(m[2] ?? '');
  // A request made for the other network is refused: paying a test network
  // request with real funds (or the reverse) is never what the user meant.
  const reqNet = params.get('network');
  const ourNet = AZTEC_WALLET_CONFIG.network === 'mainnet' ? 'alpha' : 'testnet';
  if (reqNet && reqNet !== ourNet) return null;
  const token = params.get('token') as TokenKey | null;
  const amount = params.get('amount') ?? undefined;
  return {
    address: m[1].toLowerCase(),
    token: token && ['USDC', 'DAI', 'ETH'].includes(token) ? token : undefined,
    amount: amount && /^\d+(\.\d+)?$/.test(amount) ? amount : undefined,
  };
}

class PrivateWallet {
  private sdk: Sdk | null = null;
  private node: any = null;
  private wallet: any = null;
  private me: any = null;
  private fee: any = null;
  /** Sponsored fee options on the test network; null on Alpha. */
  private sponsoredFee: any = null;
  /** Fee Juice claim secrets (Alpha only), derived from the signature at connect. */
  private claimSecrets: bigint[] = [];
  private manager: any = null;
  /** Schnorr signing key (Fq) and salt (Fr), kept in memory for G7 address proofs only. */
  private signingKey: any = null;
  private salt: any = null;
  private claimPoll: ReturnType<typeof setInterval> | null = null;
  private tokens = new Map<TokenKey, any>();
  private faucetAddress: any = null;
  private evmAddress: string | null = null;
  private listeners = new Set<Listener>();
  private inflight = 0;
  private connecting: Promise<void> | null = null;

  private snapshot: WalletSnapshot = { phase: 'idle', balances: [], activity: [], busy: false };

  /* ------------------------------------------------------------------ state */

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.snapshot);
    return () => this.listeners.delete(fn);
  }

  get state(): WalletSnapshot {
    return this.snapshot;
  }

  private set(patch: Partial<WalletSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch, busy: this.inflight > 0 };
    for (const fn of this.listeners) fn(this.snapshot);
  }

  /* ---------------------------------------------------------------- connect */

  /**
   * Opens the wallet for an Ethereum account. Asks the user's wallet for one
   * signature, starts the in-browser PXE, and deploys the Aztec account the
   * first time. Calling it again for the same account is a no-op.
   */
  connect(evmAddress: string, signTypedData: SignTypedData): Promise<void> {
    const evm = evmAddress.toLowerCase();
    if (this.evmAddress === evm && this.snapshot.phase === 'ready') return Promise.resolve();
    if (this.connecting && this.evmAddress === evm) return this.connecting;
    this.evmAddress = evm;
    this.connecting = this.doConnect(evm, signTypedData).finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async doConnect(evm: string, signTypedData: SignTypedData) {
    try {
      if (!isWalletConfigured()) {
        throw new Error('The private wallet has not been set up on this server yet. The operator needs to run scripts/aztec/setup-testnet.mjs.');
      }

      this.set({ phase: 'signing', step: 'Waiting for your wallet signature', error: undefined });
      const signature = await signTypedData(walletTypedData());

      this.set({ phase: 'starting', step: 'Starting the private node in your browser' });
      const sdk = (this.sdk ??= await loadSdk());
      const { Fr, Fq, AztecAddress } = sdk;

      this.node = sdk.createAztecNodeClient(AZTEC_WALLET_CONFIG.nodeUrl, RPC_OPTIONS);
      const info = await this.node.getNodeInfo();
      assertNetworkAllowed(Number(info.l1ChainId));
      // A node on another rollup or release fails later in obscure ways
      // (unknown classes, rejected proofs); say so now, in words.
      // A different node release is reported; a different rollup or L1 is refused.
      const identity = identifyNode(info as any);
      const blocking = identity.drift.filter((d) => d.field !== 'nodeVersion');
      for (const d of identity.drift.filter((x) => x.field === 'nodeVersion')) {
        console.warn(`[wallet] Aztec node ${d.actual}, this build was made for ${d.expected}`);
      }
      if (blocking.length) {
        throw new Error(
          `The Aztec node does not match this build: ${blocking.map((d) => `${d.field} ${d.actual} (expected ${d.expected})`).join(', ')}.`,
        );
      }

      if (this.wallet) {
        await this.wallet.stop().catch(() => {});
        this.wallet = null;
      }

      this.set({ step: 'Initializing encrypted storage' });
      const { openEncryptedWalletStores } = await import('./store');
      const networkPrefix = AZTEC_WALLET_CONFIG.network === 'mainnet' ? 'alpha' : 'testnet';
      const stores = await openEncryptedWalletStores(signature, {
        pxeName: `pxe_${networkPrefix}`,
        walletName: `wallet_${networkPrefix}`,
      });

      this.wallet = await sdk.EmbeddedWallet.create(AZTEC_WALLET_CONFIG.nodeUrl, {
        nodeClientOptions: RPC_OPTIONS,
        pxe: {
          store: stores.pxeStore,
        },
        walletDb: {
          store: stores.walletStore,
        },
      });

      if (AZTEC_WALLET_CONFIG.network === 'testnet') {
        const fpc = await sdk.getContractInstanceFromInstantiationParams(sdk.SponsoredFPCContract.artifact, { salt: new Fr(0) });
        if (fpc.address.toString().toLowerCase() !== AZTEC_WALLET_CONFIG.sponsoredFpc.toLowerCase()) {
          throw new Error('The Aztec libraries in this build do not match the network the wallet was set up for.');
        }
        // Sponsored fees exist only where lib/aztec/fees.ts lists a sponsor (never on Alpha).
        assertFeeChoice(identity.network ?? 'mainnet', { kind: 'sponsored', fpc: fpc.address.toString() }, AZTEC_WALLET_CONFIG.sponsoredFpc);
        await this.wallet.registerContract(fpc, sdk.SponsoredFPCContract.artifact);
        this.sponsoredFee = { paymentMethod: new sdk.SponsoredFeePaymentMethod(fpc.address) };
        this.fee = this.sponsoredFee;
      } else {
        // Alpha: Fee Juice only. The L1 portal and token the node reports must
        // be the pinned ones, or nothing is ever bridged through it.
        assertNodeFeeJuiceMatchesPins('mainnet', (info as any).l1ContractAddresses);
        this.sponsoredFee = null;
        this.fee = undefined; // pays from the account's Fee Juice balance
        this.claimSecrets = await deriveFeeJuiceClaimSecrets(signature, CLAIM_SECRETS, Fr.MODULUS);
      }

      const keys = await deriveAccountKeys(signature, Fr.MODULUS, Fq.MODULUS);
      const manager = await this.wallet.createSchnorrAccount(
        new Fr(keys.secret),
        new Fr(keys.salt),
        new Fq(keys.signingKey),
        `ledger-${evm.slice(2, 10)}`,
      );
      this.me = manager.address;
      this.manager = manager;
      this.signingKey = new Fq(keys.signingKey);
      this.salt = new Fr(keys.salt);
      this.set({ aztecAddress: this.me.toString() });

      this.set({ step: AZTEC_WALLET_CONFIG.network === 'mainnet' ? 'Loading tokens' : 'Loading the test tokens' });
      // G3: on Alpha every configured token must run the trusted Token class with the exact
      // transfer_in_private our contracts call; one failing token refuses the wallet (operator config error).
      const tokenCheck = AZTEC_WALLET_CONFIG.network === 'mainnet' ? await import('../token-check') : null;
      for (const t of AZTEC_WALLET_CONFIG.tokens) {
        const addr = AztecAddress.fromStringUnsafe(t.address);
        if (tokenCheck) {
          const c = await tokenCheck.checkTokenInstance(this.node, t.address, [sdk.TokenContract.artifact]);
          if (!c.ok) throw new Error(`${t.symbol} is not a token this app can use on ${networkLabel()}: ${c.reason}.`);
        }
        const instance = await this.node.getContract(addr);
        if (!instance) throw new Error(`${t.symbol} is not deployed on this network. Run the setup script again.`);
        await this.wallet.registerContract(instance, sdk.TokenContract.artifact);
        this.tokens.set(t.key, sdk.TokenContract.at(addr, this.wallet));
      }

      const meta = await this.wallet.getContractMetadata(this.me);
      if (String(meta?.initializationStatus) !== 'INITIALIZED') {
        const deployed = await this.deployAccount();
        if (!deployed) return; // Alpha: waiting for Fee Juice (phase 'needs-fee-juice')
      }

      this.set({ phase: 'ready', step: undefined });
      await this.refresh();
    } catch (err: any) {
      this.set({ phase: 'error', step: undefined, error: humanError(err) });
      throw err;
    }
  }

  /**
   * Deploys the account. Test network: sponsored. Alpha: only by claiming a
   * ready Fee Juice deposit in the same transaction; without one the wallet
   * waits in 'needs-fee-juice' and returns false.
   */
  private async deployAccount(): Promise<boolean> {
    const sdk = this.sdk!;
    let fee = this.sponsoredFee;
    let consumed: FeeJuiceClaim | undefined;
    if (AZTEC_WALLET_CONFIG.network === 'mainnet') {
      const state = await this.refreshFeeJuice();
      if (state.plan !== 'claim') {
        this.set({
          phase: 'needs-fee-juice',
          step:
            state.plan === 'wait-claim'
              ? 'Your Fee Juice is on its way from Ethereum. Your account is created as soon as it arrives (usually a few minutes).'
              : 'Your private account needs Fee Juice to be created. Bridge AZTEC from your Ethereum wallet to continue.',
        });
        if (state.plan === 'wait-claim') this.pollClaims();
        return false;
      }
      const ready = state.claims.find((c) => c.ready)!.claim;
      fee = { paymentMethod: this.claimMethod(ready) };
      consumed = ready;
    }
    this.set({ phase: 'deploying', step: `Creating your private account on ${networkLabel()}. The first proof can take a minute.` });
    const id = `deploy-${this.me.toString()}`;
    upsertActivity(this.me.toString(), { id, kind: 'deploy', status: 'proving', createdAt: Date.now() });
    const deploy = await this.manager.getDeployMethod();
    const receipt = await this.sendAndWait(() => deploy.send({ from: sdk.NO_FROM, fee, wait: sdk.NO_WAIT }), id, 'deploy');
    if (!receipt) {
      const detail = this.snapshot.activity.find((a) => a.id === id)?.error;
      throw new Error(detail ? `Your private account could not be created: ${detail}` : 'Your private account could not be created. Please try again.');
    }
    if (consumed) this.dropClaim(consumed);
    return true;
  }

  /* ------------------------------------------------------------- Fee Juice */

  private claimMethod(c: FeeJuiceClaim) {
    const sdk = this.sdk!;
    const secret = this.claimSecrets[c.secretIndex];
    if (secret === undefined) throw new Error('This Fee Juice deposit was made with a key this wallet does not have.');
    return new sdk.FeeJuicePaymentMethodWithClaim(this.me, {
      claimAmount: BigInt(c.claimAmount),
      claimSecret: new sdk.Fr(secret),
      messageLeafIndex: BigInt(c.messageLeafIndex),
    });
  }

  private dropClaim(c: FeeJuiceClaim) {
    const me = this.me.toString();
    saveClaims(me, loadClaims(me).filter((x) => x.messageHash.toLowerCase() !== c.messageHash.toLowerCase()));
    const used = consumedIndexes(me);
    if (!used.includes(c.secretIndex)) {
      try { localStorage.setItem(CONSUMED_KEY(me), JSON.stringify([...used, c.secretIndex])); } catch {}
    }
  }

  /** Reads the Fee Juice balance and pending deposits (Alpha). */
  async refreshFeeJuice(): Promise<FeeJuiceState> {
    const sdk = this.sdk!;
    const me = this.me.toString();
    const balance = BigInt(await sdk.getFeeJuiceBalance(this.me, this.node));
    const claims = await Promise.all(
      loadClaims(me).map(async (claim) => ({
        claim,
        ready: await sdk.isL1ToL2MessageReady(this.node, sdk.Fr.fromHexString(claim.messageHash)).catch(() => false),
      })),
    );
    const plan = feePlan({ network: 'mainnet', hasSponsor: false, feeJuiceBalance: balance, minBalance: 1n, claims }).kind;
    const state: FeeJuiceState = { balance, claims, plan };
    this.set({ feeJuice: state });
    return state;
  }

  /** Alpha: fresh node identity + Fee Juice pins before anything moves value (fail-closed). */
  private async assertNodeStillPinned() {
    if (AZTEC_WALLET_CONFIG.network !== 'mainnet') return;
    assertNodeForValue((await this.node.getNodeInfo()) as any, 'mainnet');
  }

  /** Fee options for the next transaction, and the deposit it consumes (if any). */
  private async resolveFee(): Promise<{ fee: any; consumes?: FeeJuiceClaim }> {
    if (AZTEC_WALLET_CONFIG.network !== 'mainnet') return { fee: this.sponsoredFee };
    await this.assertNodeStillPinned();
    const state = await this.refreshFeeJuice();
    if (state.plan === 'claim') {
      const c = state.claims.find((x) => x.ready)!.claim;
      return { fee: { paymentMethod: this.claimMethod(c) }, consumes: c };
    }
    if (state.plan === 'balance') return { fee: undefined };
    throw new Error(
      state.plan === 'wait-claim'
        ? 'Your Fee Juice is still arriving from Ethereum. Try again in a few minutes.'
        : 'You have no Fee Juice to pay the network fee. Bridge AZTEC from your Ethereum wallet first.',
    );
  }

  /**
   * Bridges `amount` whole AZTEC from the user's Ethereum wallet into Fee
   * Juice for this account (Alpha only). Returns once the L1 deposit is mined;
   * the account is created automatically when the deposit reaches Aztec.
   */
  async bridgeFeeJuice(l1: L1Clients, amount: string | bigint, onStep?: (step: BridgeStep, l1TxHash?: string) => void) {
    if (AZTEC_WALLET_CONFIG.network !== 'mainnet') throw new Error('Fee Juice is only needed on Aztec Alpha. The test network sponsors fees.');
    if (!this.me || !this.sdk) throw new Error('Open your private wallet first.');
    // The deposit goes to the pinned portal regardless; a drifted node could never deliver the claim.
    await this.assertNodeStillPinned();
    const units = typeof amount === 'bigint' ? amount : parseUnits(amount, 18);
    const me = this.me.toString();
    const pending = loadClaims(me);
    const index = nextSecretIndex(pending, consumedIndexes(me));
    if (index >= this.claimSecrets.length) throw new Error('Too many unclaimed Fee Juice deposits. Wait for the pending ones to arrive.');
    const secretHash = (await this.sdk.computeSecretHash(new this.sdk.Fr(this.claimSecrets[index]))).toString();
    const claim = await bridgeOnL1(l1, { network: 'mainnet', recipient: me, amount: units, secretHash, secretIndex: index }, onStep);
    saveClaims(me, mergeClaims(loadClaims(me), [claim]));
    await this.refreshFeeJuice();
    this.pollClaims();
    return claim;
  }

  /**
   * Finds this account's Fee Juice deposits on L1 again (after clearing the
   * browser, or on a new device) by re-deriving claim secrets. `l1.getLogs`
   * is viem's PublicClient.getLogs.
   */
  async recoverFeeJuiceClaims(l1: Required<Pick<L1Clients, 'getLogs'>>) {
    if (!this.me || !this.sdk) throw new Error('Open your private wallet first.');
    const me = this.me.toString();
    const sdk = this.sdk;
    const found = await recoverClaims(l1, {
      network: 'mainnet',
      recipient: me,
      fromBlock: AZTEC_WALLET_CONFIG.l1FromBlock,
      maxIndex: this.claimSecrets.length,
      secretHashForIndex: async (i) => (await sdk.computeSecretHash(new sdk.Fr(this.claimSecrets[i]))).toString(),
    });
    const used = new Set(consumedIndexes(me));
    saveClaims(me, mergeClaims(loadClaims(me), found.filter((c) => !used.has(c.secretIndex))));
    await this.refreshFeeJuice();
    return found.length;
  }

  /** While a deposit is on its way, checks every 15 s and finishes setup when it can be claimed. */
  private pollClaims() {
    if (this.claimPoll) return;
    const started = Date.now();
    this.claimPoll = setInterval(async () => {
      if (Date.now() - started > 45 * 60 * 1000 || !this.me) return this.stopPoll();
      try {
        const state = await this.refreshFeeJuice();
        if (state.plan === 'claim' && this.snapshot.phase === 'needs-fee-juice') {
          this.stopPoll();
          if (await this.deployAccount()) {
            this.set({ phase: 'ready', step: undefined });
            await this.refresh();
          }
        } else if (state.plan !== 'wait-claim') {
          this.stopPoll();
        }
      } catch (err) {
        this.stopPoll();
        this.set({ phase: 'error', step: undefined, error: humanError(err) });
      }
    }, 15_000);
  }

  private stopPoll() {
    if (this.claimPoll) clearInterval(this.claimPoll);
    this.claimPoll = null;
  }

  /* ----------------------------------------------------------- G7 binding */

  /**
   * Proof that this wallet controls its Aztec address, for one DM: a Schnorr
   * signature by the account's signing key over the binding statement
   * (peer-binding.ts). The proof is checked locally before it is returned,
   * so a derivation mismatch is caught here and never sent.
   */
  async aztecAddressProof(signerInboxId: string, recipientInboxId: string): Promise<AddressProof> {
    if (this.snapshot.phase !== 'ready' || !this.me || !this.signingKey || !this.manager) {
      throw new Error('Open your private wallet first.');
    }
    const [{ Schnorr }, bn] = await Promise.all([import('@aztec-labs/foundation/crypto/schnorr'), import('@aztec-labs/foundation/curves/bn254')]);
    const Fr = (bn as any).Fr;
    const crypto = await sdkBindingCrypto();
    const schnorr = new (Schnorr as any)();
    const pk = await schnorr.computePublicKey(this.signingKey);
    const address = this.me.toString().toLowerCase();
    const msg = Fr.fromHexString(await crypto.messageField(bindingStatement(address, signerInboxId, recipientInboxId)));
    const sig = await schnorr.constructSignature(msg, this.signingKey);
    const proof: AddressProof = {
      scheme: BINDING_SCHEME,
      signingPublicKey: { x: pk.x.toString(), y: pk.y.toString() },
      salt: this.salt.toString(),
      publicKeys: this.manager.getInstance().publicKeys.toString(),
      signerInboxId,
      recipientInboxId,
      signature: sig.toString(),
    };
    const check = await verifyAddressProof(
      { type: 'hl.aztec_address', version: 2, address, proof },
      { senderInboxId: signerInboxId, selfInboxId: recipientInboxId },
      crypto,
    );
    if (!check.ok) throw new Error(`Could not prove control of your Aztec address: ${check.reason}.`);
    return proof;
  }

  /* --------------------------------------------------------------- reading */

  async refresh(): Promise<void> {
    if (!this.wallet || !this.me) return;
    const balances: TokenBalance[] = [];
    for (const t of AZTEC_WALLET_CONFIG.tokens) {
      const c = this.tokens.get(t.key);
      const [priv, pub] = await Promise.all([
        c.methods.balance_of_private(this.me).simulate({ from: this.me }),
        c.methods.balance_of_public(this.me).simulate({ from: this.me }),
      ]);
      balances.push({
        key: t.key,
        symbol: t.symbol,
        decimals: t.decimals,
        privateUnits: BigInt(unwrap(priv)),
        publicUnits: BigInt(unwrap(pub)),
      });
    }
    this.set({ balances, activity: await this.loadActivity() });
  }

  private async loadActivity(): Promise<Activity[]> {
    const me = this.me.toString();
    const local = loadLocalActivity(me);
    const fromEvents: Activity[] = [];
    const sdk = this.sdk!;
    for (const t of AZTEC_WALLET_CONFIG.tokens) {
      try {
        const events = await this.wallet.getPrivateEvents(sdk.TokenContract.events.Transfer, {
          contractAddress: sdk.AztecAddress.fromStringUnsafe(t.address),
          scopes: [this.me],
        });
        for (const e of events) {
          const from = String(e.event.from).toLowerCase();
          const to = String(e.event.to).toLowerCase();
          const txHash = e.metadata?.txHash?.toString?.();
          const blockNumber = Number(e.metadata?.l2BlockNumber ?? e.metadata?.blockNumber ?? 0) || undefined;
          const outgoing = from === me.toLowerCase();
          // A transfer to yourself is change from your own send; it is not activity.
          if (outgoing && to === me.toLowerCase()) continue;
          fromEvents.push({
            id: `${txHash}:${outgoing ? 'send' : 'receive'}:${t.key}`,
            kind: outgoing ? 'send' : 'receive',
            token: t.key,
            amount: BigInt(e.event.amount).toString(),
            counterparty: outgoing ? to : from,
            txHash,
            blockNumber,
            status: 'settled',
            createdAt: Date.now(),
          });
        }
      } catch {
        // Event decoding failing for one token must not hide the others.
      }
    }
    return mergeActivity(local, fromEvents);
  }

  /* --------------------------------------------------------------- actions */

  /** Moves tokens from the public balance into private notes. */
  shield(key: TokenKey, amount: string) {
    const units = parseUnits(amount, tokenConfig(key).decimals);
    return this.run('shield', key, units, undefined, (c) => c.methods.transfer_to_private(this.me, units));
  }

  /** Moves tokens from private notes back to the public balance of an Aztec address (yours by default). */
  async unshield(key: TokenKey, amount: string, to?: string) {
    const units = parseUnits(amount, tokenConfig(key).decimals);
    const target = to ? await this.validAddress(to) : this.me;
    return this.run('unshield', key, units, to?.toLowerCase(), (c) => c.methods.transfer_to_public(this.me, target, units, 0));
  }

  /** Sends a private payment. Only the recipient can see the amount and the sender. */
  async send(key: TokenKey, amount: string, to: string) {
    const units = parseUnits(amount, tokenConfig(key).decimals);
    const target = await this.validAddress(to);
    if (target.equals?.(this.me)) throw new Error('That is your own address.');
    return this.run('send', key, units, to.trim().toLowerCase(), (c) => c.methods.transfer(target, units));
  }

  /** Format check, then a check that the address is a point on the curve, so a typo cannot burn funds. */
  private async validAddress(value: string) {
    if (!isAztecAddress(value)) throw new Error('That is not an Aztec address. It starts with 0x and has 64 characters after it.');
    // Curve check without the SDK (gap G1); the SDK check below stays as a second opinion.
    if (!isValidAztecAddress(value)) throw new Error('That Aztec address is not valid. Check it and try again.');
    const addr = this.sdk!.AztecAddress.fromStringUnsafe(value.trim());
    if (!(await addr.isValid())) throw new Error('That Aztec address is not valid. Check it and try again.');
    return addr;
  }

  /** Mints test tokens to your public balance. Test network only; the tokens have no value. */
  async faucet(key: TokenKey) {
    const cfg = AZTEC_WALLET_CONFIG.faucet;
    if (!cfg) throw new Error('The test faucet is not configured on this server.');
    const sdk = this.sdk!;
    if (!this.faucetAddress) {
      const manager = await this.wallet.createSchnorrAccount(
        sdk.Fr.fromString(cfg.secret),
        sdk.Fr.fromString(cfg.salt),
        sdk.Fq.fromString(cfg.signingKey),
        'test-faucet',
      );
      this.faucetAddress = manager.address;
    }
    const units = parseUnits(FAUCET_AMOUNT[key], tokenConfig(key).decimals);
    return this.run('faucet', key, units, undefined, (c) => c.methods.mint_to_public(this.me, units), this.faucetAddress);
  }

  /**
   * Lets the PXE look for notes from a sender it has not seen before. Aztec
   * finds incoming notes through tags shared between sender and recipient, so
   * a payment from a new person is only discovered once their address is
   * known to your wallet.
   */
  async addSender(aztecAddress: string) {
    if (!isAztecAddress(aztecAddress)) throw new Error('That is not an Aztec address.');
    await this.wallet.registerSender(this.sdk!.AztecAddress.fromStringUnsafe(aztecAddress), `sender-${aztecAddress.slice(2, 10)}`);
    await this.refresh();
  }

  private async run(
    kind: ActivityKind,
    key: TokenKey,
    units: bigint,
    counterparty: string | undefined,
    build: (contract: any) => any,
    from?: any,
  ) {
    if (this.snapshot.phase !== 'ready') throw new Error('The private wallet is not open yet.');
    // 4.19: one token transaction at a time from this tab, whatever surface started it. Two in parallel
    // would also pick the same ready Fee Juice claim, and the second would fail after proving.
    if (this.tokenTxInFlight) throw new Error('Another private transaction is still being proven on this device. Wait for it to finish.');
    this.tokenTxInFlight = true;
    try {
      return await this.runLocked(kind, key, units, counterparty, build, from);
    } finally {
      this.tokenTxInFlight = false;
    }
  }

  private tokenTxInFlight = false;

  /** True while anything is being proven or sent; local data must not be removed then. */
  get transacting(): boolean {
    return this.tokenTxInFlight || this.state.busy || valueActionsRunning() > 0 || this.state.phase === 'signing' || this.state.phase === 'starting' || this.state.phase === 'deploying';
  }

  private async runLocked(
    kind: ActivityKind,
    key: TokenKey,
    units: bigint,
    counterparty: string | undefined,
    build: (contract: any) => any,
    from?: any,
  ) {
    const contract = this.tokens.get(key);
    const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    upsertActivity(this.me.toString(), {
      id,
      kind,
      token: key,
      amount: units.toString(),
      counterparty,
      status: 'proving',
      createdAt: Date.now(),
    });
    this.set({ activity: await this.loadActivity() });
    const { fee, consumes } = await this.resolveFee();
    const receipt = await this.sendAndWait(
      () => build(contract).send({ from: from ?? this.me, fee, wait: this.sdk!.NO_WAIT }),
      id,
      kind,
    );
    if (receipt && consumes) this.dropClaim(consumes);
    await this.refresh();
    if (!receipt) throw new Error(this.snapshot.activity.find((a) => a.id === id)?.error ?? 'The transaction failed.');
    return receipt;
  }

  /** Proves and sends on this device, then waits for the network to include the transaction. */
  private async sendAndWait(sendFn: () => Promise<any>, id: string, kind: ActivityKind) {
    const me = this.me.toString();
    this.inflight++;
    this.set({});
    try {
      const sent = await sendFn();
      const txHash = sent.txHash?.toString?.() ?? String(sent.txHash);
      upsertActivity(me, { id, kind, txHash, status: 'pending', createdAt: Date.now() });
      this.set({ activity: await this.loadActivity() });
      const receipt = await this.sdk!.waitForTx(this.node, sent.txHash, { timeout: 600, interval: 2 });
      upsertActivity(me, {
        id,
        kind,
        txHash,
        status: 'settled',
        blockNumber: Number(receipt.blockNumber ?? 0) || undefined,
        createdAt: Date.now(),
      });
      return receipt;
    } catch (err: any) {
      upsertActivity(me, { id, kind, status: 'failed', error: humanError(err), createdAt: Date.now() });
      return null;
    } finally {
      this.inflight--;
      this.set({ activity: await this.loadActivity().catch(() => this.snapshot.activity) });
    }
  }

  /**
   * Handles of the open wallet for lib/aztec/chat-agreements.ts, which
   * opens and settles agreements with the same PXE, account and fee payment.
   * Throws until the wallet is ready.
   */
  agreementContext() {
    if (this.snapshot.phase !== 'ready' || !this.wallet || !this.me || !this.sdk) {
      throw new Error('Open your private wallet first.');
    }
    return {
      wallet: this.wallet,
      me: this.me,
      node: this.node,
      /** Fee option for agreement transactions; on Alpha re-checks the node and requires a Fee Juice balance. */
      prepareFee: async () => {
        if (AZTEC_WALLET_CONFIG.network !== 'mainnet') return this.fee;
        await this.assertNodeStillPinned();
        const c = agreementFeeCheck(await this.refreshFeeJuice());
        if (!c.ok) throw new Error(c.reason);
        return undefined; // pay from the account's Fee Juice balance
      },
      /** The token contract bound to this wallet, by token address (configured tokens only). */
      tokenAt: (address: string) => {
        const t = AZTEC_WALLET_CONFIG.tokens.find((x) => x.address.toLowerCase() === address.toLowerCase());
        return t ? { config: t, contract: this.tokens.get(t.key) } : null;
      },
      /** Re-reads balances and activity after an agreement transaction. */
      refresh: () => this.refresh(),
    };
  }

  async disconnect() {
    this.stopPoll();
    this.claimSecrets = [];
    this.manager = null;
    this.signingKey = null;
    this.salt = null;
    await this.wallet?.stop?.().catch(() => {});
    this.wallet = null;
    this.me = null;
    this.tokens.clear();
    this.faucetAddress = null;
    this.evmAddress = null;
    this.set({ phase: 'idle', aztecAddress: undefined, balances: [], activity: [], step: undefined, error: undefined, feeJuice: undefined });
  }
}

const CONSUMED_KEY = (me: string) => `hl.aztec.feejuice.consumed.${me.toLowerCase()}`;

/** Claim secret indexes already used by a consumed deposit, so they are never reused. */
function consumedIndexes(me: string): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(CONSUMED_KEY(me)) || '[]');
    return Array.isArray(v) ? v.filter((x) => Number.isInteger(x)) : [];
  } catch {
    return [];
  }
}

function unwrap(sim: any): bigint | number | string {
  // `simulate` returns `{ result }` in v6; older shapes returned the value itself.
  const v = sim && typeof sim === 'object' && 'result' in sim ? sim.result : sim;
  return typeof v === 'object' && v !== null && 'toBigInt' in v ? v.toBigInt() : v;
}

export function humanError(err: any): string {
  const msg = String(err?.shortMessage || err?.message || err || 'Unknown error');
  if (/user (rejected|denied)|rejected the request|denied message signature/i.test(msg)) return 'You declined the signature in your wallet.';
  // Fee Juice first: "insufficient fee payer balance" would otherwise read as a token balance problem.
  if (/fee.?juice|insufficient fee payer balance|not enough balance for fee/i.test(msg) && !/Bridge AZTEC|still arriving/.test(msg)) return 'Not enough Fee Juice to pay the network fee. Bridge more AZTEC from your Ethereum wallet.';
  if (/existing nullifier|duplicate nullifier|nullifier.*already/i.test(msg)) return 'Already done: this was settled or sent before. Nothing new was sent.';
  if (/out of memory|Array buffer allocation failed|memory access out of bounds|RangeError: .*memory/i.test(msg)) return 'This device ran out of memory while making the proof. Nothing was sent. Try again on a computer.';
  if (/Assertion failed:\s*(PrivateEscrow|PaymentStream)?:?\s*(.+)/i.test(msg)) return `The contract refused this: ${msg.match(/Assertion failed:\s*(?:PrivateEscrow|PaymentStream)?:?\s*([^'"\n]{1,140})/i)?.[1] ?? 'its conditions are not met'}. Nothing was sent.`;
  if (/circuit execution failed|proving failed|failed to prove|witness generation/i.test(msg)) return 'The proof could not be made on this device. Nothing was sent. Try again; if it repeats, reopen the private wallet.';
  if (/tx dropped|invalid tx|transaction .*rejected|rejected by (the )?node|reverted/i.test(msg)) return 'The Aztec node rejected the transaction. Nothing changed. Try again in a minute.';
  if (/Balance too low|not enough|insufficient/i.test(msg)) return 'Your balance is too low for this amount.';
  if (/timeout/i.test(msg)) return 'The network took too long to confirm. It may still go through; check again in a minute.';
  if (/Failed to fetch|fetch failed|NetworkError|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(msg)) return `Could not reach ${networkLabel()}. Check your connection and try again.`;
  if (/internal error/i.test(msg)) return 'Your wallet reported an internal signing error. Try switching networks or restarting your wallet.';
  return msg.length > 220 ? msg.slice(0, 220) + '…' : msg;
}

let instance: PrivateWallet | null = null;

/** One wallet per browser tab. */
export function getPrivateWallet(): PrivateWallet {
  if (typeof window === 'undefined') throw new Error('The private wallet only runs in the browser.');
  return (instance ??= new PrivateWallet());
}

export type { PrivateWallet };
