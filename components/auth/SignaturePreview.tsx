'use client';

/**
 * SignaturePreview: what the wallet is about to sign, shown before the person approves it.
 *
 * Two kinds of message reach a wallet from Ledger Chat:
 *  - sign-in, a Sign-In with Ethereum message (EIP-4361), built in components/landing/ConnectPage.tsx;
 *  - unlocking this device's encrypted inbox, a text the XMTP SDK builds (components/terminal).
 * The panel reads the exact text, lists its fields in plain words, checks the website against the
 * address bar, and always offers the exact text, so what is shown here is what the wallet shows.
 * Neither message moves funds, approves a token or sends a transaction.
 */
import React from 'react';

type Row = { k: string; v: string; mono?: boolean; ok?: boolean; warn?: boolean };

const CHAINS: Record<string, string> = { '1': 'Ethereum', '11155111': 'Sepolia test network', '8453': 'Base', '10': 'Optimism', '42161': 'Arbitrum One' };

const short = (a: string) => (/^0x[0-9a-fA-F]{40}$/.test(a) ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
const when = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : iso;
};

/** Reads an EIP-4361 message into rows. Null when the text is not one. */
export function readSiwe(text: string, host: string): Row[] | null {
  const lines = text.split('\n');
  const head = /^(\S+) wants you to sign in with your Ethereum account:$/.exec(lines[0] ?? '');
  if (!head || !/^0x[0-9a-fA-F]{40}$/.test(lines[1] ?? '')) return null;
  const field = (name: string) => lines.find((l) => l.startsWith(`${name}: `))?.slice(name.length + 2) ?? '';
  const statement = lines[2] === '' && lines[3] && !lines[3].includes(': ') ? lines[3] : '';
  const domainOk = head[1] === host;
  const rows: Row[] = [
    { k: 'Website', v: head[1], ok: domainOk, warn: !domainOk },
    { k: 'Account', v: short(lines[1]), mono: true },
  ];
  if (statement) rows.push({ k: 'Purpose', v: statement });
  const chain = field('Chain ID');
  if (chain) rows.push({ k: 'Network', v: CHAINS[chain] ?? `Chain ${chain}` });
  const issued = field('Issued At');
  if (issued) rows.push({ k: 'Requested', v: when(issued) });
  const exp = field('Expiration Time');
  if (exp) rows.push({ k: 'Valid until', v: when(exp) });
  const nonce = field('Nonce');
  if (nonce) rows.push({ k: 'One-time code', v: nonce, mono: true });
  return rows;
}

/** Reads the XMTP inbox text ("XMTP : Authenticate to inbox", then "Key: value" lines). */
export function readUnlock(text: string): Row[] {
  const rows: Row[] = [{ k: 'Purpose', v: 'Unlock your encrypted inbox on this device' }];
  for (const line of text.split('\n')) {
    const m = /^([A-Za-z][A-Za-z ]{1,40}):\s*(.+)$/.exec(line.trim());
    if (!m) continue;
    const k = m[1].trim();
    const v = m[2].trim();
    if (/^inbox ?id$/i.test(k)) rows.push({ k: 'Inbox', v: v.length > 20 ? `${v.slice(0, 8)}…${v.slice(-6)}` : v, mono: true });
    else if (/time/i.test(k)) rows.push({ k: 'Requested', v: when(v) });
    else if (/address|account/i.test(k)) rows.push({ k: 'Account', v: short(v), mono: true });
    else if (/installation/i.test(k)) rows.push({ k: 'Device', v: v.length > 20 ? `${v.slice(0, 8)}…` : v, mono: true });
  }
  return rows;
}

export function SignaturePreview({
  text,
  kind,
  host = typeof window !== 'undefined' ? window.location.hostname : '',
  tone = 'light',
}: {
  text: string;
  kind: 'sign-in' | 'unlock';
  host?: string;
  tone?: 'light';
}) {
  const [open, setOpen] = React.useState(false);
  const rows = (kind === 'sign-in' ? readSiwe(text, host) : null) ?? readUnlock(text);
  const mismatch = rows.some((r) => r.warn);
  return (
    <section
      aria-label="What your wallet will sign"
      style={{ width: '100%', textAlign: 'left', border: '1px solid #e4e7ec', borderRadius: 12, background: '#fff', overflow: 'hidden' }}
      data-tone={tone}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderBottom: '1px solid #e4e7ec', background: '#f7f8fa' }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#15171c' }}>What your wallet will sign</span>
        <span style={{ fontSize: 12, color: '#0a7a55', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#10b981" /><path d="M4.8 8.2l2.1 2.1 4.3-4.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Free, no transaction
        </span>
      </div>
      <dl style={{ margin: 0, padding: '4px 14px' }}>
        {rows.map((r) => (
          <div key={r.k} style={{ display: 'grid', gridTemplateColumns: '112px minmax(0,1fr)', gap: 12, padding: '9px 0', borderBottom: '1px solid #eef0f3' }}>
            <dt style={{ fontSize: 13, color: '#5b606b' }}>{r.k}</dt>
            <dd style={{ margin: 0, fontSize: r.mono ? 12.5 : 13.5, fontFamily: r.mono ? 'var(--font-aztec-mono), ui-monospace, monospace' : undefined, color: r.warn ? '#b42318' : '#15171c', overflowWrap: 'anywhere', display: 'flex', alignItems: 'center', gap: 6 }}>
              {r.v}
              {r.ok ? <span style={{ fontSize: 12, color: '#0a7a55' }}>matches this page</span> : null}
            </dd>
          </div>
        ))}
      </dl>
      {mismatch ? (
        <p role="alert" style={{ margin: 0, padding: '10px 14px', fontSize: 13, color: '#b42318', background: '#fff5f4', borderTop: '1px solid #fecdca' }}>
          The website in this message is not the page you are on. Do not sign it.
        </p>
      ) : null}
      <div style={{ padding: '10px 14px 12px', display: 'grid', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: '#5b606b' }}>
          Signing proves this account is yours. It does not move funds, approve a token or send a transaction.
        </p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          style={{ justifySelf: 'start', border: 0, background: 'none', padding: 0, font: 'inherit', fontSize: 13, fontWeight: 600, color: '#5200ff', cursor: 'pointer' }}
        >
          {open ? 'Hide the exact text' : 'Show the exact text'}
        </button>
        {open ? (
          <pre style={{ margin: 0, padding: 12, maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, lineHeight: 1.55, fontFamily: 'var(--font-aztec-mono), ui-monospace, monospace', color: '#15171c', background: '#f7f8fa', border: '1px solid #e4e7ec', borderRadius: 8 }}>
            {text}
          </pre>
        ) : null}
      </div>
    </section>
  );
}
