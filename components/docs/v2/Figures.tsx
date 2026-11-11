import React from "react";
import { Blocks, Bot, Fuel, KeyRound, Laptop, MessageSquare, Server, Smartphone, type LucideIcon } from "lucide-react";
import type { FeatureState, FigureKind } from "@/lib/docs/types";
import s from "./Docs.module.css";

/**
 * Diagrams for the documentation, built from HTML and CSS rather than drawn
 * as images, so they stay sharp, readable at any size, searchable and easy
 * to correct. Icons come from lucide.
 */

function Node({
  icon: Icon,
  title,
  items,
  you,
}: {
  icon: LucideIcon;
  title: string;
  items: string[];
  you?: boolean;
}) {
  return (
    <div className={`${s.node} ${you ? s.nodeYou : ""}`}>
      <div className={s.nodeHead}>
        <span className={s.nodeIcon} aria-hidden="true">
          <Icon size={16} strokeWidth={1.75} />
        </span>
        {title}
      </div>
      <ul className={s.nodeItems}>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

function Architecture() {
  return (
    <div className={s.arch}>
      <div className={s.archTop}>
        <Node
          icon={Laptop}
          title="Your device"
          you
          items={["Ledger Chat in your browser", "Message keys and history", "Your wallet, which signs"]}
        />
      </div>
      <div className={s.archStem} aria-hidden="true" />
      <div className={s.archCols}>
        <div className={s.archCol}>
          <div className={s.archDrop}>
            <span className={s.archLabel}>Accounts and communities</span>
          </div>
          <Node
            icon={Server}
            title="Humanity Ledger servers"
            items={["Sign in and sessions", "Profiles and contacts", "Communities", "Fallback relay, readable"]}
          />
        </div>
        <div className={s.archCol}>
          <div className={s.archDrop}>
            <span className={s.archLabel}>Encrypted messages</span>
          </div>
          <Node icon={MessageSquare} title="XMTP network" items={["Stores encrypted messages", "Cannot read them"]} />
        </div>
        <div className={s.archCol}>
          <div className={s.archDrop}>
            <span className={s.archLabel}>Payments you sign</span>
          </div>
          <Node icon={Blocks} title="Blockchains" items={["Ethereum and layer 2 networks", "Aztec, experimental"]} />
        </div>
      </div>
    </div>
  );
}

function Arrow({ label, dashed }: { label: string; dashed?: boolean }) {
  return (
    <div className={s.arrow}>
      <span>{label}</span>
      <span className={`${s.arrowLine} ${dashed ? s.arrowDashed : ""}`} aria-hidden="true" />
    </div>
  );
}

function MessagePath() {
  return (
    <div className={s.path}>
      <p className={s.laneTitle}>Normal path</p>
      <div className={s.pathRow}>
        <Node icon={Laptop} title="Your device" you items={["Encrypts the message"]} />
        <Arrow label="Encrypted" />
        <Node icon={MessageSquare} title="XMTP network" items={["Stores it until collected"]} />
        <Arrow label="Encrypted" />
        <Node icon={Laptop} title="Their device" items={["Decrypts it with its own keys"]} />
      </div>
      <p className={`${s.laneTitle} ${s.laneTitleWarn}`}>Fallback path, only if the normal path fails</p>
      <div className={`${s.pathRow} ${s.pathRowFallback}`}>
        <Node icon={Laptop} title="Your device" items={["Sends the text as written"]} />
        <Arrow label="Readable" dashed />
        <Node icon={Server} title="Our server" items={["Can read it", "Labels it in the chat"]} />
        <Arrow label="Readable" dashed />
        <Node icon={Laptop} title="Their device" items={["Shows the label"]} />
      </div>
    </div>
  );
}

/* ── Ecosystem map: every part of the platform and how ready it is ───────── */

const STATE_TEXT: Record<FeatureState, string> = {
  available: "Live",
  partial: "Experimental",
  development: "In development",
  unavailable: "Not yet",
};

const ECOSYSTEM: { title: string; icon: LucideIcon; items: { name: string; text: string; state: FeatureState }[] }[] = [
  {
    title: "Identity",
    icon: KeyRound,
    items: [
      { name: "Wallet sign-in", text: "EIP-4361, HttpOnly session", state: "available" },
      { name: "Linked devices", text: "Computer linked by QR from the phone", state: "available" },
      { name: "Email accounts", text: "One-time code, no wallet", state: "partial" },
    ],
  },
  {
    title: "Messaging",
    icon: MessageSquare,
    items: [
      { name: "Direct messages", text: "MLS over XMTP, end to end", state: "available" },
      { name: "Communities", text: "Channels and roles, server-side", state: "available" },
      { name: "Calls", text: "WebRTC, peer to peer or relayed", state: "partial" },
    ],
  },
  {
    title: "Value",
    icon: Blocks,
    items: [
      { name: "Wallet payments", text: "EVM transfers you sign", state: "available" },
      { name: "Private wallet", text: "Aztec Alpha, unaudited", state: "partial" },
      { name: "Private agreements", text: "Escrow and streams on Aztec", state: "development" },
    ],
  },
  {
    title: "Studio",
    icon: Bot,
    items: [
      { name: "Chat and artifacts", text: "Open models on Groq, free", state: "available" },
      { name: "Code mode", text: "Workspace tools, no sandbox", state: "available" },
    ],
  },
];

function Ecosystem() {
  return (
    <div className={s.eco}>
      <div className={s.ecoLegend} aria-hidden="true">
        {(["available", "partial", "development"] as FeatureState[]).map((k) => (
          <span key={k} className={s.ecoLegendItem}><span className={`${s.ecoDot} ${s[`ecoDot_${k}`]}`} />{STATE_TEXT[k]}</span>
        ))}
      </div>
      <div className={s.ecoGrid}>
        {ECOSYSTEM.map((g) => (
          <section key={g.title} className={s.ecoGroup} aria-label={g.title}>
            <div className={s.nodeHead}>
              <span className={s.nodeIcon} aria-hidden="true"><g.icon size={16} strokeWidth={1.75} /></span>
              {g.title}
            </div>
            <ul className={s.ecoItems}>
              {g.items.map((it) => (
                <li key={it.name} className={s.ecoItem}>
                  <span className={`${s.ecoDot} ${s[`ecoDot_${it.state}`]}`} aria-hidden="true" />
                  <span className={s.ecoItemBody}>
                    <span className={s.ecoItemName}>{it.name}</span>
                    <span className={s.ecoItemText}>{it.text}</span>
                  </span>
                  <span className={s.srOnly}>{STATE_TEXT[it.state]}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ── Sequences: who does what, in order, between two or three parties ──── */

interface Actor { name: string; icon: LucideIcon; you?: boolean }
interface Step { by: number; to?: number; text: string; note?: string }

function Sequence({ actors, steps }: { actors: Actor[]; steps: Step[] }) {
  return (
    <div className={s.seq} style={{ ["--seq-cols" as string]: actors.length }}>
      <div className={s.seqActors}>
        {actors.map((a) => (
          <div key={a.name} className={`${s.seqActor} ${a.you ? s.nodeYou : ""}`}>
            <span className={s.nodeIcon} aria-hidden="true"><a.icon size={16} strokeWidth={1.75} /></span>
            {a.name}
          </div>
        ))}
      </div>
      <ol className={s.seqSteps}>
        {steps.map((st, i) => {
          const from = st.by;
          const to = st.to ?? st.by;
          const lo = Math.min(from, to);
          const hi = Math.max(from, to);
          return (
            <li key={i} className={s.seqStep}>
              <span className={s.seqNum} aria-hidden="true">{i + 1}</span>
              <div className={s.seqTrack} style={{ gridColumn: `${lo + 2} / ${hi + 3}` }}>
                <div className={`${s.seqBubble} ${from !== to ? s.seqMove : ""} ${to < from ? s.seqLeft : ""}`}>
                  <span className={s.seqWho}>{actors[from].name}{from !== to ? ` → ${actors[to].name}` : ""}</span>
                  <span>{st.text}</span>
                  {st.note && <span className={s.seqNote}>{st.note}</span>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function DeviceLink() {
  return (
    <Sequence
      actors={[{ name: "Computer", icon: Laptop }, { name: "Our server", icon: Server }, { name: "Your phone", icon: Smartphone, you: true }]}
      steps={[
        { by: 0, to: 1, text: "Makes a one-time key pair and shows a QR code with its public key.", note: "The code expires in 4 minutes" },
        { by: 2, text: "You scan it in Settings → Linked devices. The phone shows which computer asks and links nothing until you confirm." },
        { by: 2, to: 1, text: "Sends, encrypted to the computer's key, a claim code and a fresh 256-bit channel key.", note: "The server keeps only ciphertext and the claim's hash" },
        { by: 0, to: 1, text: "Decrypts the claim and trades it for its session, set in HttpOnly cookies." },
        { by: 0, to: 2, text: "Needs a wallet signature: asks the phone over the channel, AES-256-GCM.", note: "The phone shows what it is for; you approve or decline" },
      ]}
    />
  );
}

function PrivatePayment() {
  return (
    <Sequence
      actors={[{ name: "Sender", icon: Smartphone, you: true }, { name: "Aztec Alpha", icon: Blocks }, { name: "Receiver", icon: Smartphone }]}
      steps={[
        { by: 2, to: 0, text: "Announces its Aztec address in the DM, signed with its account key.", note: "G7: the sender verifies the proof before pinning it" },
        { by: 0, text: "Checks network pins, the cap for the token and your two acknowledgements." },
        { by: 0, to: 1, text: "Proves the private transfer on the device and sends it. The fee is paid in Fee Juice.", note: "Amount and recipient private; fee payer public" },
        { by: 2, to: 1, text: "Its wallet already knows chat contacts as senders, so it finds the new note on the next sync." },
      ]}
    />
  );
}

function StudioPath() {
  return (
    <Sequence
      actors={[{ name: "Your browser", icon: Laptop, you: true }, { name: "Our server", icon: Server }, { name: "Groq", icon: Bot }]}
      steps={[
        { by: 0, to: 1, text: "Sends the chat, its files and settings. The history lives on your device only." },
        { by: 1, text: "Checks your session, plan and allowance, then fits the call to 8,000 tokens per minute.", note: "Oldest messages left out first, and you are told" },
        { by: 1, to: 2, text: "Calls an open model (GPT-OSS 120B, 20B or Qwen); a busy model falls back to another." },
        { by: 1, to: 0, text: "Streams text, tool calls and artifacts back; usage is counted in tokens, never billed." },
      ]}
    />
  );
}

const FIGURES: Record<FigureKind, () => React.ReactElement> = {
  architecture: Architecture,
  "message-path": MessagePath,
  ecosystem: Ecosystem,
  "device-link": DeviceLink,
  "private-payment": PrivatePayment,
  "studio-path": StudioPath,
};

export function Figure({ kind, caption }: { kind: FigureKind; caption: string }) {
  const Body = FIGURES[kind];
  return (
    <figure className={s.figure}>
      <div className={s.figureCanvas}><Body /></div>
      <figcaption className={s.figcaption}>{caption}</figcaption>
    </figure>
  );
}
