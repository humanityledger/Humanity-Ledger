"use client";

/**
 * The Ledger Chat screens shown inside the vector iPhone (DeviceFrame.tsx) on
 * the landing page and the sign-in page. Each screen fills the 430 x 932
 * display (iPhone 15 / 16 Pro Max, 1 px = 1 pt) and receives `p`, its
 * progress from 0 to 1, from the scroll position or the loop on /connect.
 *
 * The Dynamic Island is drawn by the frame, not by the screens.
 *
 * Everything a screen says must be true of the product today: no "verified"
 * badge (peer proof, G7, is open), no "Encrypted" badge on communities (their
 * posts are server-stored), and payments say which Aztec network they run on.
 */

import React from "react";
import {
  ArrowLeft,
  Hash,
  Megaphone,
  Check,
  CheckCheck,
  Lock,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Plus,
  RefreshCw,
  SendHorizontal,
  ShieldCheck,
  Users,
  Video,
  Volume2,
} from "lucide-react";
import s from "./PhoneShowcase.module.css";

export interface ScreenProps {
  p: number;
  active: boolean;
}

const at = (p: number, from: number) => (p >= from ? s.in : s.out);

function StatusBar({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`${s.status} ${dark ? s.statusDark : ""}`}>
      <span className={s.statusTime}>9:41</span>
      <span className={s.statusIcons} aria-hidden="true">
        <svg width="19" height="12" viewBox="0 0 19 12">
          <rect x="0" y="8" width="3.2" height="4" rx="1" fill="currentColor" />
          <rect x="5.2" y="5.5" width="3.2" height="6.5" rx="1" fill="currentColor" />
          <rect x="10.4" y="3" width="3.2" height="9" rx="1" fill="currentColor" />
          <rect x="15.6" y="0" width="3.2" height="12" rx="1" fill="currentColor" />
        </svg>
        <svg width="17" height="12" viewBox="0 0 17 12">
          <path d="M8.5 2.2c2.5 0 4.8 1 6.5 2.6l1.2-1.3C14.2 1.6 11.5.4 8.5.4S2.8 1.6.8 3.5L2 4.8C3.7 3.2 6 2.2 8.5 2.2Z" fill="currentColor" />
          <path d="M8.5 5.6c1.6 0 3 .6 4.1 1.6l1.2-1.3A7.8 7.8 0 0 0 8.5 3.8 7.8 7.8 0 0 0 3.2 5.9l1.2 1.3c1.1-1 2.5-1.6 4.1-1.6Z" fill="currentColor" />
          <path d="M8.5 9c.7 0 1.2.2 1.7.6l-1.7 1.9-1.7-1.9c.5-.4 1-.6 1.7-.6Z" fill="currentColor" />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity="0.4" />
          <rect x="2" y="2" width="20" height="9" rx="2.2" fill="currentColor" />
          <path d="M25 4.5v4c.8-.3 1.3-1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" opacity="0.45" />
        </svg>
      </span>
    </div>
  );
}

function ChatHeader({ name, initials, sub }: { name: string; initials: string; sub: string }) {
  return (
    <div className={s.chatHead}>
      <ArrowLeft size={24} strokeWidth={2} />
      <span className={s.chatAvatar}>{initials}</span>
      <span className={s.chatWho}>
        <span className={s.chatName}>{name}</span>
        <span className={s.chatSub}>{sub}</span>
      </span>
      <Phone size={22} strokeWidth={1.9} />
      <Video size={24} strokeWidth={1.9} />
    </div>
  );
}

function Composer() {
  return (
    <div className={s.composer}>
      <span className={s.composerPlus}>
        <Plus size={22} strokeWidth={2} />
      </span>
      <span className={s.composerField}>Message</span>
      <span className={s.composerSend}>
        <SendHorizontal size={19} strokeWidth={2} />
      </span>
    </div>
  );
}

function clock(sec: number) {
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/* ── 1. Conversation ───────────────────────────────────────────────── */

export function ChatScreen({ p }: ScreenProps) {
  const typing = p >= 0.62 && p < 0.8;
  return (
    <div className={s.screenLight}>
      <StatusBar />
      <ChatHeader name="Irina Vlad" initials="IV" sub="online" />
      <div className={s.chatBody}>
        <span className={s.e2ee}>
          <Lock size={13} strokeWidth={2.2} />
          Messages are encrypted end to end
        </span>
        <span className={s.day}>Today</span>
        <div className={`${s.msgIn} ${s.in}`}>
          Morning! Are we still on for 11?<span className={s.time}>10:52</span>
        </div>
        <div className={`${s.msgOut} ${at(p, 0.12)}`}>
          Yes. I will send you the details here first.
          <span className={s.time}>
            10:53 <CheckCheck size={15} strokeWidth={2.2} />
          </span>
        </div>
        <div className={`${s.msgIn} ${at(p, 0.3)}`}>
          Perfect. Nice that nobody else can read this.<span className={s.time}>10:53</span>
        </div>
        <div className={`${s.msgOut} ${at(p, 0.46)}`}>
          No phone number, no email. Just my wallet.
          <span className={s.time}>
            10:54 <CheckCheck size={15} strokeWidth={2.2} />
          </span>
        </div>
        <div className={`${s.typing} ${typing ? s.in : s.gone}`} aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className={`${s.msgIn} ${at(p, 0.8)}`}>
          Calling you in a minute.<span className={s.time}>10:55</span>
        </div>
      </div>
      <Composer />
    </div>
  );
}

/* ── 2. Voice call ─────────────────────────────────────────────────── */

export function VoiceCallScreen({ p, active }: ScreenProps) {
  const connected = p >= 0.12;
  return (
    <div className={s.screenDark}>
      <StatusBar dark />
      <div className={s.callTop}>
        <span className={s.callBadge}>
          <Lock size={13} strokeWidth={2.2} />
          Encrypted · DTLS-SRTP
        </span>
        <span className={`${s.callBadge} ${s.callBadgeSoft} ${at(p, 0.3)}`}>
          <Mic size={13} strokeWidth={2.2} />
          Noise suppression on
        </span>
      </div>
      <div className={`${s.callAvatarWrap} ${active && connected ? s.ringing : ""}`}>
        <span className={s.ring} />
        <span className={s.ring} />
        <span className={s.callAvatar}>IV</span>
      </div>
      <div className={s.callName}>Irina Vlad</div>
      <div className={s.callState}>{connected ? clock(3 + Math.floor(p * 96)) : "Calling…"}</div>
      <div className={`${s.wave} ${active && connected ? s.waveOn : ""}`} aria-hidden="true">
        {Array.from({ length: 15 }).map((_, i) => (
          <i key={i} style={{ ["--d" as string]: `${(i % 5) * 0.12}s` } as React.CSSProperties} />
        ))}
      </div>
      <div className={s.callHint}>Browser to browser. No phone number shared.</div>
      <div className={s.callControls}>
        <span className={s.ctl}>
          <span className={`${s.ctlBtn} ${p >= 0.55 ? s.ctlOn : ""}`}>
            {p >= 0.55 ? <MicOff size={26} /> : <Mic size={26} />}
          </span>
          Mute
        </span>
        <span className={s.ctl}>
          <span className={s.ctlBtn}>
            <Volume2 size={26} />
          </span>
          Speaker
        </span>
        <span className={s.ctl}>
          <span className={s.ctlBtn}>
            <Video size={26} />
          </span>
          Video
        </span>
        <span className={s.ctl}>
          <span className={`${s.ctlBtn} ${s.ctlEnd}`}>
            <PhoneOff size={26} />
          </span>
          End
        </span>
      </div>
    </div>
  );
}

/* ── 3. Video call (Realistic Portrait without vector puppet) ──────── */

export function VideoCallScreen({ p, active }: ScreenProps) {
  return (
    <div className={`${s.screenVideo} ${active ? s.videoLive : ""}`}>
      {/* Remote camera: authentic real person video stream */}
      <div className={s.remote} aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <img
          src="/landing/phones/videocall-person.jpg"
          alt="Video Call Remote Party"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0.65) 100%)', pointerEvents: 'none' }} />
      </div>
      <StatusBar dark />
      <div className={s.videoTop}>
        <span className={s.videoName}>Comms Weekly</span>
        <span className={s.videoMeta}>{clock(12 + Math.floor(p * 80))} · 16 people</span>
        <span className={s.videoChips}>
          <span className={s.chip}>
            <Lock size={12} strokeWidth={2.4} /> Encrypted
          </span>
          <span className={`${s.chip} ${at(p, 0.35)}`}>
            <ShieldCheck size={12} strokeWidth={2.4} /> IP hidden, call relayed
          </span>
        </span>
      </div>
      <div className={s.self} aria-hidden="true">
        <div className={s.selfCam} style={{ background: '#1c1d22', border: '1px solid rgba(255,255,255,0.2)' }}>
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 600 }}>
            You
          </div>
        </div>
      </div>
      <div className={s.videoBar}>
        <span className={s.vbBtn}>
          <Mic size={24} />
        </span>
        <span className={s.vbBtn}>
          <Video size={24} />
        </span>
        <span className={s.vbBtn}>
          <RefreshCw size={22} />
        </span>
        <span className={`${s.vbBtn} ${s.ctlEnd}`}>
          <PhoneOff size={24} />
        </span>
      </div>
    </div>
  );
}

/* ── 4. Conversation with a private invoice ────────────────────────── */

/**
 * A direct message with an Aztec private invoice settling in place. Used as
 * the first step on the landing page and as the phone on /connect.
 * The invoice goes Unpaid -> Proving (the proof is made on the payer's
 * device) -> Paid.
 */
export function InvoiceChatScreen({ p }: ScreenProps) {
  const proving = p >= 0.46 && p < 0.7;
  const paid = p >= 0.7;
  return (
    <div className={s.screenLight}>
      <StatusBar />
      <div className={s.chatHead}>
        <ArrowLeft size={24} strokeWidth={2} />
        <span className={s.chatAvatar} style={{ background: "#ece5ff", color: "#5200ff" }}>A</span>
        <span className={s.chatWho}>
          <span className={s.chatName}>Alice</span>
          <span className={`${s.chatSub} ${s.mono}`}>zk:alice</span>
        </span>
        <Phone size={22} strokeWidth={1.9} />
        <Video size={24} strokeWidth={1.9} />
      </div>
      <div className={s.chatBody}>
        <span className={s.e2ee}>
          <Lock size={13} strokeWidth={2.2} />
          End-to-end encrypted · MLS
        </span>
        <span className={s.day}>Today</span>
        <div className={`${s.msgIn} ${s.in}`}>
          I paid for dinner. Your share is 42 USDC.<span className={s.time}>21:04</span>
        </div>
        <div className={`${s.msgOut} ${at(p, 0.1)}`}>
          Send me a private invoice and I will pay it here.
          <span className={s.time}>
            21:05 <CheckCheck size={15} strokeWidth={2.2} />
          </span>
        </div>

        <div className={`${s.ledgerInvoiceCard} ${at(p, 0.24)}`}>
          <div className={s.invTop}>
            <span className={s.invDocTag}>
              <ShieldCheck size={14} strokeWidth={2.2} />
              Private invoice
            </span>
            <span className={`${s.invStatusTag} ${paid ? s.invStatusPaid : proving ? s.invStatusProving : s.invStatusUnpaid}`}>
              <span className={s.invDot} />
              {paid ? "Paid" : proving ? "Proving" : "Unpaid"}
            </span>
          </div>
          <div className={s.invTitle}>Dinner, Friday</div>
          <div className={s.invParties}>From zk:alice</div>
          <div className={s.invItemRow}>
            <span>Your share</span>
            <span className={s.num}>42.00</span>
          </div>
          <div className={s.invDivider} />
          <div className={s.invTotalRow}>
            <span>Total</span>
            <span className={`${s.invTotalVal} ${s.num}`}>42.00 USDC</span>
          </div>
          <div className={s.invFooterRow}>
            <span className={s.invDue}>Aztec testnet</span>
            <span className={`${s.invActionBtn} ${paid ? s.invActionDone : ""}`}>
              {paid ? (
                <span className={s.invBtnInner}><Check size={14} strokeWidth={2.6} /> Paid</span>
              ) : proving ? (
                <span className={s.invBtnInner}><span className={s.spinner} /> Making proof</span>
              ) : (
                "Pay privately"
              )}
            </span>
          </div>
        </div>

        <div className={`${s.msgOut} ${at(p, 0.76)}`}>
          Paid.
          <span className={s.time}>
            21:06 <CheckCheck size={15} strokeWidth={2.2} />
          </span>
        </div>
        <div className={`${s.msgIn} ${at(p, 0.88)}`}>
          Got it, thank you!<span className={s.time}>21:06</span>
        </div>
      </div>
      <Composer />
    </div>
  );
}

/* ── 5. Communities ─────────────────────────────────────────────────── */

/**
 * A community workspace: channels, a pinned announcement and a proposal
 * with one vote per wallet. Community posts are stored on the server (they
 * are not end-to-end encrypted like direct messages), so no lock badge here.
 */
export function CommunitiesScreen({ p }: ScreenProps) {
  const yes = Math.round(38 + 26 * Math.min(1, Math.max(0, (p - 0.35) / 0.5)));
  return (
    <div className={s.screenLight}>
      <StatusBar />
      <div className={s.commHead}>
        <span className={s.commTitleWrap}>
          <span className={s.commAvatar} style={{ background: "#15171c", color: "#fff", width: 38, height: 38, fontSize: 14 }}>
            HL
          </span>
          <span className={s.commTitleText}>
            <span className={s.commTitle}>Builders</span>
            <span className={s.commSub}>214 members</span>
          </span>
        </span>
        <span className={s.commAction}>
          <Users size={18} strokeWidth={2.1} />
        </span>
      </div>
      <div className={s.commTabs}>
        <span className={s.commTabOn}>Chat & Channels</span>
        <span>Posts</span>
        <span>Governance</span>
        <span>Members</span>
      </div>
      <div className={s.commList}>
        <div className={`${s.chanRow} ${s.in}`}>
          <Hash size={17} strokeWidth={2.2} /> <span className={s.chanName}>general</span>
          <span className={s.chanCount}>3</span>
        </div>
        <div className={`${s.chanRow} ${s.in}`}>
          <Megaphone size={17} strokeWidth={2.1} /> <span className={s.chanName}>announcements</span>
        </div>
        <div className={`${s.chanRow} ${at(p, 0.1)}`}>
          <Hash size={17} strokeWidth={2.2} /> <span className={s.chanName}>aztec-contracts</span>
          <span className={s.chanCount}>12</span>
        </div>

        <div className={`${s.pinCard} ${at(p, 0.2)}`}>
          <span className={s.pinTag}>Pinned</span>
          <span className={s.pinText}>Weekly call moves to Thursday 17:00 CET.</span>
        </div>

        <div className={`${s.propCard} ${at(p, 0.3)}`}>
          <div className={s.propTop}>
            <span className={s.propTag}>Proposal</span>
            <span className={s.propRule}>1 wallet, 1 vote</span>
          </div>
          <div className={s.propTitle}>Fund a second audit of the escrow contract</div>
          <div className={s.propBar}>
            <span style={{ width: `${yes}%` }} />
          </div>
          <div className={s.propNums}>
            <span className={s.num}>Yes {yes}%</span>
            <span className={s.num}>No {100 - yes}%</span>
          </div>
          <span className={`${s.propVote} ${p >= 0.6 ? s.propVoted : ""}`}>
            {p >= 0.6 ? (
              <>
                <Check size={14} strokeWidth={2.6} /> You voted yes
              </>
            ) : (
              "Vote"
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
