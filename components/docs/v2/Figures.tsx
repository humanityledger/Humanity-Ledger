import React from "react";
import { Blocks, Laptop, MessageSquare, Server, type LucideIcon } from "lucide-react";
import type { FigureKind } from "@/lib/docs/types";
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

export function Figure({ kind, caption }: { kind: FigureKind; caption: string }) {
  return (
    <figure className={s.figure}>
      <div className={s.figureCanvas}>{kind === "architecture" ? <Architecture /> : <MessagePath />}</div>
      <figcaption className={s.figcaption}>{caption}</figcaption>
    </figure>
  );
}
