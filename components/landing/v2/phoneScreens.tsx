"use client";

/**
 * The Ledger Chat screens shown inside the iPhone photographs on the landing
 * page. Each screen is laid out on a 410 x 912 canvas (an iPhone 15 Pro at
 * 1x plus a little room) and receives `p`, its progress from 0 to 1, from the
 * scroll position: messages arrive, a call timer runs and a payment is sent
 * as the visitor scrolls.
 *
 * The screens follow the real product: the light chat interface, the dark call
 * screens, and private payments labelled as the Aztec test network.
 */

import React from "react";
import {
  ArrowLeft,
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
      <span className={s.island} aria-hidden="true" />
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

function clock(sec: number) {
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function VoiceCallScreen({ p, active }: ScreenProps) {
  const connected = p >= 0.12;
  return (
    <div className={s.screenDark}>
      <StatusBar dark />
      <div className={s.callTop}>
        <span className={s.callBadge}>
          <Lock size={13} strokeWidth={2.2} />
          Encrypted call
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

/* ── 3. Video call ─────────────────────────────────────────────────── */

export function VideoCallScreen({ p, active }: ScreenProps) {
  return (
    <div className={`${s.screenVideo} ${active ? s.videoLive : ""}`}>
      {/* The remote camera: an illustration, not a photograph of a person. */}
      <div className={s.remote} aria-hidden="true">
        <span className={s.bokeh} />
        <span className={s.bokeh2} />
        <svg className={s.figure} viewBox="0 0 410 600" preserveAspectRatio="xMidYMax slice">
          <defs>
            <linearGradient id="hlSkin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#59606c" />
              <stop offset="1" stopColor="#3c414b" />
            </linearGradient>
            <linearGradient id="hlKnit" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#2f343d" />
              <stop offset="1" stopColor="#15181d" />
            </linearGradient>
          </defs>
          <path d="M40 600c8-120 70-178 165-178s157 58 165 178Z" fill="url(#hlKnit)" />
          <rect x="178" y="330" width="54" height="80" rx="24" fill="url(#hlSkin)" />
          <ellipse cx="205" cy="268" rx="82" ry="98" fill="url(#hlSkin)" />
          <path d="M122 250c-2-78 44-120 92-118 52 2 86 40 80 112-14-40-46-62-86-64-40 0-72 26-86 70Z" fill="#1b1e24" />
          <path d="M287 230c8 40 2 82-16 110M60 560c10-80 50-128 120-140" fill="none" stroke="#f3e2c9" strokeOpacity="0.45" strokeWidth="5" strokeLinecap="round" />
        </svg>
      </div>
      <StatusBar dark />
      <div className={s.videoTop}>
        <span className={s.videoName}>Marco Rossi</span>
        <span className={s.videoMeta}>{clock(12 + Math.floor(p * 80))}</span>
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
        <svg viewBox="0 0 120 160" preserveAspectRatio="xMidYMax slice">
          <rect width="120" height="160" fill="#cfd4dc" />
          <path d="M8 160c3-34 22-52 52-52s49 18 52 52Z" fill="#3f4652" />
          <rect x="51" y="88" width="18" height="26" rx="8" fill="#545b68" />
          <ellipse cx="60" cy="70" rx="25" ry="30" fill="#545b68" />
          <path d="M34 66c0-26 13-38 27-38 17 0 28 12 26 36-6-12-15-18-27-18-12 0-21 8-26 20Z" fill="#2f343d" />
        </svg>
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

/* ── 4. Private payment ────────────────────────────────────────────── */

export function PaymentScreen({ p }: ScreenProps) {
  const amount = "42.00";
  const typed = amount.slice(0, Math.max(1, Math.min(amount.length, Math.floor(p * 12))));
  const pressed = p >= 0.58 && p < 0.7;
  const sent = p >= 0.7;
  const settled = p >= 0.86;
  return (
    <div className={s.screenLight}>
      <StatusBar />
      <ChatHeader name="Marco Rossi" initials="MR" sub="online" />
      <div className={`${s.chatBody} ${s.chatBodyPay}`}>
        <span className={s.day}>Yesterday</span>
        <div className={`${s.msgIn} ${s.in}`}>
          Thanks for dinner! What do I owe you?<span className={s.time}>22:14</span>
        </div>
        <div className={`${s.msgOut} ${s.in}`}>
          42, whenever you can.
          <span className={s.time}>
            22:15 <CheckCheck size={15} strokeWidth={2.2} />
          </span>
        </div>
        <span className={s.day}>Today</span>
        <div className={`${s.payCard} ${sent ? s.in : s.gone}`}>
          <span className={s.payTop}>
            <ShieldCheck size={18} strokeWidth={2} />
            Private payment
          </span>
          <span className={s.payAmount}>42.00 zkUSDC</span>
          <span className={s.payRow}>
            {settled ? (
              <>
                <Check size={15} strokeWidth={2.6} /> Settled on the Aztec test network
              </>
            ) : (
              <>
                <span className={s.spinner} /> Proving on this device
              </>
            )}
          </span>
        </div>
      </div>
      <Composer />

      <div className={`${s.sheet} ${sent ? s.sheetDown : ""}`}>
        <span className={s.grabber} />
        <span className={s.sheetTitle}>Send privately</span>
        <span className={s.sheetTo}>To Marco Rossi</span>
        <span className={s.sheetAmount}>
          {typed}
          <span className={s.caret} />
          <span className={s.sheetUnit}>zkUSDC</span>
        </span>
        <span className={s.sheetNote}>
          <Lock size={14} strokeWidth={2.2} />
          The amount and the recipient stay private. Test tokens on the Aztec test network.
        </span>
        <span className={`${s.sheetBtn} ${pressed ? s.sheetBtnPressed : ""}`}>Send privately</span>
        <span className={s.sheetBal}>Private balance 118.40 zkUSDC</span>
      </div>
    </div>
  );
}
