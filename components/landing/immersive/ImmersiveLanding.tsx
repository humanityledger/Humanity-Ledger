/**
 * The public landing at "/": white mode, native scroll, one story told in one grammar.
 * A message is born in a hand, travels encrypted, carries a private payment, and reaches anywhere.
 *
 * Server Component. Copy and figures come from lib/landing/content.ts; client islands
 * (Islands.tsx) are the scroll loop, the videos, the LivePhone, the QR and the globe.
 *
 * Two kinds of block, one anatomy (index, eyebrow, title with one emphasis, lead, visual, proof):
 *  - Scenes (<Scene>): pinned, each a pure function of its progress --p (Immersive.module.css).
 *    Consecutive scenes overlap and cross-fade (--in), so no frame is ever half-scrolled.
 *  - Chapters (<Chapter>): the facts, read at the reader's pace, revealed by a scroll-driven
 *    CSS animation where the browser has one.
 */
import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import React from 'react';
import { AZTEC_WALLET_CONFIG, explorerTxUrl, networkLabel } from '@/lib/aztec/wallet/config';
import { HLLogo } from '@/components/shared/HLLogo';
import { SiteFooter } from '@/components/landing/v2/SiteFooter';
import * as C from '@/lib/landing/content';
import { CopyHash, SceneGlobe, ScenePhone, SceneVideo, ScrollDebug, ScrollRoot, SessionHeal, SiteQr } from './Islands';
import { DotWorld } from './DotWorld';
import s from './Immersive.module.css';

const NETWORK = networkLabel();
const NOTICE = (process.env.NEXT_PUBLIC_STATUS_NOTICE || '').trim();

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;
const v = (x: Record<string, string | number>) => Object.fromEntries(Object.entries(x).map(([k, val]) => [`--${k}`, val])) as Vars;

/** The sections of the page, in order. */
const ORDER = ['hero', 'hi', 'enc', 'name', 'pay', 'record', 'eth', 'calls', 'live', 'features', 'how', 'protects', 'open', 'faq', 'devices'] as const;
type Key = (typeof ORDER)[number];

/** The eyebrow above every block. No "02 / 15" counter: sections are named, not numbered. */
function Kicker({ k }: { k: Key }) {
  return (
    <p className={s.kicker}>
      <span className={s.eyebrow}>{C.EYEBROWS[k]}</span>
    </p>
  );
}

/** A headline with one violet emphasis. */
function Title({ parts, as: Tag = 'h2', id, className = s.title }: { parts: readonly string[]; as?: 'h1' | 'h2'; id?: string; className?: string }) {
  const [a, em, b] = parts;
  return (
    <Tag id={id} className={className}>
      {a}
      <em>{em}</em>
      {b}
    </Tag>
  );
}

/** The one line of proof under a block: where to check what it says. */
function Proof({ href, children }: { href: string; children: React.ReactNode }) {
  const external = !href.startsWith('/');
  return (
    <p className={s.proof}>
      {external ? (
        <a href={href} target="_blank" rel="noopener noreferrer">{children}<span aria-hidden="true"> ↗</span></a>
      ) : (
        <Link href={href}>{children}</Link>
      )}
    </p>
  );
}

/** Characters that appear one by one with the scene (pure CSS, from --p). */
function Typed({ text, from, step }: { text: string; from: number; step: number }) {
  return (
    <span className={s.typed} aria-label={text}>
      {[...text].map((ch, i) => (
        <span key={i} aria-hidden="true" style={v({ t: (from + i * step).toFixed(4) })}>
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </span>
  );
}

/** Pinned scene: `run` is its length in small-viewport heights (desktop; phones use 75 % of the part past one screen). */
function Scene({ id, run, label, children, className = '' }: { id?: string; run: number; label: string; children: React.ReactNode; className?: string }) {
  return (
    <section data-scene aria-label={label} className={`${s.scene} ${className}`} style={v({ run })}>
      {/* The anchor sits after the cross-fade, so a link lands on this scene fully drawn. */}
      {id && <span id={id} className={s.anchor} aria-hidden="true" />}
      <div className={s.pin}>{children}</div>
    </section>
  );
}

/** The caption of a scene: kicker, title, lead, small print and proof. */
function Caption({ k, title, line, small, proof, className = '' }: {
  k: Key; title: readonly string[]; line?: string; small?: string; proof?: { href: string; label: string }; className?: string;
}) {
  return (
    <div className={`${s.caption} ${className}`}>
      <Kicker k={k} />
      <Title parts={title} />
      {line && <p className={s.line}>{line}</p>}
      {small && <p className={s.small}>{small}</p>}
      {proof && <Proof href={proof.href}>{proof.label}</Proof>}
    </div>
  );
}

/** A chapter: the same anatomy, read at the reader's own pace. */
function Chapter({ id, k, title, lead, children, proof, className = '' }: {
  id?: string; k: Key; title: readonly string[]; lead?: string; children?: React.ReactNode; proof?: React.ReactNode; className?: string;
}) {
  const titleId = `${k}-title`;
  return (
    <section id={id} className={`${s.chapter} ${className}`} aria-labelledby={titleId}>
      <header className={`${s.chapterHead} ${s.reveal}`}>
        <Kicker k={k} />
        <Title id={titleId} parts={title} className={s.h2} />
        {lead && <p className={s.line}>{lead}</p>}
      </header>
      {children && <div className={`${s.chapterBody} ${s.reveal}`}>{children}</div>}
      {proof && <div className={s.chapterProof}>{proof}</div>}
    </section>
  );
}

/** Test files in the repository, counted once per server process (0 when the folder is not deployed). */
let TESTS: number | null = null;
function countTests(): number {
  if (TESTS !== null) return TESTS;
  let n = 0;
  const walk = (dir: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) walk(path.join(dir, e.name));
      else if (/\.test\.(ts|tsx)$/.test(e.name)) n++;
    }
  };
  walk(path.join(process.cwd(), 'test'));
  TESTS = n;
  return n;
}

/** The marks: the brand-kit file once it is committed (C.BRAND_FILES), the name in plain text until then. */
const Mark = ({ name }: { name: 'aztec' | 'ethereum' }) => {
  const file = C.BRAND_FILES[name];
  const label = name === 'aztec' ? 'Aztec Network' : 'Ethereum';
  if (!file) return <span className={s.brandText}>{label}</span>;
  // The Ethereum diamond from ethereum.org's assets; its name is set beside it in the page's type.
  return name === 'ethereum' ? (
    <span className={s.brandEth}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={file} alt="" className={s.brand} />
      <span>Ethereum</span>
    </span>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={file} alt={label} className={s.brand} />
  );
};

/** Versions read from the repository once per process, never typed by hand. */
let VERSIONS: { xmtp: string; aztecNr: string } | null = null;
function versions() {
  if (VERSIONS) return VERSIONS;
  const read = (p: string) => { try { return fs.readFileSync(path.join(process.cwd(), p), 'utf8'); } catch { return ''; } };
  const xmtp = (JSON.parse(read('package.json') || '{}').dependencies ?? {})['@xmtp/browser-sdk'] ?? '';
  const aztecNr = /aztec-nr", tag = "(v[\d.]+)"/.exec(read('contracts/aztec/escrow/Nargo.toml'))?.[1] ?? '';
  VERSIONS = { xmtp, aztecNr };
  return VERSIONS;
}

export function ImmersiveLanding() {
  const tests = countTests();
  const ver = versions();
  const spec = [
    { k: 'Messages', v: `XMTP with MLS${ver.xmtp ? `, browser SDK ${ver.xmtp}` : ''}`, href: C.FACT_SOURCES.messages },
    { k: 'Payments', v: `${NETWORK}, private notes, proofs made on your device (PXE in the browser)`, href: C.FACT_SOURCES.payments },
    { k: 'Contracts', v: `Noir with aztec-nr${ver.aztecNr ? ` ${ver.aztecNr}` : ''}`, href: C.FACT_SOURCES.classes },
    { k: 'Network fees', v: 'Fee Juice, paid by your own account', href: C.FACT_SOURCES.payments },
    { k: 'Settlement', v: `Ethereum, L1 chain ${AZTEC_WALLET_CONFIG.l1ChainId}`, href: C.FACT_SOURCES.payments },
    { k: 'Calls', v: 'WebRTC, DTLS-SRTP in transit', href: C.FACT_SOURCES.calls },
    { k: 'Licence', v: 'MIT or Apache-2.0', href: C.FACT_SOURCES.license },
  ];
  const facts = [
    { k: 'Messages', v: 'XMTP with MLS', href: C.FACT_SOURCES.messages, src: 'lib/xmtp' },
    { k: 'Payments', v: NETWORK, href: C.FACT_SOURCES.payments, src: 'Record' },
    ...(tests > 0 ? [{ k: 'Test files', v: tests.toLocaleString('en-US'), href: C.FACT_SOURCES.tests, src: 'Counted at build · CI' }] : []),
    { k: 'Licence', v: 'MIT or Apache-2.0', href: C.FACT_SOURCES.license, src: 'LICENSE' },
    { k: 'Readiness', v: 'Public checklist', href: C.FACT_SOURCES.scale, src: 'MAINNET_READINESS.md' },
  ];
  const firstTxUrl = explorerTxUrl(C.FIRST_PAYMENT.tx) || undefined;
  const ticks = C.FIRST_PAYMENT.block - C.FIRST_PAYMENT.tokenBlock;

  return (
    <ScrollRoot className={s.page}>
      <SessionHeal />
      <ScrollDebug />
      <a href="#main-content" className={s.skip}>Skip to content</a>

      <header className={s.nav}>
        <Link href="/" aria-label="Ledger Chat home" className={s.home}>
          <HLLogo size={36} label="Ledger Chat" />
        </Link>
        <nav aria-label="Sections" className={s.anchors} data-spy-nav>
          {C.NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`}>{n.label}</a>
          ))}
        </nav>
        <span className={s.builtOn}>
          Built on
          <a href="https://aztec.network" target="_blank" rel="noopener noreferrer" aria-label="Aztec Network"><Mark name="aztec" /></a>
          <span aria-hidden="true">·</span>
          <a href="https://ethereum.org" target="_blank" rel="noopener noreferrer" aria-label="Ethereum"><Mark name="ethereum" /></a>
        </span>
        <Link href="/chat" className={s.cta} prefetch>Open Ledger Chat</Link>
        <details className={s.menu}>
          <summary aria-label="Sections">
            <span aria-hidden="true" className={s.menuIcon} />
          </summary>
          <nav aria-label="Sections" className={s.sheet}>
            {C.NAV.map((n) => (
              <a key={n.id} href={`#${n.id}`}>{n.label}</a>
            ))}
            <span className={s.sheetStatus}>Built on <Mark name="aztec" /> · <Mark name="ethereum" /></span>
          </nav>
        </details>
      </header>
      {NOTICE && <p className={s.notice} role="status">{NOTICE}</p>}

      <main id="main-content">
        {/* 01. The hand: the video runs with the scroll, then the real phone takes its place. */}
        <Scene run={240} label="Your wallet is your account" className={s.hero}>
          <div className={s.frame}>
            <SceneVideo {...C.MEDIA.hand} a={0} b={0.72} priority label="A hand holding a phone." />
          </div>
          <div className={s.heroCopy}>
            <Kicker k="hero" />
            <Title as="h1" parts={C.HERO.title} className={s.display} />
            <p className={s.line}>{C.HERO.line}</p>
            <p className={s.lead}>{C.ONE_LINE}</p>
          </div>
          <div className={s.heroPhone}>
            <ScenePhone id="messages" screen="messages" />
          </div>
        </Scene>

        {/* 02. Say hi: the typing film in a cinema window, the line typed in a composer under it,
            then the window steps aside and the message flies onto the phone. */}
        <Scene id="messages" run={310} label="Say hi" className={s.hi}>
          <div className={s.cinemaMove}>
            <div className={s.cinema}>
              <div className={s.cinemaInner}>
                <SceneVideo {...C.MEDIA.typing} a={0.02} b={0.6} label="A thumb typing Hi how are you on a phone keyboard." />
              </div>
            </div>
            <p className={s.composer}>
              <Typed text={C.SAY_HI.typed} from={0.1} step={0.028} />
              <span className={s.caret} aria-hidden="true" />
              <span className={s.send} aria-hidden="true" />
            </p>
          </div>
          <div className={s.hiPhone}>
            <ScenePhone id="chat" screen="chat" />
          </div>
          <span className={s.bubble} aria-hidden="true">{C.SAY_HI.typed}</span>
          <Caption k="hi" title={C.SAY_HI.title} proof={{ href: C.FACT_SOURCES.messages, label: 'Source: lib/xmtp' }} />
        </Scene>

        {/* 03. Encryption: the bubble crosses three layers and is ciphertext in the MLS one. */}
        <Scene run={260} label="Encryption" className={s.enc}>
          <div className={s.layers} aria-hidden="true">
            {C.ENCRYPTION.layers.map((l, i) => (
              <div key={l} className={s.layer} style={v({ i })}><span>{l}</span></div>
            ))}
            <span className={s.packet}>
              <b>{C.SAY_HI.typed}</b>
              <i>•••• •••• ••••</i>
            </span>
          </div>
          <Caption k="enc" title={C.ENCRYPTION.title} line={C.ENCRYPTION.line} proof={{ href: '/docs/security-model', label: 'Security model' }} />
        </Scene>

        {/* 04. Your name, and the real branded QR. */}
        <Scene run={240} label="Your name" className={s.name}>
          <div className={s.nameRow}>
            <p className={s.field}>
              <span>@</span>
              <Typed text={C.NAME.handle} from={0.08} step={0.04} />
              <span className={s.available}>available</span>
            </p>
            <div className={s.qrBox}><SiteQr /></div>
          </div>
          <Caption k="name" title={C.NAME.title} line={C.NAME.line} />
        </Scene>

        {/* 05. Private payments on Aztec Network. */}
        <Scene id="payments" run={280} label="Private payments" className={s.pay}>
          <div className={s.payPhone}><ScenePhone id="wallet" screen="wallet" /></div>
          <div className={s.note} aria-hidden="true">
            <span className={s.clear}><b>10 HLC</b> to @friend</span>
            <span className={s.sealed}>private note</span>
          </div>
          <Caption k="pay" title={C.PAYMENTS.title} line={C.PAYMENTS.line} small={C.PAYMENTS.small} proof={{ href: C.FACT_SOURCES.payments, label: 'Record: deployments/aztec-mainnet.json' }} />
        </Scene>

        {/* 06. The first private payment, on chain: two recorded events, twenty blocks apart. */}
        <Scene id="record" run={260} label="The first private payment on chain" className={s.record}>
          <div className={s.recordHead}>
            <Kicker k="record" />
            <Title parts={C.RECORD.title} />
            <p className={s.date}>{NETWORK} · {C.FIRST_PAYMENT.date}</p>
          </div>
          <div className={s.timeline}>
            <div className={s.rail} aria-hidden="true">
              <span className={s.railFill} />
              {Array.from({ length: ticks + 1 }, (_, i) => (
                <i key={i} style={v({ t: (i / ticks).toFixed(4) })} />
              ))}
            </div>
            <div className={s.ends} aria-hidden="true">
              <span>Block {C.FIRST_PAYMENT.tokenBlock.toLocaleString('en-US')}</span>
              <span>{ticks} blocks later</span>
              <span>Block {C.FIRST_PAYMENT.block.toLocaleString('en-US')}</span>
            </div>
            <div className={s.points}>
              <article>
                <p className={s.k}>L2 block {C.FIRST_PAYMENT.tokenBlock.toLocaleString('en-US')}</p>
                <h3>HLC deployed</h3>
                <p className={s.v}>Test token, {C.FIRST_PAYMENT.tokenDecimals} decimals, no monetary value.</p>
                <CopyHash label="Contract" hash={C.FIRST_PAYMENT.token} />
              </article>
              <article>
                <p className={s.k}>L2 block {C.FIRST_PAYMENT.block.toLocaleString('en-US')}</p>
                <h3>First private payment from Ledger Chat</h3>
                <p className={s.v}>{C.FIRST_PAYMENT.amount}, sent privately on Aztec Alpha.</p>
                <CopyHash label="Transaction" hash={C.FIRST_PAYMENT.tx} href={firstTxUrl} />
              </article>
            </div>
          </div>
          <p className={s.recordNote}>
            {C.RECORD.note} Verified by the public CI,{' '}
            <a href={C.FIRST_PAYMENT.preflightUrl} target="_blank" rel="noopener noreferrer">run {C.FIRST_PAYMENT.preflightRun}</a>.
          </p>
        </Scene>

        {/* 07. Aztec settles on Ethereum. */}
        <Scene id="network" run={240} label="Aztec settles on Ethereum" className={s.eth}>
          <div className={s.bands}>
            <div className={s.band}><Mark name="aztec" /><span>L2 · private state and notes</span></div>
            <span className={s.proofDot} aria-hidden="true">proof</span>
            <div className={`${s.band} ${s.bandEth}`}><Mark name="ethereum" /><span>L1 · chain {AZTEC_WALLET_CONFIG.l1ChainId}</span></div>
          </div>
          <Caption k="eth" title={C.ETHEREUM.title} small={C.ETHEREUM.small} />
        </Scene>

        {/* 08. Calls. */}
        <Scene run={185} label="Calls" className={s.calls}>
          <div className={s.callPhone}>
            <picture>
              <source srcSet={C.MEDIA.call.webp} type="image/webp" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={C.MEDIA.call.png} alt="A group video call on a phone." width={800} height={1290} decoding="async" loading="lazy" className={s.callImg} />
            </picture>
          </div>
          <Caption k="calls" title={C.CALLS.title} line={C.CALLS.line} proof={{ href: C.FACT_SOURCES.calls, label: 'Source: lib/calls' }} />
        </Scene>

        {/* 09. Live: the globe with real numbers. */}
        <Chapter id="live" k="live" title={C.LIVE.title} lead={C.LIVE.method} className={s.live}>
          <SceneGlobe />
        </Chapter>

        {/* 10. What it does today. */}
        <Chapter k="features" title={['Everything in ', 'one app', '.']} lead={C.NEXT_WAVE}>
          <div className={s.features}>
            {C.FEATURES.map((g) => (
              <div key={g.group} className={s.featureGroup}>
                <h3>{g.group}</h3>
                <dl>
                  {g.items.map((f) => (
                    <div key={f.title}><dt>{f.title}</dt><dd>{f.body}</dd></div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </Chapter>

        {/* 11. How it works: the layers, then the parts with their versions and sources. */}
        <Chapter id="how" k="how" title={['From your device to ', 'Ethereum', '.']} lead="Four layers. Each one links to its code.">
          <ol className={s.stack}>
            {C.STACK.map((x) => (
              <li key={x.name}>
                <div>
                  <a href={x.href} target="_blank" rel="noopener noreferrer"><b>{x.name}</b></a>
                  <p>{x.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <dl className={s.spec}>
            {spec.map((r) => (
              <div key={r.k}>
                <dt>{r.k}</dt>
                <dd>{r.v}</dd>
                <a href={r.href} target="_blank" rel="noopener noreferrer">Source</a>
              </div>
            ))}
          </dl>
          {C.WAVE1_CLASSES.length > 0 && (
            <p className={s.small}>
              Wave 1 contract classes, recorded in{' '}
              <a href={C.FACT_SOURCES.classes} target="_blank" rel="noopener noreferrer">deployments/aztec-testnet.json</a>:{' '}
              {C.WAVE1_CLASSES.map((c, i) => (
                <span key={c.id}>{i > 0 && ' · '}{c.name} <code>{c.id.slice(0, 10)}…{c.id.slice(-4)}</code></span>
              ))}
            </p>
          )}
        </Chapter>

        {/* 12. What it protects, and what not yet. */}
        <Chapter k="protects" title={['What it protects. ', 'What not yet', '.']} proof={
          <p className={s.links}>
            <Link href="/docs/security-model">Security model</Link>
            <Link href="/chat">Wallet → Security view</Link>
            <Link href="/docs/overview">Documentation</Link>
          </p>
        }>
          <div className={s.columns}>
            <div>
              <h3>Protected</h3>
              <ul className={s.yes}>{C.PROTECTS.yes.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <div>
              <h3>Not yet</h3>
              <ul className={s.no}>{C.PROTECTS.notYet.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          </div>
        </Chapter>

        {/* 13. Built in the open, and what comes next on the same line. */}
        <Chapter k="open" title={['Built in the ', 'open', '.']} proof={
          <p className={s.links}>
            {C.OPEN.map((o) => (o.href.startsWith('/') ? <Link key={o.label} href={o.href}>{o.label}</Link> : <a key={o.label} href={o.href} target="_blank" rel="noopener noreferrer">{o.label}</a>))}
          </p>
        }>
          <dl className={s.facts}>
            {facts.map((f) => (
              <div key={f.k}><dt>{f.k}</dt><dd>{f.v}</dd><a href={f.href} target="_blank" rel="noopener noreferrer">{f.src}</a></div>
            ))}
          </dl>
          <h3 className={s.subhead}>What comes next</h3>
          <ol className={s.road}>
            {C.ROADMAP.map((r) => <li key={r.when}><b>{r.when}</b><p>{r.what}</p></li>)}
          </ol>
        </Chapter>

        {/* 14. Questions. */}
        <Chapter k="faq" title={['Questions, ', 'answered', '.']}>
          <div className={s.faq}>
            {C.FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}<span aria-hidden="true" className={s.plus} /></summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </Chapter>

        {/* 15. Every screen, and the close. */}
        <Chapter id="devices" k="devices" title={['The same account on ', 'every screen', '.']} lead="Sign in with the same wallet and your conversations follow you. Proofs for private payments are made on the device you hold." className={s.devices}>
          <DotWorld />
          <p className={s.mapLegend}><i aria-hidden="true" />Where people are on Ledger Chat right now, by time zone. No IP address is stored.</p>
          <ul className={s.deviceList}>
            {C.DEVICES.map((d) => (
              <li key={d.name}><b>{d.name}</b><p>{d.how}</p></li>
            ))}
          </ul>
        </Chapter>

        <section className={s.close} aria-labelledby="close-title">
          <div className={s.closePhone}><ScenePhone id="chat" screen="invoice" fill={0.9} /></div>
          <Title id="close-title" parts={['Say hi to ', 'anyone', '.']} className={s.h2} />
          <Link href="/chat" className={s.ctaBig} prefetch>Open Ledger Chat</Link>
          <p className={s.settles}>{C.SETTLES}</p>
          <p className={s.marks}><Mark name="aztec" /><Mark name="ethereum" /></p>
          <p className={s.tm}>{C.TRADEMARKS}</p>
        </section>
      </main>

      <SiteFooter lead={false} />
    </ScrollRoot>
  );
}

export default ImmersiveLanding;
