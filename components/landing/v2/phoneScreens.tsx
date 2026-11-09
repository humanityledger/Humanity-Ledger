"use client";

/**
 * The Ledger Chat screens shown inside the iPhone photographs and CSS frames
 * on the landing page. Each screen is laid out on a 410 x 912 canvas (an iPhone 15 Pro
 * at 1x plus room) and receives `p`, its progress from 0 to 1, from the scroll position.
 */

import React from "react";
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  FileSignature,
  FileText,
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

/* ── 3. Video call (Realistic Portrait without vector puppet) ──────── */

export function VideoCallScreen({ p, active }: ScreenProps) {
  return (
    <div className={`${s.screenVideo} ${active ? s.videoLive : ""}`}>
      {/* Remote camera: realistic warm photographic video portrait */}
      <div className={s.remote} aria-hidden="true">
        <div className={s.photoPortraitBg} />
        <div className={s.photoPortraitSubject}>
          {/* Hair & head volume */}
          <div className={s.portraitHairBack} />
          <div className={s.portraitNeck} />
          <div className={s.portraitHead} />
          <div className={s.portraitHairFront} />
          {/* Torso & clothing */}
          <div className={s.portraitShoulders} />
        </div>
        <span className={s.bokeh} />
        <span className={s.bokeh2} />
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
        <div className={s.selfCam}>
          <div className={s.selfPerson} />
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

/* ── 4. Private payment / Native Invoice (Exact Ledger Chat Design) ── */

export function PaymentScreen({ p }: ScreenProps) {
  const settled = p >= 0.65;
  return (
    <div className={s.screenLight}>
      <StatusBar />
      <div className={s.chatHead}>
        <ArrowLeft size={24} strokeWidth={2} />
        <span className={s.chatAvatar} style={{ background: "#fef0e6", color: "#b94b15" }}>81</span>
        <span className={s.chatWho}>
          <span className={s.chatName}>0x812d…d1ea</span>
          <span className={s.chatSub}>0x812d…d1ea</span>
        </span>
        <Phone size={22} strokeWidth={1.9} />
        <Video size={24} strokeWidth={1.9} />
      </div>
      <div className={s.chatBody} style={{ background: "#fff5ed" }}>
        <span className={s.e2ee}>
          <Lock size={13} strokeWidth={2.2} />
          Messages are end to end encrypted. Tap for details
        </span>
        <div className={`${s.msgIn} ${s.in}`} style={{ background: "#fff", color: "#15171c" }}>
          Just paid the reservation so we wouldn't lose it.
          <span className={s.time}>13:20</span>
        </div>
        <div className={`${s.msgOut} ${s.in}`} style={{ background: "#111318", color: "#fff" }}>
          Legend 🙌 How do I send you my half?
          <span className={s.time}>13:20</span>
        </div>
        <div className={`${s.msgIn} ${s.in}`} style={{ background: "#fff", color: "#15171c" }}>
          Let me create an invoice right here in Ledger Chat.
          <span className={s.time}>13:20</span>
        </div>
        <div className={`${s.msgOut} ${s.in}`} style={{ background: "#111318", color: "#fff" }}>
          Sweet, send it over.
          <span className={s.time}>13:20</span>
        </div>

        {/* The Exact Invoice Card from Ledger Chat Screenshots */}
        <div className={`${s.ledgerInvoiceCard} ${s.in}`}>
          <div className={s.invTop}>
            <span className={s.invDocTag}>
              <FileText size={14} strokeWidth={2.2} />
              Invoice INV-2026-6638
            </span>
            <span className={`${s.invStatusTag} ${settled ? s.invStatusPaid : s.invStatusUnpaid}`}>
              <span className={s.invDot} />
              {settled ? "Paid" : "Unpaid"}
            </span>
          </div>
          <div className={s.invTitle}>Cabin Rental Weekend Split</div>
          <div className={s.invParties}>From zk:812daF to zk:0xF207…2A8e</div>
          <div className={s.invItemRow}>
            <span>Aztec zk.money Native Chat Integ…</span>
            <span>140.00</span>
          </div>
          <div className={s.invDivider} />
          <div className={s.invTotalRow}>
            <span>Total</span>
            <span className={s.invTotalVal}>140.00 USDC</span>
          </div>
          <div className={s.invFooterRow}>
            <span className={s.invDue}>Due 22/11/2026</span>
            <span className={`${s.invActionBtn} ${settled ? s.invActionDone : ""}`}>
              {settled ? "View" : "Pay Invoice"}
            </span>
          </div>
          <span className={s.invReaction}>❤️</span>
        </div>

        <div className={`${s.msgOut} ${at(p, 0.45)}`} style={{ background: "#111318", color: "#fff" }}>
          So who's driving on Friday?
          <span className={s.time}>13:23</span>
        </div>
        <div className={`${s.msgIn} ${at(p, 0.7)}`} style={{ background: "#fff", color: "#15171c" }}>
          My car is getting serviced, can we take yours?
          <span className={s.time}>13:23</span>
        </div>
        <div className={`${s.msgOut} ${at(p, 0.85)}`} style={{ background: "#111318", color: "#fff" }}>
          Sure, my trunk has plenty of room for our bags
          <span className={s.time}>13:24</span>
        </div>
      </div>
      <Composer />
    </div>
  );
}

/* ── 5. Communities Showcase Screen ────────────────────────────────── */

export function CommunitiesScreen({ p }: ScreenProps) {
  return (
    <div className={s.screenLight}>
      <StatusBar />
      <div className={s.commHead}>
        <span className={s.commTitle}>Communities</span>
        <span className={s.commAction}>
          <Plus size={20} strokeWidth={2.2} />
        </span>
      </div>
      <div className={s.commList}>
        <div className={`${s.commItem} ${s.in}`}>
          <div className={s.commAvatar} style={{ background: "#5200ff", color: "#fff" }}>
            HL
          </div>
          <div className={s.commMeta}>
            <div className={s.commNameRow}>
              <span className={s.commName}>Humanity Core Network</span>
              <span className={s.commBadge}>
                <Lock size={11} strokeWidth={2} /> Encrypted
              </span>
            </div>
            <div className={s.commSub}>2,410 members • 12 online</div>
            <div className={s.commLastMsg}>Protocol upgrade deployed to Aztec rollup…</div>
          </div>
        </div>
        <div className={`${s.commItem} ${at(p, 0.25)}`}>
          <div className={s.commAvatar} style={{ background: "#10b981", color: "#fff" }}>
            ZK
          </div>
          <div className={s.commMeta}>
            <div className={s.commNameRow}>
              <span className={s.commName}>Zero-Knowledge Builders</span>
              <span className={s.commBadge}>
                <Lock size={11} strokeWidth={2} /> Encrypted
              </span>
            </div>
            <div className={s.commSub}>840 members • 5 online</div>
            <div className={s.commLastMsg}>Client-side proving in WASM running at 120ms…</div>
          </div>
        </div>
        <div className={`${s.commItem} ${at(p, 0.55)}`}>
          <div className={s.commAvatar} style={{ background: "#f59e0b", color: "#fff" }}>
            DF
          </div>
          <div className={s.commMeta}>
            <div className={s.commNameRow}>
              <span className={s.commName}>Private DeFi Alliance</span>
              <span className={s.commBadge}>
                <Lock size={11} strokeWidth={2} /> Encrypted
              </span>
            </div>
            <div className={s.commSub}>3,120 members • 48 online</div>
            <div className={s.commLastMsg}>USDC private settlement volume hit $14M…</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 6. Smart Agreement Screen ─────────────────────────────────────── */

export function AgreementScreen({ p }: ScreenProps) {
  const signed = p >= 0.5;
  return (
    <div className={s.screenLight}>
      <StatusBar />
      <ChatHeader name="Irina Vlad" initials="IV" sub="online" />
      <div className={s.chatBody}>
        <span className={s.e2ee}>
          <Lock size={13} strokeWidth={2.2} />
          Messages are end to end encrypted
        </span>
        <div className={`${s.msgIn} ${s.in}`}>
          I've drawn up our mutual terms. Review and sign when you are ready.
          <span className={s.time}>16:10</span>
        </div>
        <div className={`${s.agreementCard} ${s.in}`}>
          <div className={s.agTop}>
            <span className={s.agTag}>
              <ShieldCheck size={14} /> Smart Agreement
            </span>
            <span className={`${s.agStatus} ${signed ? s.agSigned : s.agPending}`}>
              {signed ? "Signed on-chain ✓" : "Pending signature"}
            </span>
          </div>
          <div className={s.agTitle}>Software Consulting Agreement Q4</div>
          <div className={s.agParties}>
            <div>
              <span>Party A:</span> 0xA4f2…9C1b (You)
            </div>
            <div>
              <span>Party B:</span> 0x812d…d1ea (Client)
            </div>
          </div>
          <div className={s.agDigest}>Digest: 0x7a89…4e21 (Poseidon Hash)</div>
          <div className={s.agBtn}>
            {signed ? "View Aztec Proof Hash" : "Sign with Wallet"}
          </div>
        </div>
        <div className={`${s.msgOut} ${at(p, 0.6)}`}>
          Signed directly from my wallet! The proof is verifiable on-chain.
          <span className={s.time}>
            16:12 <CheckCheck size={15} strokeWidth={2.2} />
          </span>
        </div>
      </div>
      <Composer />
    </div>
  );
}

/* ── 7. Invoice Settled Details Screen ─────────────────────────────── */

export function InvoicePaidScreen({ p }: ScreenProps) {
  return (
    <div className={s.screenLight}>
      <StatusBar />
      <div className={s.invDetailHead}>
        <ArrowLeft size={22} />
        <span>Invoice Details</span>
        <span style={{ width: 22 }} />
      </div>
      <div className={s.invDetailCard}>
        <div className={s.invSuccessBadge}>
          <Check size={28} strokeWidth={2.5} />
        </div>
        <div className={s.invDetailAmount}>140.00 USDC</div>
        <div className={s.invDetailStatus}>Payment Settled On-Chain</div>
        <div className={s.invDetailRows}>
          <div className={s.invRow}>
            <span>Invoice ID</span>
            <span>INV-2026-6638</span>
          </div>
          <div className={s.invRow}>
            <span>Recipient</span>
            <span>0x812d…d1ea</span>
          </div>
          <div className={s.invRow}>
            <span>Payer</span>
            <span>0xF207…2A8e</span>
          </div>
          <div className={s.invRow}>
            <span>Network</span>
            <span>Ethereum / Aztec</span>
          </div>
          <div className={s.invRow}>
            <span>Transaction</span>
            <span className={s.invHash}>0x4e8a…9c1f</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 8. Updates & Notifications Feed Screen ────────────────────────── */

export function UpdatesScreen({ p }: ScreenProps) {
  return (
    <div className={s.screenLight}>
      <StatusBar />
      <div className={s.commHead}>
        <span className={s.commTitle}>Updates</span>
        <span className={s.commAction}>
          <Bell size={20} strokeWidth={2} />
        </span>
      </div>
      <div className={s.updatesList}>
        <div className={`${s.updateItem} ${s.in}`}>
          <span className={s.updateDot} style={{ background: "#10b981" }} />
          <div className={s.updateContent}>
            <div className={s.updateTitle}>Payment Received: 140.00 USDC</div>
            <div className={s.updateSub}>From 0x812d…d1ea for Cabin Rental Split</div>
            <div className={s.updateTime}>2 minutes ago • Confirmed</div>
          </div>
        </div>
        <div className={`${s.updateItem} ${at(p, 0.35)}`}>
          <span className={s.updateDot} style={{ background: "#5200ff" }} />
          <div className={s.updateContent}>
            <div className={s.updateTitle}>Smart Agreement Signed</div>
            <div className={s.updateSub}>Irina Vlad countersigned Consulting Q4</div>
            <div className={s.updateTime}>1 hour ago • Verified on-chain</div>
          </div>
        </div>
        <div className={`${s.updateItem} ${at(p, 0.7)}`}>
          <span className={s.updateDot} style={{ background: "#3b82f6" }} />
          <div className={s.updateContent}>
            <div className={s.updateTitle}>Identity Credential Anchored</div>
            <div className={s.updateSub}>Depth-32 Merkle Tree leaf updated</div>
            <div className={s.updateTime}>3 hours ago • Zero-Knowledge proof ready</div>
          </div>
        </div>
      </div>
    </div>
  );
}
