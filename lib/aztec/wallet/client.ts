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
import { issueCap, recordedAdmin } from '../token-issuer';
import { loadLocalActivity, mergeActivity, upsertActivity, type Activity, type ActivityKind } from './history';
import { paymentReason, reportPayment } from './payment-report';
import { assertFeeChoice, identifyNode } from '../fees';
import { valueActionsRunning } from '../single-flight';
import { walletNodeClientOptions, isTransientNodeError } from './node-fetch';
import { BUSY_ELSEWHERE_MESSAGE, HANDED_OFF_MESSAGE, IDLE_CLOSED_MESSAGE, IDLE_CLOSE_MS, PAUSED_MESSAGE, createTabHandoff, isStoreBusyError } from './tab-handoff';
import { assertNewValueAllowed, EXITS_ONLY_MESSAGE, VALUE_MODE_UNCONFIRMED_MESSAGE } from '../value-mode';
import { BINDING_SCHEME_V2, bindingStatement, networkTagOf, sdkBindingCrypto, valueBindingContext, verifyAddressProof, type AddressProof, type BindingNetworkContext } from '../peer-binding';
import {
  assertNodeFeeJuiceMatchesPins,
  assertNodeForValue,
  agreementFeeCheck,
  bridgeFeeJuice as bridgeOnL1,
  feePlan,
  budgetFeeFor,
  gasLimitsFromSimulation,
  loadClaims,
  mergeClaims,
  nextSecretIndex,
  recoverClaims,
  saveClaims,
  consumedMessageHash,
  sameMessageHash,
  type BridgeStep,
  type FeeJuiceClaim,
  type FeePlan,
  type L1Clients,
} from '../fee-juice';

/** How many claim secrets are derived (and scanned when recovering deposits). */
const CLAIM_SECRETS = 16;
/**
 * The claim secret reserved for Fee Juice a contact pays for you (sponsored deposits,
 * feeRequestLink). Your own deposits never use it, so a sponsor's deposit and yours can
 * never share a secret. Several sponsored deposits may share it: each is a separate L1->L2
 * message, consumed once, and tracked by message hash (CONSUMED_HASHES_KEY).
 */
export const SPONSOR_SECRET_INDEX = CLAIM_SECRETS - 1;


export type WalletPhase = 'idle' | 'signing' | 'starting' | 'needs-fee-juice' | 'deploying' | 'ready' | 'error';

/** Fee Juice state on Aztec Alpha (absent on the test network). */
export interface FeeJuiceState {
  /** Base units (18 decimals) held by the account. */
  balance: bigint;
  /** Deposits made on L1 and not yet claimed, with whether each can be claimed now. */
  claims: { claim: FeeJuiceClaim; ready: boolean }[];
  /** How the next transaction will pay. */
  plan: FeePlan['kind'];
  /** Fee Juice a transaction must be able to cover (its maximum fee), 0 if unknown. */
  minForTx: bigint;
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
  /** The raw reason the wallet did not open, for support (no keys in it): shown behind "Copy details". */
  errorDetail?: string;
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
    import('@aztec-labs/aztec.js/fields'),
    import('@aztec-labs/aztec.js/addresses'),
    import('@aztec-labs/aztec.js/node'),
    import('@aztec-labs/aztec.js/contracts'),
    import('@aztec-labs/aztec.js/fee'),
    import('@aztec-labs/aztec.js/account'),
    import('@aztec-labs/noir-contracts.js/SponsoredFPC'),
    import('@aztec-labs/noir-contracts.js/Token'),
    import('@aztec-labs/wallets/embedded'),
    import('@aztec-labs/aztec.js/utils'),
    import('@aztec-labs/aztec.js/messaging'),
    import('@aztec-labs/aztec.js/crypto'),
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
  /** "aztec:<l1ChainId>:<rollupVersion>" of the node, for G7 proofs (peer-binding.ts scheme v2). */
  private networkTag: string | undefined;
  /** Portal master secret P (lib/portal/receivers.ts), derived from the signature at connect. */
  private portalMaster: string | null = null;
  private portalArtifactCache: any = null;
  private claimPoll: ReturnType<typeof setInterval> | null = null;
  private tokens = new Map<TokenKey, any>();
  private faucetAddress: any = null;
  private evmAddress: string | null = null;
  private listeners = new Set<Listener>();
  private inflight = 0;
  private connecting: Promise<void> | null = null;
  /** The encrypted stores this tab holds open (each holds an origin-wide lock on its OPFS pool). */
  private stores: { pxeStore: any; walletStore: any } | null = null;
  private handoff: ReturnType<typeof createTabHandoff> | null = null;

  private snapshot: WalletSnapshot = { phase: 'idle', balances: [], activity: [], busy: false };

  constructor() {
    if (typeof window === 'undefined') return;
    // Opening the wallet in another tab asks this one to close it (tab-handoff.ts).
    this.handoff = createTabHandoff({
      holds: () => this.stores !== null,
      canRelease: () => !this.transacting && !this.connecting,
      release: () => this.release(HANDED_OFF_MESSAGE),
    });
    // Safari and Chrome keep a page in the back/forward cache with its locks held: a frozen
    // page would keep the wallet "open in another tab" with no tab to close. Close it on the way out.
    window.addEventListener('pagehide', (ev) => {
      if ((ev as PageTransitionEvent).persisted && this.stores && !this.transacting) {
        void this.release(PAUSED_MESSAGE);
      }
    });
    // The in-browser node and prover hold a lot of memory. A tab left in the background with an
    // idle wallet gives it back after IDLE_CLOSE_MS; never during a payment, a proof, or while
    // waiting for Fee Juice to arrive (that wait finishes the account by itself).
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    document.addEventListener('visibilitychange', () => {
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
      if (document.visibilityState !== 'hidden') return;
      idleTimer = setTimeout(() => {
        idleTimer = null;
        if (document.visibilityState === 'hidden' && this.stores && !this.transacting && this.snapshot.phase === 'ready') {
          void this.release(IDLE_CLOSED_MESSAGE);
        }
      }, IDLE_CLOSE_MS);
    });
  }

  /**
   * Stops the PXE and closes both encrypted stores, freeing their locks. Keys held in memory for
   * address proofs are dropped. Idempotent; never throws.
   */
  private async teardown() {
    this.stopPoll();
    const wallet = this.wallet;
    const stores = this.stores;
    this.wallet = null;
    this.stores = null;
    this.me = null;
    this.manager = null;
    this.signingKey = null;
    this.salt = null;
    this.claimSecrets = [];
    this.tokens.clear();
    const settle = (p: Promise<unknown> | undefined) =>
      Promise.race([Promise.resolve(p).catch(() => {}), new Promise((r) => setTimeout(r, 4_000))]);
    if (wallet) await settle(wallet.stop?.());
    // stop() may already have closed them; closing again is harmless and makes sure the locks go.
    if (stores) {
      await settle(stores.walletStore?.close?.());
      await settle(stores.pxeStore?.close?.());
    }
  }

  /** Closes the wallet in this tab (handed to another tab, or page frozen); it can be opened again. */
  private async release(message: string) {
    await this.teardown();
    this.evmAddress = null;
    this.set({ phase: 'error', step: undefined, error: message, aztecAddress: undefined, balances: [], feeJuice: undefined });
  }

  /** Opens the stores; if another tab holds them, asks it to hand the wallet over, then retries. */
  private async openStores(signature: string, names: { pxeName?: string; walletName?: string }) {
    const { openEncryptedWalletStores } = await import('./store');
    try {
      return await openEncryptedWalletStores(signature, names);
    } catch (err) {
      if (!isStoreBusyError(err) || !this.handoff) throw err;
      this.set({ step: 'Closing the private wallet in your other Ledger Chat tab' });
      const answer = await this.handoff.requestRelease();
      if (answer === 'busy') throw new Error(BUSY_ELSEWHERE_MESSAGE);
      // 'none': no other tab holds it. The lock is most likely this page's own, from a wallet just
      // closed after a failed step (Safari lets go of OPFS handles late), so the retries below still
      // apply. Seen on iPhone with a single tab, 12 Nov 2026.
      // The other tab closed its stores; its locks can take a moment to be let go.
      let last: unknown = err;
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 250 + i * 150));
        try {
          return await openEncryptedWalletStores(signature, names);
        } catch (e) {
          last = e;
          if (!isStoreBusyError(e)) throw e;
        }
      }
      throw last;
    } finally {
      this.set({ step: 'Initializing encrypted storage' });
    }
  }

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
        throw new Error(
          AZTEC_WALLET_CONFIG.network === 'mainnet'
            ? 'The private wallet is not enabled on this server: Aztec Alpha needs NEXT_PUBLIC_AZTEC_ALPHA_ENABLED=true.'
            : 'The private wallet has not been set up on this server yet. The operator needs to run scripts/aztec/setup-testnet.mjs.',
        );
      }

      this.set({ phase: 'signing', step: 'Waiting for your wallet signature', error: undefined });
      const signature = await signTypedData(walletTypedData());

      this.set({ phase: 'starting', step: 'Starting the private node in your browser' });
      // A wallet left from an earlier attempt in this tab still holds its stores: free them first,
      // or this tab would report itself as "another tab".
      await this.teardown();
      const sdk = (this.sdk ??= await loadSdk());
      const { Fr, Fq } = sdk;

      // Direct to the public node, with this site's relay as the fallback route (node-fetch.ts).
      this.node = sdk.createAztecNodeClient(AZTEC_WALLET_CONFIG.nodeUrl, await walletNodeClientOptions(RPC_OPTIONS.maxBatchSize));
      const info = await this.node.getNodeInfo();
      assertNetworkAllowed(Number(info.l1ChainId));
      // A node on another rollup or release fails later in obscure ways
      // (unknown classes, rejected proofs); say so now, in words.
      // A different node release is reported; a different rollup or L1 is refused.
      const identity = identifyNode(info as any);
      this.networkTag = networkTagOf(info as any);
      const blocking = identity.drift.filter((d) => d.field !== 'nodeVersion');
      for (const d of identity.drift.filter((x) => x.field === 'nodeVersion')) {
        console.warn(`[wallet] Aztec node ${d.actual}, this build was made for ${d.expected}`);
      }
      if (blocking.length) {
        throw new Error(
          `The Aztec node does not match this build: ${blocking.map((d) => `${d.field} ${d.actual} (expected ${d.expected})`).join(', ')}.`,
        );
      }

      this.set({ step: 'Initializing encrypted storage' });
      // One encrypted store pair per network, rollup and account: a second account on this browser
      // never hits decrypt_failed on someone else's store, and a new rollup never reuses stale notes.
      const { walletStoreNames, wipeLegacyPlainStores } = await import('./wipe');
      const names = await walletStoreNames(AZTEC_WALLET_CONFIG.network, String((info as any).l1ContractAddresses?.rollupAddress ?? ''), evm);
      const stores = await this.openStores(signature, names);
      this.stores = stores;

      // The same node client (and route) for the PXE as for the checks above.
      this.wallet = await sdk.EmbeddedWallet.create(this.node, {
        pxe: {
          store: stores.pxeStore,
        },
        walletDb: {
          store: stores.walletStore,
        },
      });
      // Encrypted stores are open: plaintext stores from earlier versions only hold copies of keys and notes.
      void wipeLegacyPlainStores();

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
      // Receiver addresses (lib/portal/receivers.ts): one master secret, kept in memory like the keys.
      this.portalMaster = await (await import('../../portal/receivers')).derivePortalMaster(signature);
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
      // A token that cannot be checked or loaded right now (a slow node, a dropped request) no longer
      // keeps the whole wallet shut: it is left out, said so, and retried on Sync. A token that fails
      // the G3 check is still never used (ensureTokens).
      const tokenIssues = await this.ensureTokens();

      const meta = await this.wallet.getContractMetadata(this.me);
      if (String(meta?.initializationStatus) !== 'INITIALIZED') {
        const deployed = await this.deployAccount();
        if (!deployed) return; // Alpha: waiting for Fee Juice (phase 'needs-fee-juice')
      }

      this.set({ phase: 'ready', step: undefined, errorDetail: undefined });
      await this.refreshQuietly();
      if (tokenIssues.length) this.set({ error: tokenIssuesMessage(tokenIssues) });
    } catch (err: any) {
      // Say where it stopped; the raw error goes to the console for support.
      const where = this.snapshot.step;
      console.error('[private wallet] open failed', where ? `at "${where}"` : '', err);
      // A wallet that did not open must not keep its stores locked: the next try, here or in
      // another tab, would otherwise be told the wallet is open somewhere else.
      await this.teardown();
      this.set({
        phase: 'error',
        step: undefined,
        error: where ? `${humanError(err)} (Step: ${where}.)` : humanError(err),
        errorDetail: errorDetailFor(where, err),
      });
      throw err;
    }
  }

  /**
   * Reads balances and activity once the wallet is open. A failure here (a slow node, a sync hiccup) is
   * shown as a notice and never turns an open wallet, a created account or a sent payment into an error:
   * that would ask the user to sign again or, worse, to send a payment that already went through.
   */
  private async refreshQuietly() {
    try {
      await this.refresh();
    } catch (err) {
      this.set({ error: `Your wallet is open, but the latest balances could not be read: ${humanError(err)} Use Sync to try again.` });
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
      // Some Fee Juice, but less than the budget: creation runs with estimated gas limits, which
      // usually need far less. The node refuses it if they are not covered, and nothing is lost.
      const readyClaim = state.plan === 'top-up' ? state.claims.find((c) => c.ready)?.claim : undefined;
      if (state.plan === 'top-up' && state.balance > 0n) {
        fee = undefined;
      } else if (readyClaim) {
        fee = { paymentMethod: this.claimMethod(readyClaim) };
        consumed = readyClaim;
      } else if (state.plan !== 'claim') {
        this.set({
          phase: 'needs-fee-juice',
          step:
            state.plan === 'wait-claim'
              ? 'Your Fee Juice is on its way from Ethereum. Your account is created as soon as it arrives (usually a few minutes).'
              : state.plan === 'top-up'
                ? `Your Fee Juice arrived, but creating the account needs up to ${fmtAztec(state.minForTx)} AZTEC of Fee Juice (only the gas used is charged, the rest stays yours). Add at least ${fmtAztec(state.minForTx)} AZTEC in one deposit. You can already receive payments at your address.`
                : 'You can already receive private payments at your address. To send, your account needs Fee Juice: bridge AZTEC from your Ethereum wallet.',
        });
        if (state.plan === 'wait-claim') this.pollClaims();
        return false;
      } else {
        const plan = feePlan({ network: 'mainnet', hasSponsor: false, feeJuiceBalance: state.balance, minBalance: state.minForTx > 0n ? state.minForTx : 1n, claims: state.claims });
        const ready = (plan as { claim: FeeJuiceClaim }).claim;
        fee = { paymentMethod: this.claimMethod(ready) };
        consumed = ready;
      }
    }
    this.set({ phase: 'deploying', step: `Creating your private account on ${networkLabel()}. The first proof can take a minute.` });
    const id = `deploy-${this.me.toString()}`;
    upsertActivity(this.me.toString(), { id, kind: 'deploy', status: 'proving', createdAt: Date.now() });
    const deploy = await this.manager.getDeployMethod();
    // Account creation with estimated gas limits, like transfers: the account's own Fee Juice then
    // only has to cover the estimated maximum. If the estimate fails, the defaults are kept.
    const deployGas = await this.estimatedGasSettings(deploy, sdk.NO_FROM, fee);
    const deployFee = deployGas ? { ...(fee ?? {}), gasSettings: deployGas } : fee;
    const receipt = await this.sendAndWait(() => deploy.send({ from: sdk.NO_FROM, fee: deployFee, wait: sdk.NO_WAIT }), id, 'deploy');
    if (!receipt) {
      const detail = this.snapshot.activity.find((a) => a.id === id)?.error;
      throw new Error(detail ? `Your private account could not be created: ${detail}` : 'Your private account could not be created. Please try again.');
    }
    if (consumed) this.dropClaim(consumed);
    return true;
  }

  /* ------------------------------------------------------------- Fee Juice */

  /**
   * R1, operator only: the first private payment on Alpha with a token this account issues.
   *
   * The recorded HLC (deployments/aztec-mainnet.json) has an admin key nobody holds any more, so no
   * HLC can ever be minted. This deploys a fresh standard Token with THIS account as admin, mints
   * `mint` to this account's PRIVATE balance, and pays `pay` privately to `to`. Every step pays its
   * fee in Fee Juice. The new token's address is kept on this device (public data, no secret) so a
   * reload resumes after the deploy instead of deploying twice. Returns the transaction hashes.
   */
  async firstPaymentWithNewToken(
    opts: { name: string; symbol: string; decimals: number; mint: string; pay: string; to: string },
    onStep?: (step: 'deploy' | 'mint' | 'pay', info: { token?: string; txHash?: string }) => void,
  ): Promise<{ token: string; deployTx?: string; mintTx: string; payTx: string }> {
    if (AZTEC_WALLET_CONFIG.network !== 'mainnet') throw new Error('This tool is for Aztec Alpha only.');
    await assertNewValueAllowed();
    const ctx = this.agreementContext();
    const sdk = this.sdk!;
    const me = ctx.me;
    const target = await this.validAddress(opts.to);
    if (target.equals?.(me)) throw new Error('Pay another account, not your own.');
    const mintUnits = parseUnits(opts.mint, opts.decimals);
    const payUnits = parseUnits(opts.pay, opts.decimals);
    if (mintUnits <= 0n || payUnits <= 0n || payUnits > mintUnits) throw new Error('The payment must be more than 0 and no more than the amount issued.');
    if (mintUnits > issueCap(opts.decimals)) throw new Error('Issue at most 1,000 at a time.');
    const artifact = sdk.TokenContract.artifact;
    const KEY = `hl:r1-token:${me.toString().toLowerCase()}`;
    const txOf = (r: any) => (r?.txHash?.toString?.() ?? (r?.txHash ? String(r.txHash) : ''));
    const withFee = async (label: string, kind: ActivityKind, send: (fee: any) => Promise<any>) => {
      const { fee, consumes } = await this.resolveFee();
      const receipt = await this.sendAndWait(() => send(fee), `${label}-${Date.now()}`, kind);
      if (!receipt) throw new Error(this.snapshot.activity[0]?.error || `The ${label} transaction failed. Nothing more was sent.`);
      if (consumes) this.dropClaim(consumes);
      return receipt;
    };

    // 1. Deploy (or resume with the token deployed earlier from this device).
    let token = '';
    let deployTx: string | undefined;
    try { token = localStorage.getItem(KEY) || ''; } catch { /* not kept */ }
    if (!token) {
      const [{ Contract, DeployMethod }, { randomField }] = await Promise.all([import('@aztec-labs/aztec.js/contracts'), import('../random')]);
      const args = [me, opts.name, opts.symbol, opts.decimals];
      const salt = randomField();
      // Universal deployment: the address does not depend on the deployer and is known before sending.
      const expected = await sdk.getContractInstanceFromInstantiationParams(artifact, { constructorArgs: args, salt, deployer: sdk.AztecAddress.ZERO });
      token = expected.address.toString();
      onStep?.('deploy', { token });
      const deployment = (DeployMethod as any).create(
        ctx.wallet,
        { artifact, args, postDeployCtor: (instance: any, w: any) => (Contract as any).at(instance.address, artifact, w) },
        { salt, universalDeploy: true },
      );
      const r = await withFee('token-deploy', 'deploy', (fee) => deployment.send({ from: me, fee, wait: sdk.NO_WAIT }));
      deployTx = txOf(r);
      try { localStorage.setItem(KEY, token); } catch { /* not kept */ }
      onStep?.('deploy', { token, txHash: deployTx });
    }
    const addr = sdk.AztecAddress.fromStringUnsafe(token);
    try {
      const instance = await this.node.getContract(addr);
      if (instance) await this.wallet.registerContract(instance, artifact);
    } catch { /* already known to this wallet */ }
    const contract = sdk.TokenContract.at(addr, this.wallet);

    // 2. Issue privately to this account.
    onStep?.('mint', { token });
    const fn = artifact.functions?.find((f: any) => f.name === 'mint_to_private');
    const mintCall = fn?.parameters?.length === 3 ? contract.methods.mint_to_private(me, me, mintUnits) : contract.methods.mint_to_private(me, mintUnits);
    const mintTx = txOf(await withFee('issue', 'issue', (fee) => mintCall.send({ from: me, fee, wait: sdk.NO_WAIT })));
    onStep?.('mint', { token, txHash: mintTx });

    // 3. Pay privately.
    onStep?.('pay', { token });
    const payTx = txOf(await withFee('send', 'send', (fee) => contract.methods.transfer(target, payUnits).send({ from: me, fee, wait: sdk.NO_WAIT })));
    onStep?.('pay', { token, txHash: payTx });
    return { token, deployTx, mintTx, payTx };
  }

  /**
   * Operator only, on Aztec Alpha: deploys the HLC Test Token with this account as admin, and
   * nothing else (no issue, no payment). Universal deployment, like the HLC of 14/11/2026, so the
   * address is known before sending. The address is kept on this device under its own key, so a
   * reload never deploys a second time. The operator signs in their own wallet; then the read-only
   * preflight confirms name, decimals and class before the token is recorded
   * (docs/alpha/HLC_REDEPLOY_RUNBOOK.md).
   */
  async deployHlcTestToken(
    meta: { name: string; symbol: string; decimals: number },
    onStep?: (info: { token: string; txHash?: string }) => void,
  ): Promise<{ token: string; deployTx?: string; resumed: boolean }> {
    if (AZTEC_WALLET_CONFIG.network !== 'mainnet') throw new Error('This tool is for Aztec Alpha only.');
    if (new TextEncoder().encode(meta.name).length > 31 || new TextEncoder().encode(meta.symbol).length > 31) throw new Error('Name and symbol hold at most 31 bytes.');
    await assertNewValueAllowed();
    const ctx = this.agreementContext();
    const sdk = this.sdk!;
    const me = ctx.me;
    const KEY = `hl:hlc-test-token:${me.toString().toLowerCase()}`;
    let kept = '';
    try { kept = localStorage.getItem(KEY) || ''; } catch { /* not kept */ }
    if (kept) {
      onStep?.({ token: kept });
      return { token: kept, resumed: true };
    }
    const artifact = sdk.TokenContract.artifact;
    const [{ Contract, DeployMethod }, { randomField }] = await Promise.all([import('@aztec-labs/aztec.js/contracts'), import('../random')]);
    const args = [me, meta.name, meta.symbol, meta.decimals];
    const salt = randomField();
    const expected = await sdk.getContractInstanceFromInstantiationParams(artifact, { constructorArgs: args, salt, deployer: sdk.AztecAddress.ZERO });
    const token = expected.address.toString();
    onStep?.({ token });
    const deployment = (DeployMethod as any).create(
      ctx.wallet,
      { artifact, args, postDeployCtor: (instance: any, w: any) => (Contract as any).at(instance.address, artifact, w) },
      { salt, universalDeploy: true },
    );
    const { fee, consumes } = await this.resolveFee();
    const receipt = await this.sendAndWait(() => deployment.send({ from: me, fee, wait: sdk.NO_WAIT }), `hlc-test-token-${Date.now()}`, 'deploy');
    if (!receipt) throw new Error(this.snapshot.activity[0]?.error || 'The deploy transaction failed. Nothing more was sent.');
    if (consumes) this.dropClaim(consumes);
    const deployTx = (receipt as any)?.txHash?.toString?.() ?? ((receipt as any)?.txHash ? String((receipt as any).txHash) : undefined);
    try { localStorage.setItem(KEY, token); } catch { /* not kept */ }
    onStep?.({ token, txHash: deployTx });
    return { token, deployTx, resumed: false };
  }

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
    if (c.secretIndex === SPONSOR_SECRET_INDEX) {
      // Reusable index: remember the deposit itself, not the index.
      const hashes = consumedHashes(me);
      try { localStorage.setItem(CONSUMED_HASHES_KEY(me), JSON.stringify([...hashes, c.messageHash.toLowerCase()].slice(-200))); } catch {}
      return;
    }
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
    const minForTx = await this.node
      .getCurrentMinFees()
      .then((f: any) => budgetFeeFor({ feePerL2Gas: BigInt(f.feePerL2Gas.toString()), feePerDaGas: BigInt(f.feePerDaGas.toString()) }))
      .catch(() => 0n);
    const plan = feePlan({ network: 'mainnet', hasSponsor: false, feeJuiceBalance: balance, minBalance: minForTx > 0n ? minForTx : 1n, claims }).kind;
    const state: FeeJuiceState = { balance, claims, plan, minForTx };
    this.set({ feeJuice: state });
    return state;
  }

  /** Alpha: fresh node identity + Fee Juice pins before anything moves value (fail-closed). */
  private async assertNodeStillPinned() {
    if (AZTEC_WALLET_CONFIG.network !== 'mainnet') return;
    assertNodeForValue((await this.node.getNodeInfo()) as any, 'mainnet');
  }

  /**
   * Gas limits for one interaction, from a simulation that does not enforce the fee (aztec.js 6.0.0:
   * `simulate({ includeMetadata: true })` returns `gasUsed`; apps that declare their own limits pad
   * `totalGas`, per the SDK's own note on SimulationResult). Padded by 25% plus a fixed margin.
   * Returns undefined when the simulation fails or reports no gas, so the caller keeps the defaults.
   */
  private async estimatedGasSettings(interaction: any, from: any, fee: any): Promise<any | undefined> {
    if (AZTEC_WALLET_CONFIG.network !== 'mainnet') return undefined;
    try {
      const sim = await interaction.simulate({ from, fee, includeMetadata: true, skipFeeEnforcement: true });
      return gasLimitsFromSimulation(sim?.gasUsed, 1.25);
    } catch (e) {
      console.warn('[aztec] gas estimate failed; using the default limits:', (e as Error)?.message);
      return undefined;
    }
  }

  /** Fee options for the next transaction, and the deposit it consumes (if any). */
  private async resolveFee(opts?: { estimated?: boolean }): Promise<{ fee: any; consumes?: FeeJuiceClaim }> {
    if (AZTEC_WALLET_CONFIG.network !== 'mainnet') return { fee: this.sponsoredFee };
    await this.assertNodeStillPinned();
    const state = await this.refreshFeeJuice();
    if (state.plan === 'claim') {
      const plan = feePlan({ network: 'mainnet', hasSponsor: false, feeJuiceBalance: state.balance, minBalance: state.minForTx > 0n ? state.minForTx : 1n, claims: state.claims });
      const c = (plan as { claim: FeeJuiceClaim }).claim;
      return { fee: { paymentMethod: this.claimMethod(c) }, consumes: c };
    }
    if (state.plan === 'balance') return { fee: undefined };
    // Some Fee Juice, but less than the protocol-maximum fee: a transfer with estimated gas limits
    // usually costs far less, so it is tried with the account's own balance. The node still refuses
    // it if the balance cannot cover the estimated maximum, and the error says so.
    if (opts?.estimated && state.plan === 'top-up') {
      if (state.balance > 0n) return { fee: undefined };
      const ready = state.claims.find((c) => c.ready)?.claim;
      if (ready) return { fee: { paymentMethod: this.claimMethod(ready) }, consumes: ready };
    }
    throw new Error(
      state.plan === 'wait-claim'
        ? 'Your Fee Juice is still arriving from Ethereum. Try again in a few minutes.'
        : state.plan === 'top-up'
          ? `Your Fee Juice does not cover the network fee right now (up to ${fmtAztec(state.minForTx)} AZTEC; only the gas used is charged). Add Fee Juice, then try again. Nothing was sent.`
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
    const index = nextSecretIndex(pending, [...consumedIndexes(me), SPONSOR_SECRET_INDEX]);
    if (index >= SPONSOR_SECRET_INDEX) throw new Error('Too many unclaimed Fee Juice deposits. Wait for the pending ones to arrive.');
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
  async recoverFeeJuiceClaims(l1: Required<Pick<L1Clients, 'getLogs'>> & Pick<L1Clients, 'getBlockNumber'>) {
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
    const usedHashes = new Set(consumedHashes(me));
    // The sponsor index is reused across deposits from contacts: those are filtered by message hash.
    const fresh = found.filter((c) => (c.secretIndex === SPONSOR_SECRET_INDEX ? !usedHashes.has(c.messageHash.toLowerCase()) : !used.has(c.secretIndex)));
    saveClaims(me, mergeClaims(loadClaims(me), fresh));
    const state = await this.refreshFeeJuice();
    // A deposit found for an account still waiting: finish setup as soon as it can be claimed.
    if (this.snapshot.phase === 'needs-fee-juice' && (state.plan === 'claim' || state.plan === 'wait-claim')) this.pollClaims();
    return fresh.length;
  }

  /**
   * A link a contact can open to pay this account's network fees (Fee Juice) from their own
   * Ethereum wallet: it carries this account's Aztec address and the hash of the reserved
   * claim secret, nothing secret. The deposit is found again with recoverFeeJuiceClaims, on
   * any device, because the secret is derived from this account's wallet signature.
   */
  async feeRequestLink(origin = typeof window !== 'undefined' ? window.location.origin : 'https://ledgerchat.org'): Promise<string> {
    if (AZTEC_WALLET_CONFIG.network !== 'mainnet') throw new Error('Fee Juice is only needed on Aztec Alpha.');
    if (!this.me || !this.sdk) throw new Error('Open your private wallet first.');
    const secretHash = (await this.sdk.computeSecretHash(new this.sdk.Fr(this.claimSecrets[SPONSOR_SECRET_INDEX]))).toString();
    const u = new URL('/fees', origin);
    u.searchParams.set('to', this.me.toString());
    u.searchParams.set('h', secretHash);
    return u.toString();
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
            await this.refreshQuietly();
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
    if (!this.networkTag) throw new Error('Open your private wallet first.');
    const network = this.networkTag;
    const msg = Fr.fromHexString(await crypto.messageField(bindingStatement(address, signerInboxId, recipientInboxId, network)));
    const sig = await schnorr.constructSignature(msg, this.signingKey);
    const proof: AddressProof = {
      scheme: BINDING_SCHEME_V2,
      signingPublicKey: { x: pk.x.toString(), y: pk.y.toString() },
      salt: this.salt.toString(),
      publicKeys: this.manager.getInstance().publicKeys.toString(),
      signerInboxId,
      recipientInboxId,
      network,
      signature: sig.toString(),
    };
    const check = await verifyAddressProof(
      { type: 'hl.aztec_address', version: 2, address, proof },
      { senderInboxId: signerInboxId, selfInboxId: recipientInboxId, network, requireNetwork: true },
      crypto,
    );
    if (!check.ok) throw new Error(`Could not prove control of your Aztec address: ${check.reason}.`);
    return proof;
  }

  /**
   * The network context for a G7 check before value moves (peer-binding.ts valueBindingContext):
   * this wallet's network tag, and, on Alpha, proofs that name it.
   */
  bindingContext(): BindingNetworkContext {
    return valueBindingContext(this.networkTag, AZTEC_WALLET_CONFIG.network);
  }

  /* ---------------------------------------------------------------- portal */

  /**
   * Receiver addresses 0..count-1 (lib/portal/receivers.ts). Only public parts are returned; the
   * secrets stay inside the wallet. `address` is null when this build has no portal.
   */
  async portalReceivers(count: number): Promise<Array<{ index: number; secretHash: string; rescueSigner: string; address: string | null }>> {
    const material = await this.portalMaterial(count);
    const [{ PORTAL_CONFIG }, { predictReceiver }, { keccak256 }] = await Promise.all([
      import('../../portal/config'),
      import('../../portal/receivers'),
      import('viem'),
    ]);
    return material.map((m) => ({
      index: m.index,
      secretHash: m.secretHash,
      rescueSigner: m.rescueSigner,
      address: PORTAL_CONFIG
        ? predictReceiver(PORTAL_CONFIG.factory, PORTAL_CONFIG.implementation, m.secretHash, m.rescueSigner, { keccak256: (b) => keccak256(b) })
        : null,
    }));
  }

  private async portalMaterial(count: number) {
    if (this.snapshot.phase !== 'ready' || !this.portalMaster || !this.sdk) throw new Error('Open your private wallet first.');
    const [{ deriveReceiver, MAX_RECEIVERS }, { privateKeyToAddress }, { keccak256 }] = await Promise.all([
      import('../../portal/receivers'),
      import('viem/accounts'),
      import('viem'),
    ]);
    const n = Math.max(1, Math.min(MAX_RECEIVERS, Math.floor(count)));
    const sdk = this.sdk;
    const crypto = {
      secretHash: async (secret: bigint) => (await sdk.computeSecretHash(new sdk.Fr(secret))).toString(),
      addressOf: (k: bigint) => privateKeyToAddress(`0x${k.toString(16).padStart(64, '0')}` as `0x${string}`),
      keccak256: (b: Uint8Array) => keccak256(b),
    };
    const out = [];
    for (let i = 0; i < n; i++) out.push(await deriveReceiver(this.portalMaster, i, crypto));
    return out;
  }

  /** The compiled PortalToken artifact, served by the app (NEXT_PUBLIC_HL_PORTAL_TOKEN_ARTIFACT). */
  private async portalArtifact() {
    if (this.portalArtifactCache) return this.portalArtifactCache;
    const { PORTAL_CONFIG } = await import('../../portal/config');
    if (!PORTAL_CONFIG) throw new Error('The portal is not deployed for this network.');
    const res = await fetch(PORTAL_CONFIG.artifactUrl, { cache: 'force-cache' });
    if (!res.ok) throw new Error('The portal contract description could not be loaded.');
    const { loadContractArtifact } = await import('@aztec-labs/aztec.js/abi');
    this.portalArtifactCache = loadContractArtifact(await res.json());
    return this.portalArtifactCache;
  }

  /**
   * Proves and sends one call to a PortalToken instance on this device, fee paid as for any transaction.
   *
   * Claims and withdrawals are exits: they move the person's own money and stay available in
   * exits-only mode (lib/aztec/value-mode.ts), so an incident pause can never trap funds.
   *
   * Before anything is proved, the instance must be one of this build's configured PortalTokens and
   * must name this build's portal as its L1 counterpart (portal_address, read on this device). A
   * PortalToken wired to any other L1 contract would burn a withdrawal into a message nobody honest
   * can execute, so it is refused here rather than discovered on Ethereum.
   */
  private async runPortal(l2Address: string, build: (contract: any) => any): Promise<{ txHash: string }> {
    if (this.snapshot.phase !== 'ready' || !this.sdk || !this.wallet) throw new Error('Open your private wallet first.');
    const sdk = this.sdk;
    const { PORTAL_CONFIG } = await import('../../portal/config');
    if (!PORTAL_CONFIG) throw new Error('The portal is not deployed for this network.');
    if (!PORTAL_CONFIG.assets.some((a) => a.l2 === l2Address.toLowerCase())) throw new Error('This token is not one of the portal tokens of this build.');
    const artifact = await this.portalArtifact();
    const { Contract } = await import('@aztec-labs/aztec.js/contracts');
    const addr = sdk.AztecAddress.fromStringUnsafe(l2Address);
    const instance = await this.node.getContract(addr);
    if (!instance) throw new Error('The portal token is not deployed on this network.');
    // registerContract refuses an artifact whose class id is not the instance's.
    await this.wallet.registerContract(instance, artifact);
    const contract = (Contract as any).at(addr, artifact, this.wallet);
    const linked = await contract.methods.portal_address().simulate({ from: this.me });
    const raw = linked?.inner ?? linked;
    const linkedHex = '0x' + BigInt(typeof raw === 'object' && raw !== null && 'toString' in raw ? raw.toString() : raw).toString(16).padStart(40, '0');
    if (linkedHex.toLowerCase() !== PORTAL_CONFIG.portal) throw new Error('This portal token is not linked to this build\'s portal. Nothing was sent.');
    const { fee, consumes } = await this.resolveFee({ estimated: true });
    const interaction = build(contract);
    const gasSettings = await this.estimatedGasSettings(interaction, this.me, fee);
    this.inflight++;
    this.set({});
    try {
      const sent = await interaction.send({ from: this.me, fee: gasSettings ? { ...(fee ?? {}), gasSettings } : fee, wait: sdk.NO_WAIT });
      await sdk.waitForTx(this.node, sent.txHash, { timeout: 600, interval: 2 });
      if (consumes) this.dropClaim(consumes);
      return { txHash: sent.txHash.toString() };
    } finally {
      this.inflight--;
      this.set({});
    }
  }

  /**
   * Claims one portal deposit made to one of this account's receivers into its private balance.
   * The message nullifier makes a second claim of the same deposit fail.
   */
  async claimPortalDeposit(d: { l2Token: string; amount: bigint; index: bigint; secretHash: string }, receiverCount: number) {
    const material = await this.portalMaterial(receiverCount);
    const r = material.find((m) => m.secretHash.toLowerCase() === d.secretHash.toLowerCase());
    if (!r) throw new Error('This deposit was not made to one of your receiver addresses.');
    const sdk = this.sdk!;
    return this.runPortal(d.l2Token, (c) => c.methods.claim_private(this.me, d.amount, new sdk.Fr(r.secret), new sdk.Fr(d.index)));
  }

  /**
   * Starts a withdrawal to Ethereum: burns the private balance and sends the L2->L1 message. That
   * message (recipient, amount) is PUBLIC and attached to this transaction; with the fee paid from
   * this account it links the account to the recipient (docs/PORTAL.md §3, until private fees).
   */
  async portalWithdraw(l2Token: string, recipient: string, amount: bigint, callerOnL1?: string) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) throw new Error('Enter an Ethereum address.');
    if (amount <= 0n) throw new Error('Enter an amount.');
    const sdk = this.sdk!;
    const caller = callerOnL1 && /^0x[0-9a-fA-F]{40}$/.test(callerOnL1) ? callerOnL1 : '0x' + '0'.repeat(40);
    // EthAddress is the Noir struct { inner: Field }; the ABI encoder takes it as such.
    const eth = (a: string) => ({ inner: new sdk.Fr(BigInt(a)) });
    return this.runPortal(l2Token, (c) => c.methods.withdraw_private(this.me, eth(recipient), amount, eth(caller), new sdk.Fr(0)));
  }

  /* -------------------------------------------------------------- passkeys */

  /**
   * Enrols a passkey for the open account (lib/aztec/wallet/passkey.ts). The wallet asks for the
   * account signature again (wallets sign it deterministically) and the result must derive exactly
   * the keys of the open account: a wallet that signs differently each time is refused here,
   * never wrapped into a passkey that would open a different, empty account.
   */
  async enrollPasskey(signTypedData: SignTypedData, label: string): Promise<{ backedUp: boolean }> {
    if (this.snapshot.phase !== 'ready' || !this.evmAddress || !this.signingKey || !this.salt) throw new Error('Open your private wallet first.');
    const [pk, store, sdk] = await Promise.all([import('./passkey'), import('./passkey-store'), Promise.resolve(this.sdk!)]);
    const api = pk.browserWebAuthn();
    if (!api) throw new pk.PasskeyError('UNSUPPORTED', 'This browser cannot use passkeys.');
    const root = await signTypedData(walletTypedData());
    const keys = await deriveAccountKeys(root, sdk.Fr.MODULUS, sdk.Fq.MODULUS);
    if (new sdk.Fr(keys.salt).toString() !== this.salt.toString() || new sdk.Fq(keys.signingKey).toString() !== this.signingKey.toString()) {
      throw new pk.PasskeyError('MISMATCH', 'Your wallet gave a different signature than when the private wallet was opened, so a passkey would open a different account. This wallet cannot be used with passkeys.');
    }
    const network = AZTEC_WALLET_CONFIG.network as 'testnet' | 'mainnet';
    const existing = await store.allRecords(this.evmAddress, network);
    const record = await pk.enrolPasskey({ evm: this.evmAddress, network, rootHex: root, label, existing, rpId: pk.passkeyRpId(location.hostname), api });
    return store.saveRecord(record);
  }

  /**
   * Opens the wallet with an enrolled passkey instead of an Ethereum signature: the passkey yields
   * the same account root, so the account, its address and its notes are the same.
   */
  async connectWithPasskey(evmAddress: string): Promise<void> {
    const evm = evmAddress.toLowerCase();
    const [pk, store] = await Promise.all([import('./passkey'), import('./passkey-store')]);
    const api = pk.browserWebAuthn();
    if (!api) throw new pk.PasskeyError('UNSUPPORTED', 'This browser cannot use passkeys.');
    const network = AZTEC_WALLET_CONFIG.network as 'testnet' | 'mainnet';
    const records = await store.allRecords(evm, network);
    const { rootHex } = await pk.unlockWithPasskey({ evm, network, records, rpId: pk.passkeyRpId(location.hostname), api });
    // The root must be this account's own signature before any key is derived from it.
    await pk.assertRootOwner(rootHex, evm, walletTypedData());
    let used = false;
    return this.connect(evm, async () => {
      // One use: the root is handed to the derivation once, never kept.
      if (used) throw new Error('Open the wallet with your passkey again.');
      used = true;
      return rootHex;
    });
  }

  /**
   * Registers the configured tokens that are not registered yet. On Alpha each one must pass the G3
   * check first (trusted Token class with the exact transfer_in_private); one that fails is never
   * used. Returns the tokens left out, with why, instead of refusing the whole wallet.
   */
  private async ensureTokens(): Promise<string[]> {
    const sdk = this.sdk!;
    const issues: string[] = [];
    const tokenCheck = AZTEC_WALLET_CONFIG.network === 'mainnet' ? await import('../token-check') : null;
    for (const t of AZTEC_WALLET_CONFIG.tokens) {
      if (this.tokens.has(t.key)) continue;
      try {
        const addr = sdk.AztecAddress.fromStringUnsafe(t.address);
        if (tokenCheck) {
          const c = await tokenCheck.checkTokenInstance(this.node, t.address, [sdk.TokenContract.artifact]);
          if (!c.ok) { issues.push(`${t.symbol}: ${c.reason}`); continue; }
        }
        const instance = await this.node.getContract(addr);
        if (!instance) { issues.push(`${t.symbol}: not deployed on ${networkLabel()}`); continue; }
        await this.wallet.registerContract(instance, sdk.TokenContract.artifact);
        this.tokens.set(t.key, sdk.TokenContract.at(addr, this.wallet));
      } catch (err) {
        console.warn(`[private wallet] ${t.symbol} not loaded`, err);
        issues.push(`${t.symbol}: ${humanError(err)}`);
      }
    }
    return issues;
  }

  /* --------------------------------------------------------------- reading */

  async refresh(): Promise<void> {
    if (!this.wallet || !this.me) return;
    // Contacts pinned since the last refresh become known senders, so their payments are found.
    await this.registerChatPeers().catch(() => 0);
    // A token left out at open time is tried again on every sync.
    const tokenIssues = this.tokens.size < AZTEC_WALLET_CONFIG.tokens.length ? await this.ensureTokens() : [];
    const balances: TokenBalance[] = [];
    for (const t of AZTEC_WALLET_CONFIG.tokens) {
      const c = this.tokens.get(t.key);
      if (!c) continue;
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
    this.set({ balances, activity: await this.loadActivity(), error: tokenIssues.length ? tokenIssuesMessage(tokenIssues) : undefined });
  }

  private async loadActivity(): Promise<Activity[]> {
    const me = this.me.toString();
    // An entry left "proving" with no transaction hash while nothing is in flight never reached the
    // network (the tab closed, or an earlier build did not record a fee failure): say so once.
    if (this.inflight === 0) {
      for (const a of loadLocalActivity(me)) {
        if (a.status === 'proving' && !a.txHash && Date.now() - (a.createdAt ?? 0) > 15 * 60_000) {
          upsertActivity(me, { ...a, status: 'failed', error: 'Not sent: the proof did not finish. Nothing left this device.' });
        }
      }
    }
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
  async shield(key: TokenKey, amount: string) {
    await assertNewValueAllowed();
    const units = parseUnits(amount, tokenConfig(key).decimals);
    return this.run('shield', key, units, undefined, (c) => c.methods.transfer_to_private(this.me, units));
  }

  /** Moves tokens from private notes back to the public balance of an Aztec address (yours by default). */
  async unshield(key: TokenKey, amount: string, to?: string) {
    const units = parseUnits(amount, tokenConfig(key).decimals);
    const target = to ? await this.validAddress(to) : this.me;
    // To your own public balance is an exit; to anyone else it is a payment.
    if (!(target.equals?.(this.me) ?? target === this.me)) await assertNewValueAllowed();
    return this.run('unshield', key, units, to?.toLowerCase(), (c) => c.methods.transfer_to_public(this.me, target, units, 0));
  }

  /** Sends a private payment. Only the recipient can see the amount and the sender. */
  async send(key: TokenKey, amount: string, to: string) {
    await assertNewValueAllowed();
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

  /** Tokens this account may issue on Alpha: it is the admin recorded in deployments/aztec-mainnet.json. */
  issuableTokens(): TokenKey[] {
    if (AZTEC_WALLET_CONFIG.network !== 'mainnet' || !this.me || this.snapshot.phase !== 'ready') return [];
    const me = String(this.me.toString()).toLowerCase();
    return AZTEC_WALLET_CONFIG.tokens.filter((t) => recordedAdmin(t.address) === me).map((t) => t.key);
  }

  /**
   * Issues `amount` of a token into this account's PRIVATE balance (Alpha, admin only, capped).
   * The token contract checks the minter again; this only keeps the button from being offered to others.
   */
  async issue(key: TokenKey, amount: string) {
    await assertNewValueAllowed();
    if (!this.issuableTokens().includes(key)) throw new Error('Only the account that issues this token can mint it.');
    const { decimals } = tokenConfig(key);
    const units = parseUnits(amount, decimals);
    if (units <= 0n) throw new Error('Enter an amount to issue.');
    if (units > issueCap(decimals)) throw new Error('That is more than one issue may create. Use a smaller amount.');
    const me = this.me;
    return this.run('issue', key, units, undefined, (c) => {
      // Standard Token: mint_to_private(to, amount); older releases took (from, to, amount).
      const fn = c.artifact?.functions?.find((f: any) => f.name === 'mint_to_private');
      return fn?.parameters?.length === 3 ? c.methods.mint_to_private(me, me, units) : c.methods.mint_to_private(me, units);
    });
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
  /**
   * Makes every chat contact whose Aztec address is pinned in a DM (lib/aztec/peer-binding.ts,
   * keys `hl.aztec_peer.<inbox>`) a known sender of this wallet, so a private payment from them
   * shows up by itself: Aztec finds incoming notes only from senders the wallet knows. Before,
   * the receiver had to paste the sender's address under Receive. Registering an address only
   * affects which incoming notes are looked for; it trusts nothing.
   */
  private registeredPeers = new Set<string>();
  async registerChatPeers(): Promise<number> {
    if (!this.wallet || !this.sdk || !this.me) return 0;
    let added = 0;
    const keys: string[] = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith('hl.aztec_peer.')) keys.push(k); } } catch { return 0; }
    for (const k of keys) {
      const addr = (localStorage.getItem(k) || '').trim();
      if (!isAztecAddress(addr) || addr.toLowerCase() === this.me.toString().toLowerCase() || this.registeredPeers.has(addr.toLowerCase())) continue;
      try {
        await this.wallet.registerSender(this.sdk.AztecAddress.fromStringUnsafe(addr), `chat-${addr.slice(2, 10)}`);
        this.registeredPeers.add(addr.toLowerCase());
        added++;
      } catch { /* the next refresh tries again */ }
    }
    return added;
  }

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
    if (!contract) throw new Error(`${tokenConfig(key).symbol} is not available in your wallet right now. Tap Sync, then try again. Nothing was sent.`);
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
    // A fee that cannot be paid (no Fee Juice, a claim still arriving) stops here, before any proof:
    // the entry must say failed, or it stays "Proving on this device" forever (14 Nov 2026).
    let fee: any;
    let consumes: any;
    try {
      ({ fee, consumes } = await this.resolveFee({ estimated: true }));
    } catch (err: any) {
      upsertActivity(this.me.toString(), { id, kind, status: 'failed', error: humanError(err), createdAt: Date.now() });
      this.set({ activity: await this.loadActivity().catch(() => this.snapshot.activity) });
      reportPayment('failed', { kind, network: AZTEC_WALLET_CONFIG.network, reason: 'fee' });
      throw err;
    }
    // Gas limits from a simulation, so the network asks the fee payer to hold the fee this
    // transfer can cost rather than the protocol's maximum (README question 6). Any failure keeps
    // the previous behaviour: the wallet's own per-transaction limits.
    const interaction = build(contract);
    const gasSettings = await this.estimatedGasSettings(interaction, from ?? this.me, fee);
    const sendFee = gasSettings ? { ...(fee ?? {}), gasSettings } : fee;
    const receipt = await this.sendAndWait(
      () => interaction.send({ from: from ?? this.me, fee: sendFee, wait: this.sdk!.NO_WAIT }),
      id,
      kind,
    );
    if (receipt && consumes) this.dropClaim(consumes);
    // Confirmed means confirmed: a failed balance read afterwards must not read as a failed payment.
    await this.refreshQuietly();
    if (!receipt) throw new Error(this.snapshot.activity.find((a) => a.id === id)?.error ?? 'The transaction failed.');
    return receipt;
  }

  /** Proves and sends on this device, then waits for the network to include the transaction. */
  /** The error of the last failed send (sendAndWait records it and returns null). */
  private lastSendError: unknown = null;

  /**
   * A transaction failed because a Fee Juice deposit it tried to claim was already claimed on Aztec
   * ("No non-nullified L1 to L2 message found for message hash 0x…"): that deposit is in the balance
   * already, so it is forgotten here and the next transaction pays from the balance. Without this, a
   * deposit claimed by a path that did not drop it (seen on Alpha, 15 Nov 2026) made every
   * later transaction fail the same way. Returns true when a deposit was dropped.
   */
  private healConsumedClaim(err: unknown): boolean {
    const h = consumedMessageHash(err);
    if (h === null || !this.me) return false;
    const c = loadClaims(this.me.toString()).find((x) => sameMessageHash(x.messageHash, h));
    if (!c) return false;
    this.dropClaim(c);
    return true;
  }

  private async sendAndWait(sendFn: () => Promise<any>, id: string, kind: ActivityKind) {
    const me = this.me.toString();
    this.lastSendError = null;
    this.inflight++;
    this.set({});
    let txHash: string | undefined;
    const started = Date.now();
    const net = AZTEC_WALLET_CONFIG.network;
    reportPayment('attempted', { kind, network: net });
    try {
      const sent = await sendFn();
      txHash = sent.txHash?.toString?.() ?? String(sent.txHash);
      reportPayment('sent', { kind, network: net, ms: Date.now() - started });
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
      reportPayment('mined', { kind, network: net, ms: Date.now() - started });
      return receipt;
    } catch (err: any) {
      if (txHash && isConfirmationTimeout(err)) {
        reportPayment('unconfirmed', { kind, network: net, ms: Date.now() - started });
        // Sent but not confirmed in time: it may still be included. Never shown as failed, so nobody sends it twice.
        upsertActivity(me, { id, kind, txHash, status: 'pending', error: UNCONFIRMED_MESSAGE, createdAt: Date.now() });
        this.set({ error: UNCONFIRMED_MESSAGE });
        throw new Error(UNCONFIRMED_MESSAGE);
      }
      upsertActivity(me, { id, kind, status: 'failed', error: humanError(err), createdAt: Date.now() });
      reportPayment('failed', { kind, network: net, reason: paymentReason(err), ms: Date.now() - started });
      this.lastSendError = err;
      this.healConsumedClaim(err);
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
    // Closes the stores too: sign-out then deletes them, which a locked store would refuse.
    await this.teardown();
    this.faucetAddress = null;
    this.evmAddress = null;
    this.networkTag = undefined;
    this.portalMaster = null;
    this.set({ phase: 'idle', aztecAddress: undefined, balances: [], activity: [], step: undefined, error: undefined, feeJuice: undefined });
  }
}

const CONSUMED_KEY = (me: string) => `hl.aztec.feejuice.consumed.${me.toLowerCase()}`;
const CONSUMED_HASHES_KEY = (me: string) => `hl.aztec.feejuice.consumed-msgs.${me.toLowerCase()}`;

function consumedHashes(me: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CONSUMED_HASHES_KEY(me)) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

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

/** Shown when a transaction was sent but not confirmed in time; it may still be included. */
export const UNCONFIRMED_MESSAGE =
  'Sent, but not confirmed yet after 10 minutes. It may still go through: check your activity and balance before sending again.';

/** waitForTx gave up waiting; the transaction itself was handed to the network. */
export function isConfirmationTimeout(err: any): boolean {
  return /timeout|timed out|took too long/i.test(String(err?.name ?? '') + ' ' + String(err?.message ?? err ?? ''));
}

/** Fee Juice base units (18 decimals) as whole AZTEC, rounded up: "21". */
export function fmtAztec(units: bigint): string {
  const one = 10n ** 18n;
  return ((units + one - 1n) / one).toString();
}

/** Said once the wallet is open but a token could not be loaded. */
export function tokenIssuesMessage(issues: string[]): string {
  return `Your wallet is open, but ${issues.join('; ')}. Payments in that token are off until it loads: tap Sync to try again.`;
}

/** Step and raw error, for "Copy details" (never keys: errors of the SDK and the node carry none). */
export function errorDetailFor(step: string | undefined, err: any): string {
  // Safari stacks carry no message ("deployAccount@…:1660:28" only): keep both.
  const message = `${err?.name ?? 'Error'}: ${err?.message ?? String(err)}`;
  const raw = err?.stack && !String(err.stack).includes(String(err?.message ?? '')) ? `${message}\n${err.stack}` : String(err?.stack || message);
  const causes = Array.isArray(err?.errors) ? ` | causes: ${err.errors.map((e: any) => String(e?.message ?? e)).join(' | ')}` : '';
  return `Ledger Chat private wallet · ${AZTEC_WALLET_CONFIG.network} · step: ${step ?? 'unknown'} · ${new Date().toISOString()}\n${raw}${causes}`.slice(0, 2000);
}

export function humanError(err: any): string {
  // Several node requests failing together (the PXE's allToCompletion: "N of M concurrent operations
  // failed"): explain the first reason that is not just the network, else the network failure.
  if (Array.isArray(err?.errors) && err.errors.length) {
    const reasons: unknown[] = err.errors;
    return humanError(reasons.find((r) => !isTransientNodeError(r)) ?? reasons[0]);
  }
  const msg = String(err?.shortMessage || err?.message || err || 'Unknown error');
  if (msg === HANDED_OFF_MESSAGE || msg === BUSY_ELSEWHERE_MESSAGE || msg === PAUSED_MESSAGE || msg === IDLE_CLOSED_MESSAGE) return msg;
  if (/user (rejected|denied)|rejected the request|denied message signature/i.test(msg)) return 'You declined the signature in your wallet.';
  if (msg === EXITS_ONLY_MESSAGE || msg === VALUE_MODE_UNCONFIRMED_MESSAGE || msg === UNCONFIRMED_MESSAGE) return msg;
  // Encrypted store (lib/aztec/wallet/store.ts): the wallet did not open; nothing was read or sent.
  // Each store holds an origin-wide lock on its OPFS pool while open: another tab or window has this wallet open.
  if (/SqlitePoolBusyError|is already in use by another store instance/i.test(msg)) return 'Your private wallet is already open in another Ledger Chat tab or window. Close it there, then open the wallet here again. Nothing was sent.';
  if (/decrypt_failed|cannot decode page 1/i.test(msg)) return "This browser's private wallet data could not be decrypted with this wallet's key. Nothing was sent. Remove private wallet data in Settings, then open the wallet again.";
  if (/\[ENCRYPTED STORE ERROR\]/.test(msg)) return msg.replace(/^.*\[ENCRYPTED STORE ERROR\]\s*/, '').replace(/^Failed to open encrypted stores:\s*/, 'The encrypted wallet storage could not be opened: ');
  // Fee Juice first: "insufficient fee payer balance" would otherwise read as a token balance problem.
  if (/fee.?juice|insufficient fee payer balance|not enough balance for fee/i.test(msg) && !/Bridge AZTEC|still arriving/.test(msg)) return 'Not enough Fee Juice to pay the network fee. Bridge more AZTEC from your Ethereum wallet.';
  if (/existing nullifier|duplicate nullifier|nullifier.*already/i.test(msg)) return 'Already done: this was settled or sent before. Nothing new was sent.';
  if (/out of memory|Array buffer allocation failed|memory access out of bounds|RangeError: .*memory/i.test(msg)) return 'This device ran out of memory while making the proof. Nothing was sent. Try again on a computer.';
  if (/Assertion failed:\s*(PrivateEscrow|PaymentStream)?:?\s*(.+)/i.test(msg)) return `The contract refused this: ${msg.match(/Assertion failed:\s*(?:PrivateEscrow|PaymentStream)?:?\s*([^'"\n]{1,140})/i)?.[1] ?? 'its conditions are not met'}. Nothing was sent.`;
  if (/circuit execution failed|proving failed|failed to prove|witness generation/i.test(msg)) return 'The proof could not be made on this device. Nothing was sent. Try again; if it repeats, reopen the private wallet.';
  if (/tx dropped|invalid tx|transaction .*rejected|rejected by (the )?node|reverted/i.test(msg)) return 'The Aztec node rejected the transaction. Nothing changed. Try again in a minute.';
  if (/Balance too low|not enough|insufficient/i.test(msg)) return 'Your balance is too low for this amount.';
  if (/timeout/i.test(msg)) return 'The network took too long to confirm. It may still go through; check again in a minute.';
  // A page loaded before a deploy asks for code chunks of the old build, which no longer exist.
  if (/dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk [\w-]+ failed|error loading dynamically imported/i.test(msg)) {
    return 'Ledger Chat was updated while this page was open. Reload the page, then open the wallet again. Nothing was sent.';
  }
  // Safari says "Load failed", Firefox "NetworkError", Chrome "Failed to fetch"; the relay (node-fetch.ts) was tried too.
  if (/Failed to fetch|fetch failed|Load failed|network connection was lost|NetworkError|Error fetching from host|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|Too Many Requests|Service Unavailable|Bad Gateway/i.test(msg)) {
    // Name the service when the error does; a browser extension or firewall blocking one host looks the same as no connection.
    const host = msg.match(/https?:\/\/([a-z0-9.-]+)/i)?.[1];
    return `Could not reach ${host ?? networkLabel()}. Check your connection, and that no extension or firewall blocks it, then try again. (${msg.slice(0, 120)})`;
  }
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
