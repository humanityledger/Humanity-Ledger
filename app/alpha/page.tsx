'use client';
/**
 * /alpha — joining the closed alpha (package 4).
 *
 * The tester signs in with their wallet (/connect), opens this page with their code, reads the
 * signed terms, ticks three separate boxes (none ticked in advance) and redeems. The terms text is
 * fetched from ALPHA_TERMS_URL (same origin) and hashed here with SHA-256; the code can be redeemed
 * only when that hash equals the signed version the server records, and that hash is what the
 * server stores with each acceptance. While no signed version exists (OD-8), the page says so and
 * nothing can be redeemed.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Terms = { version: string; sha256: string; url: string };
type Status = { member: boolean; active: boolean; riskAcknowledged: boolean; terms: Terms };

const INK = '#15171C';
const SOFT = '#F7F8FA';
const LINE = '#E4E7EC';
const VIOLET = '#5200FF';
const OK = '#10B981';
const BAD = '#FF3B30';

/** SHA-256 of the exact bytes served (R2-7): decoding to text first would drop a BOM and differ from sha256sum. */
async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function AlphaJoin() {
  const [status, setStatus] = useState<Status | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [text, setText] = useState('');
  const [hash, setHash] = useState('');
  const [code, setCode] = useState('');
  const [boxes, setBoxes] = useState({ terms: false, risks: false, eligibility: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const load = async () => {
    const r = await fetch('/api/alpha/status', { credentials: 'include', cache: 'no-store' });
    if (r.status === 401) return setSignedOut(true);
    const s = (await r.json()) as Status;
    setStatus(s);
    if (s.terms?.url) {
      try {
        const bytes = await fetch(s.terms.url, { cache: 'no-store' }).then((x) => (x.ok ? x.arrayBuffer() : null));
        const t = bytes ? new TextDecoder('utf-8').decode(bytes) : '';
        setText(t);
        setHash(bytes && bytes.byteLength ? await sha256Hex(bytes) : '');
      } catch {
        setText('');
      }
    }
  };
  useEffect(() => {
    void load();
    const c = new URLSearchParams(window.location.search).get('code');
    if (c) setCode(c);
  }, []);

  const termsReady = !!status?.terms?.version && !!status.terms.sha256;
  const textMatches = termsReady && hash === status!.terms.sha256;
  const canRedeem = useMemo(() => textMatches && boxes.terms && boxes.risks && boxes.eligibility && code.trim().length >= 16, [textMatches, boxes, code]);

  const redeem = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/alpha/redeem', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, accept: boxes, termsSha256: hash }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.member) {
        setMsg({ tone: 'ok', text: 'You are in the closed alpha. Your acceptance was recorded with the version of the terms you read.' });
        await load();
      } else setMsg({ tone: 'bad', text: d.error || 'This did not work. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const card: React.CSSProperties = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 28, padding: 24, maxWidth: 640, margin: '0 auto' };
  const box = (k: keyof typeof boxes, label: string) => (
    <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderTop: `1px solid ${LINE}`, cursor: 'pointer' }}>
      <input type="checkbox" checked={boxes[k]} onChange={(e) => setBoxes((b) => ({ ...b, [k]: e.target.checked }))} style={{ width: 20, height: 20, marginTop: 2, accentColor: VIOLET }} />
      <span style={{ fontSize: 15, color: INK }}>{label}</span>
    </label>
  );

  return (
    <main style={{ minHeight: '100dvh', background: SOFT, padding: '32px 12px', fontFamily: 'Inter, system-ui, sans-serif', color: INK }}>
      <div style={card}>
        <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>Join the closed alpha</h1>
        <p style={{ fontSize: 15, color: '#475467', marginTop: 8 }}>
          Ledger Chat on Aztec Alpha, an early network. Payments in the alpha use HLC, a test token with no monetary value. Network fees are paid in Fee Juice, which
          does have value. Our contracts have had an internal security review, not an external audit.
        </p>

        {signedOut && (
          <p style={{ fontSize: 15, marginTop: 16 }}>
            Sign in with your wallet first, then come back to this page. <Link href="/connect" style={{ color: VIOLET, fontWeight: 600 }}>Sign in</Link>
          </p>
        )}

        {status?.member && (
          <p style={{ fontSize: 15, marginTop: 16, color: status.active ? OK : BAD, fontWeight: 600 }}>
            {status.active ? 'This account is in the closed alpha.' : 'This account’s closed alpha access was revoked. Existing agreements can still be settled.'}
          </p>
        )}

        {status && !status.member && !termsReady && (
          <p style={{ fontSize: 15, marginTop: 16, fontWeight: 600 }}>The closed alpha is not open yet: its terms have not been signed.</p>
        )}

        {status && !status.member && termsReady && (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 24 }}>Terms, version {status.terms.version}</h2>
            <div style={{ maxHeight: 320, overflow: 'auto', border: `1px solid ${LINE}`, borderRadius: 20, padding: 16, marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 14, background: SOFT }}>
              {text || 'The terms could not be loaded.'}
            </div>
            {!textMatches && <p style={{ fontSize: 13, color: BAD, marginTop: 8 }}>The text above does not match the signed version, so it cannot be accepted. Reload the page.</p>}
            <div style={{ marginTop: 16 }}>
              {box('terms', 'I have read and accept the terms of the closed alpha.')}
              {box('risks', 'I understand and accept the risks in clause 6.')}
              {box('eligibility', 'I am 18 or older and meet the requirements in clause 3.')}
            </div>
            <label style={{ display: 'block', marginTop: 16, fontSize: 14, fontWeight: 600 }}>
              Invitation code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                style={{ display: 'block', width: '100%', marginTop: 6, minHeight: 48, borderRadius: 16, border: `2px solid ${LINE}`, padding: '0 16px', fontSize: 16, fontFamily: 'ui-monospace, monospace' }}
              />
            </label>
            <button
              type="button"
              disabled={!canRedeem || busy}
              onClick={redeem}
              style={{ marginTop: 16, minHeight: 48, width: '100%', borderRadius: 999, border: 0, background: canRedeem ? VIOLET : LINE, color: canRedeem ? '#fff' : '#667085', fontSize: 16, fontWeight: 600, cursor: canRedeem ? 'pointer' : 'default' }}
            >
              {busy ? 'Joining…' : 'Join the closed alpha'}
            </button>
          </>
        )}

        {msg && <p role="status" style={{ fontSize: 14, marginTop: 12, color: msg.tone === 'ok' ? OK : BAD }}>{msg.text}</p>}
      </div>
    </main>
  );
}
