'use client';
/**
 * /beta: joining the closed technical beta of private cUSDC payments (docs/beta/CUSDC_BETA.md).
 *
 * The person signs in with their wallet (/connect), opens this page with their invitation code,
 * reads the technical beta notice, confirms it with one box (not ticked in advance) and joins. A
 * member whose notice version is out of date confirms the new text here. The notice is not legal
 * terms; the legal texts of Ledger Chat are unchanged.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Status = {
  open: boolean;
  reasons: string[];
  member: boolean;
  active: boolean;
  access: boolean;
  accessReasons: string[];
  visibility: 'send' | 'exits' | 'hidden';
  capacity: number;
  notice: { version: string; text: string[] };
};

const INK = '#15171C';
const SOFT = '#F7F8FA';
const LINE = '#E4E7EC';
const VIOLET = '#5200FF';
const OK = '#10B981';
const BAD = '#FF3B30';

const card: React.CSSProperties = { maxWidth: 560, margin: '0 auto', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 28, padding: 24 };

export default function CusdcBetaJoin() {
  const [status, setStatus] = useState<Status | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [code, setCode] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  async function load() {
    const r = await fetch('/api/beta/cusdc/status', { credentials: 'include', cache: 'no-store' });
    if (r.status === 401) { setSignedOut(true); return; }
    if (!r.ok) { setMsg({ tone: 'bad', text: 'The beta status is not available right now. Try again in a minute.' }); return; }
    setStatus(await r.json());
  }

  useEffect(() => {
    load().catch(() => setMsg({ tone: 'bad', text: 'The beta status is not available right now. Try again in a minute.' }));
  }, []);

  async function post(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) setMsg({ tone: 'bad', text: typeof data.error === 'string' ? data.error : 'That did not work. Try again.' });
      else setMsg({ tone: 'ok', text: 'Done.' });
      await load();
    } catch {
      setMsg({ tone: 'bad', text: 'That did not work. Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  }

  const needsNotice = !!status?.member && status.active && status.accessReasons.includes('Read and confirm the beta notice first.');
  const canJoin = !!status && !status.member && status.open && agreed && code.trim().length >= 16 && !busy;

  return (
    <main style={{ minHeight: '100dvh', background: SOFT, padding: '32px 12px', fontFamily: 'Inter, system-ui, sans-serif', color: INK }}>
      <div style={card}>
        <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>cUSDC beta</h1>
        <p style={{ fontSize: 15, color: '#475467', marginTop: 8 }}>
          A closed technical test of private cUSDC payments in Ledger Chat, for at most {status?.capacity ?? 100} invited people.
        </p>

        {signedOut && (
          <p style={{ fontSize: 15, marginTop: 16 }}>
            Sign in with your wallet first, then come back to this page. <Link href="/connect" style={{ color: VIOLET, fontWeight: 600 }}>Sign in</Link>
          </p>
        )}

        {status?.member && (
          <p style={{ fontSize: 15, marginTop: 16, fontWeight: 600, color: status.access ? OK : status.active ? INK : BAD }}>
            {status.access
              ? 'This account is in the cUSDC beta. cUSDC appears in your private wallet.'
              : status.active
                ? 'This account is in the cUSDC beta.'
                : 'This account’s beta access was revoked. Your balance stays visible and you can still move your own funds.'}
          </p>
        )}
        {status?.member && !status.access && status.active && status.accessReasons.filter((r) => r !== 'Read and confirm the beta notice first.').map((r) => (
          <p key={r} style={{ fontSize: 14, marginTop: 6, color: '#475467' }}>{r}</p>
        ))}

        {status && !status.member && !status.open && (
          <p style={{ fontSize: 15, marginTop: 16, fontWeight: 600 }}>{status.reasons[0] ?? 'The cUSDC beta is not open.'}</p>
        )}

        {status && ((!status.member && status.open) || needsNotice) && (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 24 }}>Beta notice</h2>
            <ul style={{ border: `1px solid ${LINE}`, borderRadius: 20, padding: '12px 16px 12px 32px', marginTop: 8, fontSize: 14, background: SOFT, lineHeight: 1.5 }}>
              {status.notice.text.map((line) => <li key={line} style={{ marginTop: 4 }}>{line}</li>)}
            </ul>
            <p style={{ fontSize: 12, color: '#667085', marginTop: 6 }}>Technical notice {status.notice.version}. It is not legal terms and does not replace them.</p>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16, fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ width: 20, height: 20, marginTop: 1 }} />
              I have read the beta notice and I understand it.
            </label>
          </>
        )}

        {needsNotice && (
          <button
            type="button"
            disabled={!agreed || busy}
            onClick={() => post('/api/beta/cusdc/status', { notice: true, noticeVersion: status!.notice.version })}
            style={button(agreed && !busy)}
          >
            {busy ? 'Saving…' : 'Confirm the notice'}
          </button>
        )}

        {status && !status.member && status.open && (
          <>
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
              disabled={!canJoin}
              onClick={() => post('/api/beta/cusdc/redeem', { code, notice: true, noticeVersion: status.notice.version })}
              style={button(canJoin)}
            >
              {busy ? 'Joining…' : 'Join the cUSDC beta'}
            </button>
          </>
        )}

        {msg && <p role="status" style={{ fontSize: 14, marginTop: 12, color: msg.tone === 'ok' ? OK : BAD }}>{msg.text}</p>}
      </div>
    </main>
  );
}

function button(enabled: boolean): React.CSSProperties {
  return {
    marginTop: 16, minHeight: 48, width: '100%', borderRadius: 999, border: 0,
    background: enabled ? VIOLET : LINE, color: enabled ? '#fff' : '#667085', fontSize: 16, fontWeight: 600, cursor: enabled ? 'pointer' : 'default',
  };
}
