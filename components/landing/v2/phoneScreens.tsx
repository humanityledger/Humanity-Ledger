"use client";

/**
 * The Ledger Chat screens shown inside the vector iPhone (DeviceFrame.tsx) on
 * the landing page and the sign-in page. Each screen fills the 430 x 932
 * display (iPhone 15 / 16 Pro Max, 1 px = 1 pt) and receives `p`, its
 * progress from 0 to 1, from the scroll position or the loop on /connect.
 *
 * The Dynamic Island is drawn by the frame, not by the screens.
 *
 * Everything a screen says must be true of the product today. Value only moves
 * to an Aztec address the other person signed for (G7), so payment and
 * agreement cards may say "address verified"; communities carry no "Encrypted"
 * badge (their posts are server-stored); payments say which Aztec network they run on.
 */

import React from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Lock,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneOff,
  Plus,
  RefreshCw,
  SendHorizontal,
  Video,
} from "lucide-react";
import s from "./PhoneShowcase.module.css";
import { CHAT_THEMES, chatThemeVars } from "@/lib/chat/themes";
import { WALLPAPERS, canvasCss, resolveWallpaper } from "@/lib/chat/wallpapers";
import { BUBBLE_STYLES, bubbleClasses } from "@/lib/chat/bubbleStyles";
import { STICKER_PACKS, stickerFile } from "@/lib/chat/stickers";

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

/**
 * G7: the peer signed (Schnorr) the binding of their Aztec address to this XMTP chat identity
 * (lib/aztec/peer-binding.ts, version 2). Value only moves to an address verified this way.
 */
function VerifiedBinding() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14.5, fontWeight: 600, color: "#0f9d63" }}>
      <span style={{ width: 17, height: 17, borderRadius: 9, background: "#0f9d63", display: "grid", placeItems: "center" }}>
        <Check size={12} strokeWidth={3.2} color="#fff" />
      </span>
      Verified Aztec address
    </span>
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
            <MonitorUp size={26} />
          </span>
          Share
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
            <Lock size={12} strokeWidth={2.4} /> IP hidden, call relayed
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
          <VerifiedBinding />
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
          I paid for dinner. Your share is 42 HLC.<span className={s.time}>21:04</span>
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
              <Lock size={14} strokeWidth={2.2} />
              Private invoice
            </span>
            <span className={`${s.invStatusTag} ${paid ? s.invStatusPaid : proving ? s.invStatusProving : s.invStatusUnpaid}`}>
              <span className={s.invDot} />
              {paid ? "Paid" : proving ? "Proving" : "Unpaid"}
            </span>
          </div>
          <div className={s.invTitle}>Dinner, Friday</div>
          <div className={s.invParties}>To Alice · Aztec address verified</div>
          <div className={s.invItemRow}>
            <span>Your share</span>
            <span className={s.num}>42.00</span>
          </div>
          <div className={s.invDivider} />
          <div className={s.invTotalRow}>
            <span>Total</span>
            <span className={`${s.invTotalVal} ${s.num}`}>42.00 HLC</span>
          </div>
          <div className={s.invFooterRow}>
            <span className={s.invDue}>Aztec Alpha · mainnet</span>
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

/* ── 4b. Private agreement (escrow) ───────────────────────────────── */

/**
 * An escrow agreement opened from the chat: posted, funded with a proof made
 * on the device, then released. Same card shape as the real AgreementCard.
 */
export function AgreementChatScreen({ p }: ScreenProps) {
  const proving = p >= 0.34 && p < 0.56;
  const locked = p >= 0.56 && p < 0.8;
  const released = p >= 0.8;
  const status = released ? "Released" : locked ? "Locked" : proving ? "Proving" : "Open";
  return (
    <div className={s.screenLight}>
      <StatusBar />
      <div className={s.chatHead}>
        <ArrowLeft size={24} strokeWidth={2} />
        <span className={s.chatAvatar} style={{ background: "#e6f4ea", color: "#1f7a3a" }}>M</span>
        <span className={s.chatWho}>
          <span className={s.chatName}>Marco</span>
          <span className={`${s.chatSub} ${s.mono}`}>0x91c4…08bd</span>
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
          Logo files by Friday. Half now, half on delivery?<span className={s.time}>09:12</span>
        </div>
        <div className={`${s.msgOut} ${at(p, 0.08)}`}>
          Deal. I will lock it in escrow so you know it is there.
          <span className={s.time}>
            09:13 <CheckCheck size={15} strokeWidth={2.2} />
          </span>
        </div>

        <div className={`${s.ledgerInvoiceCard} ${at(p, 0.18)}`}>
          <div className={s.invTop}>
            <span className={s.invDocTag}>
              <Lock size={14} strokeWidth={2.2} />
              Private agreement
            </span>
            <span className={`${s.invStatusTag} ${released || locked ? s.invStatusPaid : proving ? s.invStatusProving : s.invStatusUnpaid}`}>
              <span className={s.invDot} />
              {status}
            </span>
          </div>
          <div className={s.invTitle}>Escrow · logo design</div>
          <div className={s.invParties}>To Marco · Aztec address verified</div>
          <div className={s.invItemRow}>
            <span>Released on delivery</span>
            <span className={s.num}>300.00</span>
          </div>
          <div className={s.invDivider} />
          <div className={s.invTotalRow}>
            <span>Amount</span>
            <span className={`${s.invTotalVal} ${s.num}`}>300.00 HLC</span>
          </div>
          <div className={s.invFooterRow}>
            <span className={s.invDue}>Aztec Alpha · mainnet</span>
            <span className={`${s.invActionBtn} ${released ? s.invActionDone : ""}`}>
              {released ? (
                <span className={s.invBtnInner}><Check size={14} strokeWidth={2.6} /> Released</span>
              ) : proving ? (
                <span className={s.invBtnInner}><span className={s.spinner} /> Making proof</span>
              ) : locked ? (
                "Release"
              ) : (
                "Fund"
              )}
            </span>
          </div>
        </div>

        <div className={`${s.msgIn} ${at(p, 0.66)}`}>
          Files are in the shared folder.<span className={s.time}>17:40</span>
        </div>
        <div className={`${s.msgOut} ${at(p, 0.86)}`}>
          Perfect. Released.
          <span className={s.time}>
            17:42 <CheckCheck size={15} strokeWidth={2.2} />
          </span>
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
        <span className={s.commManage}>Manage</span>
      </div>
      <div className={s.commNote}>People in this community can read what you write here. It is not a private conversation.</div>
      <div className={s.commList}>
        <div className={`${s.pinCard} ${s.in}`}>
          <span className={s.pinTag}>Marta</span>
          <span className={s.pinText}>Weekly call moves to Thursday 17:00 CET.</span>
        </div>
        <div className={`${s.pinCard} ${at(p, 0.15)}`}>
          <span className={s.pinTag}>Ana</span>
          <span className={s.pinText}>Notes from the last call are in the group folder.</span>
        </div>
        <div className={`${s.pinCard} ${at(p, 0.45)}`}>
          <span className={s.pinTag}>You</span>
          <span className={s.pinText}>Thursday works for me.</span>
        </div>
      </div>
      <div className={s.commField}>
        <span className={s.commFieldText}>Write your message here</span>
        <span className={s.commSend}>Send</span>
      </div>
    </div>
  );
}

/* ── Shared pieces for the newer screens (inline styles keep them self-contained) ── */

const INKC = "#0b0c0e";
const MUTED = "#6b7280";
const LINE = "#eceef2";
const fade = (p: number, from: number): React.CSSProperties => ({
  opacity: p >= from ? 1 : 0,
  transform: p >= from ? "none" : "translateY(10px)",
  transition: "opacity 420ms ease, transform 520ms cubic-bezier(0.16,1,0.3,1)",
});

/* ── 6. Private wallet ──────────────────────────────────────────────── */

export function WalletScreen({ p }: ScreenProps) {
  const rows: [string, string][] = [
    ["Fee Juice", "31.42"],
    ["Next fee paid from", "Your Fee Juice"],
    ["Proofs", "Made on this iPhone"],
  ];
  const activity: [string, string, string][] = [
    ["Sent to Maya", "−25.00 HLC", "Settled"],
    ["Received from Leo", "+120.00 HLC", "Settled"],
    ["Account created", "", "Block 48,211"],
  ];
  return (
    <div className={s.screenLight} style={{ background: "#f4f5f7" }}>
      <StatusBar />
      <div style={{ background: "#fff", padding: "18px 26px 24px", borderBottom: `1px solid ${LINE}` }}>
        <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-0.02em", color: INKC }}>Private wallet</div>
        <div style={{ fontSize: 15, color: MUTED, marginTop: 4 }}>Aztec Alpha on Ethereum mainnet</div>
        <div style={{ fontSize: 15, color: "#8a909c", marginTop: 26 }}>Private balance</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4, ...fade(p, 0.05) }}>
          <span style={{ fontSize: 54, fontWeight: 600, letterSpacing: "-0.04em", color: INKC, fontVariantNumeric: "tabular-nums" }}>1,245.00</span>
          <span style={{ fontSize: 19, color: MUTED, fontWeight: 500 }}>HLC</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 22 }}>
          {["Send", "Receive", "Add funds"].map((l, i) => (
            <span key={l} style={{ height: 52, borderRadius: 26, display: "grid", placeItems: "center", fontSize: 17, fontWeight: 600, background: i === 0 ? INKC : "#f2f4f7", color: i === 0 ? "#fff" : INKC }}>{l}</span>
          ))}
        </div>
      </div>
      <div style={{ padding: "18px 18px 0", display: "grid", gap: 14 }}>
        <div style={{ background: "#fff", borderRadius: 22, border: `1px solid ${LINE}`, padding: "6px 20px", ...fade(p, 0.25) }}>
          {rows.map(([k, v], i) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "15px 0", borderTop: i ? `1px solid ${LINE}` : "none", fontSize: 16.5 }}>
              <span style={{ color: MUTED }}>{k}</span>
              <span style={{ color: INKC, fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ background: "#fff", borderRadius: 22, border: `1px solid ${LINE}`, padding: "14px 20px 6px", ...fade(p, 0.45) }}>
          <div style={{ fontSize: 15, color: "#8a909c", marginBottom: 4 }}>Activity</div>
          {activity.map(([a, b, c], i) => (
            <div key={a} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderTop: i ? `1px solid ${LINE}` : "none" }}>
              <span>
                <span style={{ display: "block", fontSize: 16.5, color: INKC, fontWeight: 500 }}>{a}</span>
                <span style={{ display: "block", fontSize: 14, color: MUTED, marginTop: 2 }}>{c}</span>
              </span>
              <span style={{ fontSize: 16.5, fontWeight: 600, color: INKC, fontVariantNumeric: "tabular-nums" }}>{b}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 7. Make it yours: themes, wallpapers, bubbles (the real catalogue) ─ */

const LOOKS: [string, string, string][] = [
  ["midnight", "nebula", "aurora"],
  ["default", "scene-dawn-peaks", "tail"],
  ["rose", "candy", "glass"],
  ["synthwave", "scene-city", "glow"],
  ["forest", "doodle-mint", "gradient"],
];

export function ThemesScreen({ p }: ScreenProps) {
  const pick = Math.min(LOOKS.length - 1, Math.floor(p * LOOKS.length));
  const [themeId, wallId, bubble] = LOOKS[pick];
  const theme = CHAT_THEMES.find((t) => t.id === themeId) ?? CHAT_THEMES[0];
  const wall = resolveWallpaper(wallId);
  const tone = wall && wall.id !== "default" ? wall.tone : theme.dark ? "dark" : "light";
  const msg: React.CSSProperties = { maxWidth: "78%", padding: "13px 18px", fontSize: 18, lineHeight: 1.35 };
  return (
    <div
      className={s.screenLight}
      data-chat-theme={theme.id}
      data-wallpaper-tone={tone}
      style={{ ...(chatThemeVars(theme) as unknown as React.CSSProperties), ...canvasCss(wall, theme.canvas), transition: "background-color 500ms ease" }}
    >
      <StatusBar dark={tone === "dark"} />
      <div style={{ padding: "8px 26px 0", color: tone === "dark" ? "#fff" : INKC, textShadow: tone === "dark" ? "0 1px 3px rgba(0,0,0,.4)" : "none" }}>
        <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-0.02em" }}>Leo</div>
        <div style={{ fontSize: 14.5, opacity: 0.7 }}>{theme.label} · {wall?.label} · {BUBBLE_STYLES.find((b) => b.id === bubble)?.label}</div>
      </div>
      <div key={pick} style={{ padding: "30px 22px 0", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className={bubbleClasses(bubble, false)} style={{ ...msg, alignSelf: "flex-start" }}>Dinner at 9?</div>
        <div className={bubbleClasses(bubble, true)} style={{ ...msg, alignSelf: "flex-end" }}>Perfect. I’ll book.</div>
        <div className={bubbleClasses(bubble, false)} style={{ ...msg, alignSelf: "flex-start" }}>Your theme looks great.</div>
      </div>
      <div style={{ position: "absolute", left: 16, right: 16, bottom: 40, background: "#fff", borderRadius: 30, padding: "20px 22px 22px", boxShadow: "0 20px 50px -20px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", gap: 8, padding: 4, borderRadius: 999, background: "#f2f4f7", fontSize: 15, fontWeight: 600 }}>
          {["Theme", "Wallpaper", "Bubbles"].map((t, i) => (
            <span key={t} style={{ flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 999, background: i === pick % 3 ? "#fff" : "transparent", color: i === pick % 3 ? INKC : MUTED, boxShadow: i === pick % 3 ? "0 1px 3px rgba(16,24,40,.14)" : "none" }}>{t}</span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          {LOOKS.map(([t, w], i) => {
            const th = CHAT_THEMES.find((x) => x.id === t) ?? CHAT_THEMES[0];
            return <span key={t} style={{ flex: 1, height: 64, borderRadius: 14, ...canvasCss(resolveWallpaper(w), th.canvas), boxShadow: i === pick ? `0 0 0 3px #fff, 0 0 0 5px ${INKC}` : "inset 0 0 0 1px rgba(0,0,0,.08)", transition: "box-shadow 300ms" }} />;
          })}
        </div>
        <div style={{ marginTop: 16, fontSize: 15.5, color: MUTED }}>
          {CHAT_THEMES.length} themes · {WALLPAPERS.length - 1} wallpapers · {BUBBLE_STYLES.length} bubble styles
        </div>
      </div>
    </div>
  );
}

/* ── 7b. Stickers that take over the chat ──────────────────────────── */

const SPLATS: [number, number, number][] = [[215, 470, 1], [90, 300, 0.55], [340, 260, 0.62], [120, 640, 0.5], [330, 700, 0.58]];

function Splat({ x, y, k, on }: { x: number; y: number; k: number; on: boolean }) {
  return (
    <svg width={220 * k} height={300 * k} viewBox="0 0 200 270" style={{ position: "absolute", left: x - 110 * k, top: y - 110 * k, transform: on ? "scale(1)" : "scale(0.2)", opacity: on ? 1 : 0, transition: "transform 420ms cubic-bezier(.3,1.5,.5,1), opacity 200ms", filter: "drop-shadow(0 6px 8px rgba(0,0,0,.22))" }} aria-hidden="true">
      <defs>
        <radialGradient id={`sp${x}`} cx="40%" cy="30%" r="80%"><stop offset="0" stopColor="#b8fbe2" /><stop offset=".5" stopColor="#2fd3a2" /><stop offset="1" stopColor="#0f8f6c" /></radialGradient>
      </defs>
      <path d="M100 30c22 0 30 18 48 22 20 4 34 22 26 42-6 16 8 30-6 44-14 14-30 6-44 16-14 10-26 24-44 12-18-12-12-28-28-38-16-10-34-20-26-40 8-20 26-18 34-34 10-18 18-24 40-24Z" fill={`url(#sp${x})`} />
      <path d="M78 150v70a9 9 0 0 0 18 0v-62zM122 148v40a7 7 0 0 0 14 0v-36z" fill={`url(#sp${x})`} />
      <circle cx="170" cy="40" r="9" fill={`url(#sp${x})`} />
      <circle cx="24" cy="70" r="7" fill={`url(#sp${x})`} />
      <ellipse cx="78" cy="62" rx="18" ry="9" fill="#fff" opacity=".55" transform="rotate(-30 78 62)" />
    </svg>
  );
}

export function StickerScreen({ p }: ScreenProps) {
  const pickerOpen = p < 0.32;
  const flying = p >= 0.32 && p < 0.44;
  const splatted = p >= 0.44;
  const pack = STICKER_PACKS.find((x) => x.id === "lumi") ?? STICKER_PACKS[0];
  const theme = CHAT_THEMES.find((t) => t.id === "midnight") ?? CHAT_THEMES[0];
  return (
    <div className={s.screenLight} data-chat-theme={theme.id} data-wallpaper-tone="dark" style={{ ...(chatThemeVars(theme) as unknown as React.CSSProperties), ...canvasCss(resolveWallpaper("nebula"), theme.canvas) }}>
      <StatusBar dark />
      <div style={{ padding: "8px 26px 0", color: "#fff" }}>
        <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-0.02em" }}>Mia</div>
        <div style={{ fontSize: 14.5, opacity: 0.7 }}>online</div>
      </div>
      <div style={{ padding: "26px 22px 0", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className={bubbleClasses("aurora", false)} style={{ alignSelf: "flex-start", maxWidth: "78%", padding: "13px 18px", fontSize: 18 }}>We did it!! 🎉</div>
        <div className={bubbleClasses("aurora", true)} style={{ alignSelf: "flex-end", maxWidth: "78%", padding: "13px 18px", fontSize: 18 }}>This needs a sticker.</div>
      </div>
      {SPLATS.map(([x, y, k], i) => <Splat key={i} x={x} y={y} k={k} on={splatted && p < 0.96} />)}
      <img
        src={stickerFile(pack.id, "splash")}
        alt=""
        style={{ position: "absolute", left: 215 - 130, top: 470 - 130, width: 260, height: 260, transform: flying ? "scale(1.9) rotate(-10deg)" : splatted ? "scale(1)" : "scale(0.3)", opacity: flying || splatted ? 1 : 0, transition: "transform 380ms cubic-bezier(.5,0,.9,.4), opacity 200ms", filter: "drop-shadow(0 20px 26px rgba(0,0,0,.4))" }}
      />
      <div style={{ position: "absolute", left: 12, right: 12, bottom: 30, background: "#fff", borderRadius: 30, padding: "16px 16px 18px", boxShadow: "0 20px 50px -20px rgba(0,0,0,0.45)", transform: pickerOpen ? "translateY(0)" : "translateY(120%)", transition: "transform 380ms cubic-bezier(.2,.8,.3,1)" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {STICKER_PACKS.map((pk) => (
            <img key={pk.id} src={stickerFile(pk.id, pk.cover)} alt="" style={{ width: 44, height: 44, borderRadius: 14, background: pk.id === pack.id ? "#f2f4f7" : "transparent", boxShadow: pk.id === pack.id ? `inset 0 0 0 2px ${INKC}` : "none", padding: 3 }} />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {pack.stickers.slice(0, 8).map((st) => (
            <img key={st.id} src={stickerFile(pack.id, st.id)} alt="" style={{ width: "100%", aspectRatio: "1", borderRadius: 16, background: st.id === "splash" && p > 0.2 ? "#f2f4f7" : "transparent" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 8. Ledger Studio: build an app inside the chat ────────────────── */

export function StudioScreen({ p }: ScreenProps) {
  const built = p >= 0.4;
  return (
    <div className={s.screenLight}>
      <StatusBar />
      <div style={{ padding: "8px 26px 14px", borderBottom: `1px solid ${LINE}` }}>
        <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-0.02em", color: INKC }}>Ledger Studio</div>
        <div style={{ fontSize: 14.5, color: MUTED }}>Build it where you talk</div>
      </div>
      <div style={{ padding: "18px 20px 0", display: "grid", gap: 12 }}>
        <div style={{ justifySelf: "end", maxWidth: "84%", padding: "14px 18px", borderRadius: 24, background: INKC, color: "#fff", fontSize: 17.5, ...fade(p, 0.02) }}>
          Make a page for my café with the menu.
        </div>
        <div style={{ justifySelf: "start", fontSize: 15, color: MUTED, ...fade(p, 0.18) }}>{built ? "Built" : "Building…"}</div>
      </div>
      <div style={{ margin: "14px 20px 0", borderRadius: 26, border: `1px solid ${LINE}`, overflow: "hidden", background: "#faf8f4", ...fade(p, 0.4) }}>
        <div style={{ padding: "26px 24px 10px" }}>
          <div style={{ fontSize: 13.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8a7f6c" }}>Since 2019</div>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em", color: "#1d1a14", marginTop: 6 }}>Café Aurora</div>
        </div>
        {[["Flat white", "3.20"], ["Croissant", "2.80"], ["Cold brew", "3.90"]].map(([n, v], i) => (
          <div key={n} style={{ display: "flex", justifyContent: "space-between", padding: "15px 24px", borderTop: i === 0 ? "none" : "1px solid #ece6da", fontSize: 18, color: "#1d1a14" }}>
            <span>{n}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{v} HLC</span>
          </div>
        ))}
        <div style={{ padding: "16px 24px 24px" }}>
          <span style={{ display: "grid", placeItems: "center", height: 54, borderRadius: 27, background: "#1d1a14", color: "#fff", fontSize: 17.5, fontWeight: 600 }}>Share the menu</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, padding: "16px 20px 0", ...fade(p, 0.7) }}>
        {["Publish", "Send in chat", "Edit"].map((l, i) => (
          <span key={l} style={{ flex: 1, height: 48, borderRadius: 24, display: "grid", placeItems: "center", fontSize: 16, fontWeight: 600, background: i === 0 ? INKC : "#f2f4f7", color: i === 0 ? "#fff" : INKC }}>{l}</span>
        ))}
      </div>
    </div>
  );
}
