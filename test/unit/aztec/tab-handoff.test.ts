/**
 * One open private wallet per browser profile, handed between tabs like "Use here" in WhatsApp Web,
 * and a failed open never leaves the stores locked. lib/aztec/wallet/tab-handoff.ts, client.ts.
 */
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createTabHandoff, isStoreBusyError, type ChannelLike } from '@/lib/aztec/wallet/tab-handoff';

/** An in-memory BroadcastChannel: a message reaches every other member, asynchronously. */
function bus() {
  const members: Array<(d: unknown) => void> = [];
  return (): ChannelLike => {
    let mine: ((ev: { data: unknown }) => void) | null = null;
    const deliver = (d: unknown) => mine?.({ data: structuredClone(d) });
    members.push(deliver);
    return {
      postMessage: (d) => {
        for (const m of members) if (m !== deliver) setTimeout(() => m(d), 0);
      },
      addEventListener: (_t, fn) => {
        mine = fn;
      },
    };
  };
}

describe('tab handoff', () => {
  it('the holding tab closes its wallet when it is idle, and answers released', async () => {
    const join = bus();
    let open = true;
    const release = vi.fn(async () => {
      open = false;
    });
    createTabHandoff({ channel: join(), tabId: 'a', holds: () => open, canRelease: () => true, release });
    const b = createTabHandoff({ channel: join(), tabId: 'b', holds: () => false, canRelease: () => true, release: vi.fn() });
    await expect(b.requestRelease(500)).resolves.toBe('released');
    expect(release).toHaveBeenCalledTimes(1);
    expect(open).toBe(false);
  });

  it('a tab in the middle of a payment keeps the wallet and answers busy', async () => {
    const join = bus();
    const release = vi.fn(async () => {});
    createTabHandoff({ channel: join(), tabId: 'a', holds: () => true, canRelease: () => false, release });
    const b = createTabHandoff({ channel: join(), tabId: 'b', holds: () => false, canRelease: () => true, release: vi.fn() });
    await expect(b.requestRelease(500)).resolves.toBe('busy');
    expect(release).not.toHaveBeenCalled();
  });

  it('tabs that do not hold the wallet stay silent; no holder means no answer', async () => {
    const join = bus();
    const release = vi.fn(async () => {});
    createTabHandoff({ channel: join(), tabId: 'a', holds: () => false, canRelease: () => true, release });
    const b = createTabHandoff({ channel: join(), tabId: 'b', holds: () => false, canRelease: () => true, release: vi.fn() });
    await expect(b.requestRelease(50)).resolves.toBe('none');
    expect(release).not.toHaveBeenCalled();
  });

  it('ignores its own messages and malformed ones', async () => {
    const join = bus();
    const ch = join();
    const release = vi.fn(async () => {});
    createTabHandoff({ channel: ch, tabId: 'a', holds: () => true, canRelease: () => true, release });
    const other = join();
    other.postMessage({ t: 'release' });
    other.postMessage(null);
    other.postMessage({ t: 'release', from: 'a', req: 'x' }); // claims to be the holder itself
    await new Promise((r) => setTimeout(r, 20));
    expect(release).not.toHaveBeenCalled();
  });

  it('without BroadcastChannel nothing is asked', async () => {
    const h = createTabHandoff({ channel: null, holds: () => false, canRelease: () => true, release: vi.fn() });
    await expect(h.requestRelease(10)).resolves.toBe('none');
  });

  it('recognises the store lock error of the SDK', () => {
    expect(isStoreBusyError(new Error('SQLite-OPFS pool ".aztec-kv-pxe_x" is already in use by another store instance'))).toBe(true);
    expect(isStoreBusyError(new Error('SqlitePoolBusyError'))).toBe(true);
    expect(isStoreBusyError(new Error('decrypt_failed'))).toBe(false);
  });
});

describe('private wallet: stores are never left locked', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../../lib/aztec/wallet/client.ts'), 'utf8');

  it('frees an earlier attempt before opening, and a failed open before reporting it', () => {
    expect(src).toMatch(/await this\.teardown\(\);\s*const sdk = \(this\.sdk \?\?= await loadSdk\(\)\);/);
    expect(src).toMatch(/console\.error\('\[private wallet\] open failed'[\s\S]{0,300}await this\.teardown\(\);\s*this\.set\(\{\s*phase: 'error'/);
  });

  it('closes the stores themselves, not only the PXE', () => {
    expect(src).toMatch(/stores\.walletStore\?\.close\?\.\(\)/);
    expect(src).toMatch(/stores\.pxeStore\?\.close\?\.\(\)/);
  });

  it('asks the other tab before reporting the wallet as open elsewhere, and frees a frozen page', () => {
    expect(src).toMatch(/const stores = await this\.openStores\(signature, names\);/);
    expect(src).toMatch(/addEventListener\('pagehide'/);
  });

  it('the PXE uses the same node client (and failover route) as the checks', () => {
    expect(src).toMatch(/EmbeddedWallet\.create\(this\.node,/);
    expect(src).toMatch(/createAztecNodeClient\(AZTEC_WALLET_CONFIG\.nodeUrl, await walletNodeClientOptions\(/);
  });
});

describe('humanError: network and handoff', () => {
  it('turns Safari "Load failed" from several node requests into one clear message', async () => {
    const { humanError } = await import('@/lib/aztec/wallet/client');
    const agg = new AggregateError(
      [new Error('Error fetching from host https://aztec-mainnet.drpc.org: Load failed'), new TypeError('Load failed')],
      '2 of 2 concurrent operations failed: Load failed | Load failed',
    );
    expect(humanError(agg)).toMatch(/^Could not reach aztec-mainnet\.drpc\.org\. Check your connection/);
    expect(humanError(new TypeError('Load failed'))).toMatch(/^Could not reach/);
  });

  it('explains the real reason when only one of the failures was the network', async () => {
    const { humanError } = await import('@/lib/aztec/wallet/client');
    const agg = new AggregateError([new TypeError('Load failed'), new Error('Assertion failed: Balance too low')], '2 of 2 concurrent operations failed');
    expect(humanError(agg)).toMatch(/contract refused this/);
  });

  it('keeps the handoff messages as they are', async () => {
    const { humanError } = await import('@/lib/aztec/wallet/client');
    const { HANDED_OFF_MESSAGE, BUSY_ELSEWHERE_MESSAGE, PAUSED_MESSAGE } = await import('@/lib/aztec/wallet/tab-handoff');
    for (const m of [HANDED_OFF_MESSAGE, BUSY_ELSEWHERE_MESSAGE, PAUSED_MESSAGE]) expect(humanError(new Error(m))).toBe(m);
  });
});
