/**
 * The public landing at "/" (brief of 18/11/2026): white mode, native scroll, one story.
 * A message is born in a hand, travels encrypted, carries a private payment, and reaches anywhere.
 *
 * Server Component. Copy and figures come from lib/landing/content.ts; client islands
 * (Islands.tsx) are the scroll loop, the videos, the LivePhone, the QR and the globe.
 * Each pinned scene is a <section data-scene> whose --p (0..1) drives transform and opacity in
 * Immersive.module.css, so scrolling up replays every frame in reverse.
 */
import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import React from 'react';
import { AZTEC_WALLET_CONFIG, explorerTxUrl, networkLabel } from '@/lib/aztec/wallet/config';
import { HLLogo } from '@/components/shared/HLLogo';
import { SiteFooter } from '@/components/landing/v2/SiteFooter';
import { DevicesSection } from '@/components/landing/v2/ProtocolSections';
import * as C from '@/lib/landing/content';
import { CopyHash, SceneGlobe, ScenePhone, SceneVideo, ScrollRoot, SessionHeal, SiteQr } from './Islands';
import s from './Immersive.module.css';

const ALPHA = AZTEC_WALLET_CONFIG.network === 'mainnet' && AZTEC_WALLET_CONFIG.alphaEnabled;
const NETWORK = networkLabel();
const NOTICE = (process.env.NEXT_PUBLIC_STATUS_NOTICE || '').trim();

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;
const v = (x: Record<string, string | number>) => Object.fromEntries(Object.entries(x).map(([k, val]) => [`--${k}`, val])) as Vars;

/** A headline with one violet emphasis. */
function Title({ parts, as: Tag = 'h2', id }: { parts: string[]; as?: 'h1' | 'h2'; id?: string }) {
  const [a, em, b] = parts;
  return (
    <Tag id={id} className={s.title}>
      {a}
      <em>{em}</em>
      {b}
    </Tag>
  );
}

/** Characters that appear one by one with the scene (pure CSS, from --p). */
function Typed({ text, from, step }: { text: string; from: number; step: number }) {
  return (
    <span className={s.typed} aria-label={text}>
      {[...text].map((ch, i) => (
        <span key={i} aria-hidden="true" style={v({ t: (from + i * step).toFixed(4) })}>
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </span>
  );
}

/** Pinned scene: `run` is its length in small-viewport heights. */
function Scene({ id, run, label, children, className = '' }: { id?: string; run: number; label: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} data-scene aria-label={label} className={`${s.scene} ${className}`} style={v({ run })}>
      <div className={s.pin}>{children}</div>
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

const Mark = ({ name }: { name: 'aztec' | 'ethereum' }) => {
  const file = C.BRAND_FILES[name];
  const label = name === 'aztec' ? 'Aztec Network' : 'Ethereum';
  // eslint-disable-next-line @next/next/no-img-element
  return file ? <img src={file} alt={label} className={s.brand} /> : <span className={s.brandText}>{label}</span>;
};

export function ImmersiveLanding() {
  const tests = countTests();
  const firstTxUrl = explorerTxUrl(C.FIRST_PAYMENT.tx) || undefined;
  const ticks = C.FIRST_PAYMENT.block - C.FIRST_PAYMENT.tokenBlock;

  return (
    <ScrollRoot className={s.page}>
      <SessionHeal />
      <a href="#main-content" className={s.skip}>Skip to content</a>

      <header className={s.nav}>
        <Link href="/" aria-label="Ledger Chat home" className={s.home}>
          <HLLogo size={40} label="Ledger Chat" />
        </Link>
        <nav aria-label="Sections" className={s.anchors}>
          {C.NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`}>{n.label}</a>
          ))}
        </nav>
        <span className={s.status}>
          <i aria-hidden="true" />
          {ALPHA ? `Live on ${NETWORK}` : `On the ${NETWORK}`}
        </span>
        <Link href="/chat" className={s.cta} prefetch>Open Ledger Chat</Link>
      </header>
      {NOTICE && <p className={s.notice} role="status">{NOTICE}</p>}

      <main id="main-content">
        {/* 1. The hand: the video runs with the scroll, then the real phone takes its place. */}
        <Scene run={220} label="Your wallet is your account" className={s.hero}>
          <div className={s.frame}>
            <SceneVideo {...C.MEDIA.hand} a={0} b={0.72} priority label="A hand holding a phone." />
          </div>
          <div className={s.heroCopy}>
            <p className={s.lead}>{C.ONE_LINE}</p>
            <Title as="h1" parts={C.HERO.title} />
            <p className={s.line}>{C.HERO.line}</p>
          </div>
          <div className={s.heroPhone}>
            <ScenePhone id="messages" screen="messages" />
          </div>
        </Scene>

        {/* 2. Say hi: a dark cinema window grows; the typed line becomes a real bubble. */}
        <Scene id="messages" run={200} label="Say hi" className={s.hi}>
          <div className={s.cinema}>
            <div className={s.cinemaInner}>
              <SceneVideo {...C.MEDIA.typing} a={0} b={0.6} label="A thumb typing Hi how are you on a phone keyboard." />
            </div>
            <p className={s.composer}>
              <Typed text={C.SAY_HI.typed} from={0.12} step={0.03} />
              <span className={s.caret} aria-hidden="true" />
              <span className={s.send} aria-hidden="true" />
            </p>
          </div>
          <span className={s.bubble} aria-hidden="true">{C.SAY_HI.typed}</span>
          <div className={s.hiPhone}>
            <ScenePhone id="chat" screen="chat" />
          </div>
          <div className={s.caption}><Title parts={C.SAY_HI.title} /></div>
        </Scene>

        {/* 3. Encryption: the bubble crosses three layers and is ciphertext in the MLS one. */}
        <Scene run={180} label="Encryption" className={s.enc}>
          <div className={s.layers} aria-hidden="true">
            {C.ENCRYPTION.layers.map((l, i) => (
              <div key={l} className={s.layer} style={v({ i })}><span>{l}</span></div>
            ))}
            <span className={s.packet}>
              <b>{C.SAY_HI.typed}</b>
              <i>•••• •••• ••••</i>
            </span>
          </div>
          <div className={s.caption}>
            <Title parts={C.ENCRYPTION.title} />
            <p className={s.line}>{C.ENCRYPTION.line}</p>
          </div>
        </Scene>

        {/* 4. Your name, and the real branded QR. */}
        <Scene run={140} label="Your name" className={s.name}>
          <div className={s.nameRow}>
            <p className={s.field}>
              <span>@</span>
              <Typed text={C.NAME.handle} from={0.1} step={0.04} />
              <span className={s.available}>available</span>
            </p>
            <div className={s.qrBox}><SiteQr /></div>
          </div>
          <div className={s.caption}>
            <Title parts={C.NAME.title} />
            <p className={s.line}>{C.NAME.line}</p>
          </div>
        </Scene>

        {/* 5. Private payments on Aztec Network. */}
        <Scene id="payments" run={220} label="Private payments" className={s.pay}>
          <div className={s.payPhone}><ScenePhone id="wallet" screen="wallet" /></div>
          <div className={s.note} aria-hidden="true">
            <span className={s.clear}><b>10 HLC</b> to @friend</span>
            <span className={s.sealed}>private note</span>
          </div>
          <div className={s.corner}><Mark name="aztec" /></div>
          <div className={s.caption}>
            <Title parts={C.PAYMENTS.title} />
            <p className={s.line}>{C.PAYMENTS.line}</p>
            <p className={s.small}>{C.PAYMENTS.small}</p>
          </div>
        </Scene>

        {/* 5.1 The first private payment, on chain: two recorded events, twenty blocks apart. */}
        <Scene id="record" run={180} label="The first private payment on chain" className={s.record}>
          <div className={s.recordHead}>
            <p className={s.eyebrow}>On chain · Aztec Alpha · {C.FIRST_PAYMENT.date}</p>
            <Title parts={C.RECORD.title} />
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

        {/* 6. Aztec settles on Ethereum. */}
        <Scene id="network" run={160} label="Aztec settles on Ethereum" className={s.eth}>
          <div className={s.band}><Mark name="aztec" /><span>L2 · private state and notes</span></div>
          <span className={s.proof} aria-hidden="true">proof</span>
          <div className={`${s.band} ${s.bandEth}`}><Mark name="ethereum" /><span>L1 · chain {AZTEC_WALLET_CONFIG.l1ChainId}</span></div>
          <div className={s.caption}>
            <Title parts={C.ETHEREUM.title} />
            <p className={s.small}>{C.ETHEREUM.small}</p>
          </div>
        </Scene>

        {/* 7. Calls. */}
        <Scene run={140} label="Calls" className={s.calls}>
          <div className={s.callPhone}><ScenePhone id="video" screen="video" /></div>
          <div className={s.caption}>
            <Title parts={C.CALLS.title} />
            <p className={s.line}>{C.CALLS.line}</p>
          </div>
        </Scene>

        {/* 8. Live: the globe with real numbers. */}
        <section id="live" className={s.live} aria-labelledby="live-title">
          <Title id="live-title" parts={C.LIVE.title} />
          <p className={s.small}>{C.LIVE.method}</p>
          <SceneGlobe />
        </section>

        {/* What it protects, and what not yet. */}
        <section className={s.section} aria-labelledby="protects-title">
          <h2 id="protects-title" className={s.h2}>What it protects. <em>What not yet.</em></h2>
          <div className={s.columns}>
            <div>
              <h3>Protected</h3>
              <ul>{C.PROTECTS.yes.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <div>
              <h3>Not yet</h3>
              <ul>{C.PROTECTS.notYet.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          </div>
          <p className={s.links}>
            <Link href="/chat">Wallet → Security view</Link>
            <Link href="/docs/security-model">Security model</Link>
            <Link href="/docs/overview">Documentation</Link>
          </p>
        </section>

        {/* How it works. */}
        <section id="stack" className={s.section} aria-labelledby="stack-title">
          <h2 id="stack-title" className={s.h2}>How it <em>works</em>.</h2>
          <ol className={s.stack}>
            {C.STACK.map((x, i) => (
              <li key={x.name}>
                <span className={s.n}>{String(i + 1).padStart(2, '0')}</span>
                <a href={x.href} target="_blank" rel="noopener noreferrer"><b>{x.name}</b></a>
                <p>{x.detail}</p>
              </li>
            ))}
          </ol>
          {C.WAVE1_CLASSES.length > 0 && (
            <p className={s.small}>
              Wave 1 contract classes, recorded in{' '}
              <a href={C.FACT_SOURCES.classes} target="_blank" rel="noopener noreferrer">deployments/aztec-testnet.json</a>:{' '}
              {C.WAVE1_CLASSES.map((c, i) => (
                <span key={c.id}>{i > 0 && ' · '}{c.name} <code>{c.id.slice(0, 10)}…{c.id.slice(-4)}</code></span>
              ))}
            </p>
          )}
        </section>

        {/* 9. Built in the open: facts, each with its source. */}
        <section className={s.section} aria-labelledby="open-title">
          <h2 id="open-title" className={s.h2}>Built in the <em>open</em>.</h2>
          <dl className={s.facts}>
            <div><dt>Messages</dt><dd>XMTP with MLS</dd><a href={C.FACT_SOURCES.messages} target="_blank" rel="noopener noreferrer">Source</a></div>
            <div><dt>Payments</dt><dd>{NETWORK}</dd><a href={C.FACT_SOURCES.payments} target="_blank" rel="noopener noreferrer">Record</a></div>
            {tests > 0 && <div><dt>Test files</dt><dd>{tests.toLocaleString('en-US')}</dd><a href={C.FACT_SOURCES.tests} target="_blank" rel="noopener noreferrer">Counted at build · CI</a></div>}
            <div><dt>Licence</dt><dd>MIT or Apache-2.0</dd><a href={C.FACT_SOURCES.license} target="_blank" rel="noopener noreferrer">LICENSE</a></div>
            <div><dt>Readiness</dt><dd>Public checklist</dd><a href={C.FACT_SOURCES.scale} target="_blank" rel="noopener noreferrer">MAINNET_READINESS.md</a></div>
          </dl>
          <p className={s.links}>
            {C.OPEN.map((o) => (o.href.startsWith('/') ? <Link key={o.label} href={o.href}>{o.label}</Link> : <a key={o.label} href={o.href} target="_blank" rel="noopener noreferrer">{o.label}</a>))}
          </p>
        </section>

        {/* Roadmap, without invented dates. */}
        <section className={s.section} aria-labelledby="road-title">
          <h2 id="road-title" className={s.h2}>What comes <em>next</em>.</h2>
          <ol className={s.road}>
            {C.ROADMAP.map((r) => <li key={r.when}><b>{r.when}</b><p>{r.what}</p></li>)}
          </ol>
        </section>

        {/* Questions. */}
        <section className={s.section} aria-labelledby="faq-title">
          <h2 id="faq-title" className={s.h2}>Questions.</h2>
          <div className={s.faq}>
            {C.FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* 10. Devices and close. */}
        <section id="devices" className={s.devices}>
          <DevicesSection />
        </section>

        <section className={s.close} aria-labelledby="close-title">
          <div className={s.closePhone}><ScenePhone id="stickers" screen="stickers" fill={0.9} /></div>
          <h2 id="close-title" className={s.h2}>Say hi to <em>anyone</em>.</h2>
          <Link href="/chat" className={s.ctaBig} prefetch>Open Ledger Chat</Link>
        </section>
      </main>

      <SiteFooter lead={false} />
      <div className={s.credits}>
        <p>{C.SETTLES}</p>
        <p className={s.marks}><Mark name="aztec" /><Mark name="ethereum" /></p>
        <p className={s.small}>{C.TRADEMARKS}</p>
      </div>
    </ScrollRoot>
  );
}

export default ImmersiveLanding;
