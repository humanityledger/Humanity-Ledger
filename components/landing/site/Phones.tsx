/**
 * The app's screens, drawn in HTML and CSS on the display of a real photograph of a phone in a
 * hand (PhotoMockup). They show the product as it looks, and they never carry real data: no
 * addresses, hashes or token names. The QR code is the app's own (BrandedQr), pointing to the site.
 */
import React from 'react';
import s from './site.module.css';
import type { Screen } from '@/lib/landing/chapters';
import type { MockupId } from '@/lib/landing/mockups';
import { BrandedQr } from '@/components/chat/profile/BrandedQr';
import { DeviceScreen, PhotoMockup } from './PhotoMockup';

const Lock = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 7V5.2a3.5 3.5 0 0 1 7 0V7M3.5 7h9v6.5h-9z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
);
const Check = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#10b981" /><path d="M4.8 8.2l2.1 2.1 4.3-4.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Avatar = ({ t, tone = 0, size = 40 }: { t: string; tone?: number; size?: number }) => (
  <span className={s.av} data-tone={tone} style={{ width: size, height: size, fontSize: size * 0.36 }}>{t}</span>
);

function AppBar({ title, back }: { title: string; back?: boolean }) {
  return (
    <div className={s.appBar}>
      {back ? <span className={s.back} aria-hidden="true">‹</span> : null}
      <b>{title}</b>
    </div>
  );
}

function ProfileScreen() {
  return (
    <div className={s.scr}>
      <AppBar title="Profile" />
      <div className={s.profile}>
        <Avatar t="AM" tone={1} size={76} />
        <b className={s.profName}>Amara</b>
        <span className={s.handle}>@amara</span>
        <div className={s.qrCard}>
          <div className={s.qrBox}><BrandedQr value="https://ledgerchat.org" title="QR code for ledgerchat.org" /></div>
          <span>Scan to start a private chat</span>
        </div>
        <span className={s.pillBtn}>Share profile</span>
        <div className={s.kvList}>
          <div><span>Account</span><b>Your wallet</b></div>
          <div><span>Phone number</span><b>Not needed</b></div>
        </div>
      </div>
    </div>
  );
}

const CHATS = [
  { n: 'Jonas', p: 'Private payment', t: '9:38', tone: 2, unread: 1 },
  { n: 'Design team', p: 'Mei: Voice message', t: '9:12', tone: 3, unread: 3 },
  { n: 'Amara', p: 'Photo', t: '8:55', tone: 1 },
  { n: 'Rafael', p: 'See you at ten.', t: 'Yesterday', tone: 4 },
  { n: 'Field notes', p: 'Poll: Which day works?', t: 'Yesterday', tone: 5 },
  { n: 'Lena', p: 'Thank you for the call', t: 'Mon', tone: 6 },
];

function ChatsScreen() {
  return (
    <div className={s.scr}>
      <div className={s.chatsHead}>
        <b>Chats</b>
        <span className={s.search}>Search or start a new chat</span>
      </div>
      <ul className={s.chatList}>
        {CHATS.map((c) => (
          <li key={c.n}>
            <Avatar t={c.n.split(' ').map((w) => w[0]).join('').slice(0, 2)} tone={c.tone} size={42} />
            <span className={s.chatMain}>
              <b>{c.n}</b>
              <span>{c.p}</span>
            </span>
            <span className={s.chatMeta}>
              <span>{c.t}</span>
              {c.unread ? <i>{c.unread}</i> : null}
            </span>
          </li>
        ))}
      </ul>
      <div className={s.e2eFoot}><Lock /> Messages are end-to-end encrypted</div>
    </div>
  );
}

function CallScreen() {
  return (
    <div className={`${s.scr} ${s.callScr}`}>
      <div className={s.callTop}><Lock /> Encrypted in transit, device to device</div>
      <div className={s.callWho}>
        <span className={s.callRing}><Avatar t="J" tone={2} size={104} /></span>
        <b>Jonas</b>
        <span>Video call, 04:12</span>
      </div>
      <div className={s.selfView} aria-hidden="true"><Avatar t="A" tone={1} size={40} /></div>
      <div className={s.callKeys} aria-hidden="true">
        <span><svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></span>
        <span><svg width="20" height="20" viewBox="0 0 24 24"><rect x="3" y="7" width="12" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M15 11l6-3v8l-6-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg></span>
        <span className={s.endKey}><svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 14c5-4.5 13-4.5 18 0l-2.5 2.5-3-1.5v-2.5c-2.5-1-4.5-1-7 0V15l-3 1.5z" fill="currentColor" /></svg></span>
      </div>
    </div>
  );
}

function PayScreen() {
  return (
    <div className={`${s.scr} ${s.sheetScr}`}>
      <AppBar title="Jonas" back />
      <div className={s.thread} aria-hidden="true">
        <span className={`${s.mini} ${s.miniA}`}>The invoice is in your inbox.</span>
        <span className={`${s.mini} ${s.miniB}`}>Paying now.</span>
      </div>
      <div className={s.sheet}>
        <i className={s.grab} />
        <b className={s.sheetTitle}>Send privately</b>
        <div className={s.amount}>25.00 <small>USDC</small></div>
        <div className={s.toRow}>
          <Avatar t="J" tone={2} size={30} />
          <span><b>Jonas</b><span className={s.verified}><Check /> Address verified for this chat</span></span>
        </div>
        <div className={s.kvList}>
          <div><span>Amount</span><b>Hidden on the network</b></div>
          <div><span>Recipient</span><b>Hidden on the network</b></div>
          <div><span>Network fee</span><b>Paid publicly</b></div>
        </div>
        <span className={s.sendBtn}>Send privately</span>
      </div>
    </div>
  );
}

function FileScreen() {
  return (
    <div className={s.scr}>
      <AppBar title="Studio" back />
      <div className={s.thread}>
        <span className={`${s.mini} ${s.miniA}`}>Can you send the final cut?</span>
        <div className={`${s.fileCard} ${s.fileMe}`}>
          <span className={s.fileIcon} aria-hidden="true" />
          <span className={s.fileMain}>
            <b>final-cut.mov</b>
            <span><Lock /> 14.2 GB, encrypting on this device</span>
            <span className={s.bar}><i style={{ width: '62%' }} /></span>
          </span>
        </div>
        <span className={`${s.mini} ${s.miniA}`}>And the dataset is here.</span>
        <div className={s.fileCard}>
          <span className={s.fileIcon} aria-hidden="true" />
          <span className={s.fileMain}>
            <b>survey-2026.zip</b>
            <span><Lock /> 3.8 GB, end-to-end encrypted</span>
          </span>
          <span className={s.dl} aria-hidden="true">↓</span>
        </div>
      </div>
    </div>
  );
}

function TimerScreen() {
  return (
    <div className={`${s.scr} ${s.sheetScr}`}>
      <AppBar title="Rafael" back />
      <div className={s.thread} aria-hidden="true">
        <span className={s.sysNote}>Messages disappear 1 hour after they are read</span>
        <span className={`${s.mini} ${s.miniA}`}>The door code is in the note.</span>
        <span className={`${s.mini} ${s.miniB}`}>Got it. Deleting soon.</span>
      </div>
      <div className={s.sheet}>
        <i className={s.grab} />
        <b className={s.sheetTitle}>Disappearing messages</b>
        <ul className={s.options}>
          {['Off', '30 seconds', '5 minutes', '1 hour', '1 day'].map((o) => (
            <li key={o} data-on={o === '1 hour'}>{o}<i /></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const SCREENS: Record<Screen, { el: () => React.ReactElement; label: string; dark?: boolean; photo: MockupId }> = {
  profile: { el: ProfileScreen, photo: 'hand-wall', label: 'A hand holding a phone with a Ledger Chat profile: an @username and a QR code, without a phone number' },
  chats: { el: ChatsScreen, photo: 'hand-tilt-l', label: 'A hand holding a phone with the chat list of Ledger Chat, every conversation end-to-end encrypted' },
  call: { el: CallScreen, photo: 'hand-tilt', label: 'A hand holding a phone with a video call in Ledger Chat, encrypted in transit device to device', dark: true },
  pay: { el: PayScreen, photo: 'hand-front-l', label: 'A hand holding a phone sending a private payment inside a conversation' },
  file: { el: FileScreen, photo: 'hand-wall-l', label: 'A hand holding a phone with large files sent in a conversation, encrypted on the device' },
  timer: { el: TimerScreen, photo: 'hand-front', label: 'A hand holding a phone choosing when messages disappear' },
};

export function PhoneScreen({ screen }: { screen: Screen }) {
  const { el: El, label, dark, photo } = SCREENS[screen];
  return (
    <PhotoMockup id={photo} label={label}>
      <DeviceScreen dark={dark}>
        <El />
      </DeviceScreen>
    </PhotoMockup>
  );
}
