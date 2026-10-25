/**
 * lib/aztec/wallet/client.ts
 *
 * The private payments wallet, running entirely in the browser:
 *
 *   - an Aztec PXE (Private eXecution Environment) with its own storage in the
 *     browser, created by @aztec-labs/wallets;
 *   - a Schnorr account whose keys are derived from a signature by the user's
 *     Ethereum wallet (see keys.ts), deployed with sponsored fees;
 *   - the three test tokens deployed by scripts/aztec/setup-testnet.mjs.
 *
 * Every balance shown comes from the token contracts through the PXE. Every
 * action is a real transaction, proven on the device and sent to the Aztec
 * test network. Nothing is simulated, and the server is never involved.
 *
 * The Aztec SDK is loaded with dynamic imports so it never reaches the server
 * bundle or the first page load.
 */

import { AZTEC_WALLET_CONFIG, FAUCET_AMOUNT, assertTestNetwork, isWalletConfigured, tokenConfig, type TokenKey } from './config';
import { deriveAccountKeys, WALLET_TYPED_DATA } from './keys';
import { parseUnits } from './amounts';
import { loadLocalActivity, mergeActivity, upsertActivity, type Activity, type ActivityKind } from './history';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type WalletPhase = 'idle' | 'signing' | 'starting' | 'deploying' | 'ready' | 'error';

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
}

export type SignTypedData = (typedData: typeof WALLET_TYPED_DATA) => Promise<string>;

type Listener = (s: WalletSnapshot) => void;

interface Sdk {
  Fr: any;
  Fq: any;
  AztecAddress: any;
  createAztecNodeClient: (url: string, opts?: any) => any;
  waitForTx: (node: any, txHash: any, opts?: any) => Promise<any>;
  getContractInstanceFromInstantiationParams: (artifact: any, opts: any) => Promise<any>;
  SponsoredFeePaymentMethod: any;
  NO_FROM: any;
  NO_WAIT: any;
  SponsoredFPCContract: any;
  TokenContract: any;
  EmbeddedWallet: any;
}

async function loadSdk(): Promise<Sdk> {
  const [fields, addresses, node, contracts, fee, account, fpc, token, wallets] = await Promise.all([
    import('@aztec-labs/aztec.js/fields'),
    import('@aztec-labs/aztec.js/addresses'),
    import('@aztec-labs/aztec.js/node'),
    import('@aztec-labs/aztec.js/contracts'),
    import('@aztec-labs/aztec.js/fee'),
    import('@aztec-labs/aztec.js/account'),
    import('@aztec-labs/noir-contracts.js/SponsoredFPC'),
    import('@aztec-labs/noir-contracts.js/Token'),
    import('@aztec-labs/wallets/embedded'),
  ]);
  return {
    Fr: (fields as any).Fr,
    Fq: (fields as any).Fq,
    AztecAddress: (addresses as any).AztecAddress,
    createAztecNodeClient: (node as any).createAztecNodeClient,
    waitForTx: (node as any).waitForTx,
    getContractInstanceFromInstantiationParams: (contracts as any).getContractInstanceFromInstantiationParams,
    SponsoredFeePaymentMethod: (fee as any).SponsoredFeePaymentMethod,
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
  params.set('network', 'testnet');
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
      const signature = await signTypedData(WALLET_TYPED_DATA);

      this.set({ phase: 'starting', step: 'Starting the private node in your browser' });
      const sdk = (this.sdk ??= await loadSdk());
      const { Fr, Fq, AztecAddress } = sdk;

      this.node = sdk.createAztecNodeClient(AZTEC_WALLET_CONFIG.nodeUrl, RPC_OPTIONS);
      const info = await this.node.getNodeInfo();
      assertTestNetwork(Number(info.l1ChainId));

      if (this.wallet) {
        await this.wallet.stop().catch(() => {});
        this.wallet = null;
      }
      this.wallet = await sdk.EmbeddedWallet.create(AZTEC_WALLET_CONFIG.nodeUrl, { nodeClientOptions: RPC_OPTIONS });

      const fpc = await sdk.getContractInstanceFromInstantiationParams(sdk.SponsoredFPCContract.artifact, { salt: new Fr(0) });
      if (fpc.address.toString().toLowerCase() !== AZTEC_WALLET_CONFIG.sponsoredFpc.toLowerCase()) {
        throw new Error('The Aztec libraries in this build do not match the network the wallet was set up for.');
      }
      await this.wallet.registerContract(fpc, sdk.SponsoredFPCContract.artifact);
      this.fee = { paymentMethod: new sdk.SponsoredFeePaymentMethod(fpc.address) };

      const keys = await deriveAccountKeys(signature, Fr.MODULUS, Fq.MODULUS);
      const manager = await this.wallet.createSchnorrAccount(
        new Fr(keys.secret),
        new Fr(keys.salt),
        new Fq(keys.signingKey),
        `ledger-${evm.slice(2, 10)}`,
      );
      this.me = manager.address;
      this.set({ aztecAddress: this.me.toString() });

      this.set({ step: 'Loading the test tokens' });
      for (const t of AZTEC_WALLET_CONFIG.tokens) {
        const addr = AztecAddress.fromStringUnsafe(t.address);
        const instance = await this.node.getContract(addr);
        if (!instance) throw new Error(`${t.symbol} is not deployed on this network. Run the setup script again.`);
        await this.wallet.registerContract(instance, sdk.TokenContract.artifact);
        this.tokens.set(t.key, sdk.TokenContract.at(addr, this.wallet));
      }

      const meta = await this.wallet.getContractMetadata(this.me);
      if (String(meta?.initializationStatus) !== 'INITIALIZED') {
        this.set({ phase: 'deploying', step: 'Creating your private account on the Aztec test network. The first proof can take a minute.' });
        const id = `deploy-${this.me.toString()}`;
        upsertActivity(this.me.toString(), { id, kind: 'deploy', status: 'proving', createdAt: Date.now() });
        const deploy = await manager.getDeployMethod();
        const receipt = await this.sendAndWait(() => deploy.send({ from: sdk.NO_FROM, fee: this.fee, wait: sdk.NO_WAIT }), id, 'deploy');
        if (!receipt) {
          const detail = this.snapshot.activity.find((a) => a.id === id)?.error;
          throw new Error(detail ? `Your private account could not be created: ${detail}` : 'Your private account could not be created. Please try again.');
        }
      }

      this.set({ phase: 'ready', step: undefined });
      await this.refresh();
    } catch (err: any) {
      this.set({ phase: 'error', step: undefined, error: humanError(err) });
      throw err;
    }
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
    const receipt = await this.sendAndWait(
      () => build(contract).send({ from: from ?? this.me, fee: this.fee, wait: this.sdk!.NO_WAIT }),
      id,
      kind,
    );
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

  async disconnect() {
    await this.wallet?.stop?.().catch(() => {});
    this.wallet = null;
    this.me = null;
    this.tokens.clear();
    this.faucetAddress = null;
    this.evmAddress = null;
    this.set({ phase: 'idle', aztecAddress: undefined, balances: [], activity: [], step: undefined, error: undefined });
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
  if (/Balance too low|not enough|insufficient/i.test(msg)) return 'Your balance is too low for this amount.';
  if (/timeout/i.test(msg)) return 'The network took too long to confirm. It may still go through; check again in a minute.';
  if (/Failed to fetch|NetworkError|ECONNREFUSED/i.test(msg)) return 'Could not reach the Aztec test network. Check your connection and try again.';
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
