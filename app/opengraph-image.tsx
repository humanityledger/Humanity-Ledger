import { ImageResponse } from 'next/og';

/**
 * The Open Graph image of ledgerchat.org (landing brief, "Discoverability"): the hero sentence on
 * white, in ink, with the standards underneath. No third-party logo, no figure.
 */
export const alt = 'Ledger Chat: talk, call and pay in one conversation. Only the people in it can see it.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const STANDARDS = [
  ['MLS', 'RFC 9420, through XMTP'],
  ['EIP-4361', 'Sign-In with Ethereum'],
  ['Aztec PXE', 'Proofs on your device'],
];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 72px', background: '#ffffff', color: '#15171c' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontWeight: 600 }}>
            <div style={{ width: 30, height: 30, borderRadius: 15, background: '#15171c' }} />
            Ledger Chat
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 20, color: '#3f4552' }}>
            <div style={{ width: 10, height: 10, borderRadius: 5, background: '#10b981' }} />
            Closed alpha on Aztec Network
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 72, lineHeight: 1.04, letterSpacing: -2 }}>
          <span>Talk, call and pay in one conversation.</span>
          <span style={{ color: '#5f6673' }}>Only the people in it can see it.</span>
        </div>
        <div style={{ display: 'flex', borderTop: '2px solid #15171c' }}>
          {STANDARDS.map(([b, t], i) => (
            <div key={b} style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingTop: 18, paddingLeft: i ? 24 : 0, borderLeft: i ? '1px solid #e4e7ec' : 'none' }}>
              <span style={{ fontSize: 24, fontWeight: 600 }}>{b}</span>
              <span style={{ fontSize: 20, color: '#5f6673', marginTop: 4 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
