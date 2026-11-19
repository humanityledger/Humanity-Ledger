/**
 * The phone landing (Server Component). Served on / to phones only (lib/landing/device.ts); tablets
 * and desktops keep the immersive landing, which this tree never imports.
 *
 * Rules this tree keeps, from which smooth scrolling follows (docs: landing, "Two trees"):
 *  - native scroll only: no scroll handlers, no smooth-scroll library, no fixed body, every listener
 *    passive; nothing in JavaScript runs per scroll frame and React never re-renders while scrolling;
 *  - normal document flow: no pinned or sticky scenes, only a slim header that never changes size;
 *    the hero is min-height 100svh and nothing else depends on the viewport height;
 *  - compositor-only motion: one 240 ms reveal per section (opacity and transform), none with
 *    reduced motion; no backdrop-filter, filter, blend mode, large blurred shadow or animated gradient;
 *  - media: the hero image in AVIF or WebP with explicit size and fetchpriority="high", every other
 *    image lazy; videos are short muted loops that play only on screen and never seek with scroll;
 *  - below the fold every section has content-visibility: auto with a size close to its real one.
 * All copy comes from lib/landing/content.ts.
 */
import React from 'react';
import * as C from '@/lib/landing/content';
import { AZTEC_WALLET_CONFIG, explorerTxUrl, networkLabel } from '@/lib/aztec/wallet/config';
import { countTests, versions } from '@/lib/landing/facts';
import { Reveal } from './Reveal';
import { Enhance } from './Enhance';
import { MobileFooter } from './MobileFooter';
import s from './mobile.module.css';

const NETWORK = networkLabel();
const NOTICE = (process.env.NEXT_PUBLIC_STATUS_NOTICE || '').trim();
const IMG = '/media/landing/mobile';

type Key = keyof typeof C.EYEBROWS;

/** The eyebrow over a title: what the section is about, never a slide number. */
function Kicker({ k }: { k: Key }) {
  return <p className={s.kicker}>{C.EYEBROWS[k]}</p>;
}

/** A headline with one violet emphasis. */
function Title({ parts, as: Tag = 'h2', id }: { parts: readonly string[]; as?: 'h1' | 'h2'; id?: string }) {
  const [a, em, b] = parts;
  return (
    <Tag id={id} className={Tag === 'h1' ? s.h1 : s.h2}>
      {a}<em>{em}</em>{b}
    </Tag>
  );
}

/**
 * A flow: what happens between two ends, drawn as bands joined by a labelled connector (the
 * Settlement diagram, used in every section that explains a path). Every word comes from content.ts.
 */
type Step = { title: React.ReactNode; detail?: string; tone?: 'plain' | 'soft' | 'ink'; href?: string };
function Flow({ label, steps, links }: { label: string; steps: Step[]; links: string[] }) {
  return (
    <ol className={s.flow} aria-label={label}>
      {steps.map((st, i) => (
        <React.Fragment key={i}>
          {i > 0 && <li className={s.link}><span>{links[i - 1]}</span></li>}
          <li className={`${s.band} ${st.tone === 'ink' ? s.bandInk : st.tone === 'soft' ? s.bandSoft : ''}`}>
            {st.href ? (
              <a href={st.href} target="_blank" rel="noopener noreferrer" className={s.bandTitle}>{st.title}<span aria-hidden="true"> ↗</span></a>
            ) : (
              <span className={s.bandTitle}>{st.title}</span>
            )}
            {st.detail && <span className={s.bandDetail}>{st.detail}</span>}
          </li>
        </React.Fragment>
      ))}
    </ol>
  );
}

/**
 * A film, edge to edge at 4:5: the poster is the loop's first frame (AVIF, WebP), the loop fades in
 * over it once it plays (Reveal.tsx), so nothing jumps. `children` sit on the film (a bubble).
 */
function Film({ name, alt, hero = false, children }: { name: 'hero' | 'typing'; alt: string; hero?: boolean; children?: React.ReactNode }) {
  return (
    <div className={`${s.film} ${hero ? s.filmHero : ''}`}>
      <Pic hero={hero} name={name} widths={[480, 720, 1080]} w={1080} h={1350} sizes="100vw" alt={alt} className={s.media} />
      <video data-loop className={s.loop} muted playsInline loop preload="none" aria-hidden="true" tabIndex={-1} width={1080} height={1350}>
        <source src={`${IMG}/${name}-loop.mp4`} type="video/mp4" />
      </video>
      {children}
    </div>
  );
}

/** One line of proof: where to check what a section says. */
function Proof({ href, children }: { href: string; children: React.ReactNode }) {
  const ext = !href.startsWith('/');
  return (
    <p className={s.proof}>
      <a href={href} {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {children}{ext && <span aria-hidden="true"> ↗</span>}
      </a>
    </p>
  );
}

/** A section in normal flow: kicker, title, lead, then its content. Revealed once, below the fold. */
function Section({ k, id, title, lead, size, children }: { k: Key; id?: string; title: readonly string[]; lead?: string; size: number; children?: React.ReactNode }) {
  const titleId = `${k}-title`;
  return (
    <section id={id} className={s.section} aria-labelledby={titleId} style={{ containIntrinsicHeight: `auto ${size}px` }}>
      <div className={s.inner} data-reveal>
        <Kicker k={k} />
        <Title parts={title} id={titleId} />
        {lead && <p className={s.lead}>{lead}</p>}
        {children}
      </div>
    </section>
  );
}

/** A responsive image from the mobile set (AVIF, then WebP), lazy unless it is the hero. */
function Pic({ name, widths, w, h, alt, sizes, hero = false, className }: { name: string; widths: number[]; w: number; h: number; alt: string; sizes: string; hero?: boolean; className?: string }) {
  const set = (ext: string) => widths.map((x) => `${IMG}/${name}-${x}.${ext} ${x}w`).join(', ');
  return (
    <picture>
      <source type="image/avif" srcSet={set('avif')} sizes={sizes} />
      <source type="image/webp" srcSet={set('webp')} sizes={sizes} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${IMG}/${name}-${widths[0]}.webp`}
        alt={alt}
        width={w}
        height={h}
        className={className}
        decoding="async"
        {...(hero ? { fetchPriority: 'high' as const, loading: 'eager' as const } : { loading: 'lazy' as const })}
      />
    </picture>
  );
}

/** The marks: the brand-kit file once committed (C.BRAND_FILES), the name in text until then. */
function Mark({ name }: { name: 'aztec' | 'ethereum' }) {
  const file = C.BRAND_FILES[name];
  const label = name === 'aztec' ? 'Aztec Network' : 'Ethereum';
  if (!file) return <span className={s.markText}>{label}</span>;
  return (
    <span className={s.markText}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={file} alt="" width={14} height={22} loading="lazy" decoding="async" />
      {label}
    </span>
  );
}

/** A hash shown whole, selectable, with a copy button. */
function Hash({ label, hash, href }: { label: string; hash: string; href?: string }) {
  return (
    <div className={s.hash}>
      <span className={s.k}>{label}</span>
      <code>{hash}</code>
      <span className={s.hashActions}>
        <button type="button" data-copy={hash} className={s.copy}>Copy</button>
        {href && <a href={href} target="_blank" rel="noopener noreferrer" className={s.copy}>Explorer</a>}
      </span>
    </div>
  );
}

export function MobileLanding() {
  const tests = countTests();
  const ver = versions();
  const firstTxUrl = explorerTxUrl(C.FIRST_PAYMENT.tx) || undefined;
  const blocks = C.FIRST_PAYMENT.block - C.FIRST_PAYMENT.tokenBlock;
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

  return (
    <div className={s.page} data-landing="mobile">
      <Reveal />
      <Enhance />

      <header className={s.bar}>
        <a href="/" className={s.home} aria-label="Ledger Chat home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${IMG}/mark-96.webp`} alt="" width={28} height={28} className={s.logo} />
          <span>Ledger Chat</span>
        </a>
        <details className={s.menu}>
          <summary aria-label="Sections"><span aria-hidden="true" className={s.menuIcon} /></summary>
          <nav aria-label="Sections" className={s.sheet}>
            {C.NAV.map((n) => <a key={n.id} href={`#${n.id}`}>{n.label}</a>)}
          </nav>
        </details>
        <a href="/chat" className={s.barCta}>Open</a>
      </header>
      {NOTICE && <p className={s.notice} role="status">{NOTICE}</p>}

      <main id="main-content">
        {/* Hero: the title, the line and the action are readable at first paint; the film follows,
            edge to edge, and blends into the hero's own grey. */}
        <section className={s.hero} aria-labelledby="hero-title">
          <div className={s.heroCopy}>
            <Kicker k="hero" />
            <Title as="h1" id="hero-title" parts={C.HERO.title} />
            <p className={s.line}>{C.HERO.line}</p>
            <p className={s.lead}>{C.ONE_LINE}</p>
            <div className={s.actions}>
              <a href="/chat" className={s.cta}>Open Ledger Chat</a>
              <a href="#how" className={s.ghost}>How it works</a>
            </div>
          </div>
          <Film hero name="hero" alt="A hand holding a phone." />
          <p className={s.settles}>{C.SETTLES}</p>
        </section>

        {/* Messages: the typing film, the message it sends, and the path it takes. */}
        <Section k="hi" id="messages" title={C.SAY_HI.title} size={1500}>
          <Film name="typing" alt="A thumb typing Hi how are you on a phone keyboard.">
            <p className={s.bubble}><span>{C.SAY_HI.typed}</span></p>
          </Film>
          <Flow
            label="The path of a direct message"
            links={['encrypted with MLS', 'encrypted with MLS']}
            steps={[
              { title: 'Your device', detail: C.STACK[0].detail },
              { title: C.STACK[1].name, detail: C.STACK[1].detail, tone: 'ink', href: C.STACK[1].href },
              { title: 'Their device', detail: C.FEATURES[0].items[0].body },
            ]}
          />
          <Proof href={C.FACT_SOURCES.messages}>Source: lib/xmtp</Proof>
        </Section>

        {/* Encryption: readable only at the two ends. */}
        <Section k="enc" title={C.ENCRYPTION.title} lead={C.ENCRYPTION.line} size={900}>
          <Flow
            label="Where a message is readable"
            links={['•••• •••• ••••', '•••• •••• ••••']}
            steps={C.ENCRYPTION.layers.map((l, i) => ({ title: l, tone: i === 1 ? ('ink' as const) : i === 2 ? ('soft' as const) : ('plain' as const) }))}
          />
          <Proof href="/docs/security-model">Security model</Proof>
        </Section>

        {/* Usernames. */}
        <Section k="name" title={C.NAME.title} lead={C.NAME.line} size={760}>
          <Flow
            label="How a name opens a chat"
            links={['your code']}
            steps={[
              { title: <><span className={s.at}>@</span>{C.NAME.handle}</>, detail: C.FEATURES[2].items[1].body },
              { title: C.FEATURES[2].items[2].title, detail: C.FEATURES[2].items[2].body, tone: 'soft' },
            ]}
          />
        </Section>

        {/* Private payments: what stays on the device, what the chain sees, where it settles. */}
        <Section k="pay" id="payments" title={C.PAYMENTS.title} lead={C.PAYMENTS.line} size={1100}>
          <Flow
            label="The path of a private payment"
            links={['proof', 'settles']}
            steps={[
              { title: 'Your device', detail: C.PROTECTS.yes[1] },
              { title: <Mark name="aztec" />, detail: C.FEE_PRIVACY.onChain, tone: 'ink' },
              { title: <Mark name="ethereum" />, detail: C.STACK[3].detail, tone: 'soft' },
            ]}
          />
          <p className={s.note}>{C.FEE_PRIVACY.short}</p>
          <p className={s.small}>{C.PAYMENTS.small}</p>
          <Proof href={C.FACT_SOURCES.payments}>Record: deployments/aztec-mainnet.json</Proof>
        </Section>

        {/* The first private payment, on chain. */}
        <Section k="record" id="record" title={C.RECORD.title} size={1300}>
          <p className={s.date}>{NETWORK} · {C.FIRST_PAYMENT.date}</p>
          <ol className={s.timeline}>
            <li>
              <p className={s.k}>L2 block {C.FIRST_PAYMENT.tokenBlock.toLocaleString('en-US')}</p>
              <h3>HLC deployed</h3>
              <p>Test token, {C.FIRST_PAYMENT.tokenDecimals} decimals, no monetary value.</p>
              <Hash label="Contract" hash={C.FIRST_PAYMENT.token} />
            </li>
            <li className={s.gap}><span>{blocks} blocks later</span></li>
            <li>
              <p className={s.k}>L2 block {C.FIRST_PAYMENT.block.toLocaleString('en-US')}</p>
              <h3>First private payment from Ledger Chat</h3>
              <p>{C.FIRST_PAYMENT.amount}, sent privately on Aztec Alpha.</p>
              <Hash label="Transaction" hash={C.FIRST_PAYMENT.tx} href={firstTxUrl} />
            </li>
          </ol>
          <p className={s.small}>
            {C.RECORD.note} Verified by the public CI,{' '}
            <a href={C.FIRST_PAYMENT.preflightUrl} target="_blank" rel="noopener noreferrer">run {C.FIRST_PAYMENT.preflightRun}</a>.
          </p>
        </Section>

        {/* Aztec settles on Ethereum. */}
        <Section k="eth" id="network" title={C.ETHEREUM.title} lead={C.ETHEREUM.small} size={700}>
          <Flow
            label="Where Aztec settles"
            links={['proof']}
            steps={[
              { title: <Mark name="aztec" />, detail: 'L2 · private state and notes' },
              { title: <Mark name="ethereum" />, detail: `L1 · chain ${AZTEC_WALLET_CONFIG.l1ChainId}`, tone: 'soft' },
            ]}
          />
        </Section>

        {/* Calls. */}
        <Section k="calls" title={C.CALLS.title} lead={C.CALLS.line} size={1500}>
          <div className={s.screen}>
            <Pic name="call" widths={[360, 540]} w={540} h={871} sizes="280px" alt="A group video call on a phone." className={s.callImg} />
          </div>
          <Flow
            label="The path of a call"
            links={['DTLS-SRTP']}
            steps={[
              { title: 'Your device', detail: C.FEATURES[3].items[0].body },
              { title: 'Their device', tone: 'soft' },
            ]}
          />
          <Proof href={C.FACT_SOURCES.calls}>Source: lib/calls</Proof>
        </Section>

        {/* Live: the real numbers, filled once when the page is idle. */}
        <Section k="live" id="live" title={C.LIVE.title} lead={C.LIVE.method} size={760}>
          <dl className={s.stats}>
            <div><dt>Accounts</dt><dd data-live="accounts">–</dd><p>Wallets that have signed in.</p></div>
            <div><dt>@usernames</dt><dd data-live="usernames">–</dd><p>Reserved, each one unique.</p></div>
            <div><dt>Visits</dt><dd data-live="visitors">–</dd><p data-live="today">One per page load.</p></div>
            <div><dt>{NETWORK} block</dt><dd data-live="block">–</dd><p>Read from the node.</p></div>
          </dl>
        </Section>

        {/* What it does today. */}
        <Section k="features" title={['Everything in ', 'one app', '.']} lead={C.NEXT_WAVE} size={1900}>
          {C.FEATURES.map((g) => (
            <div key={g.group} className={s.group}>
              <h3>{g.group}</h3>
              <dl>
                {g.items.map((f) => <div key={f.title}><dt>{f.title}</dt><dd>{f.body}</dd></div>)}
              </dl>
            </div>
          ))}
        </Section>

        {/* How it works: the four layers as one path, then the parts with their sources. */}
        <Section k="how" id="how" title={['From your device to ', 'Ethereum', '.']} lead="Four layers. Each one links to its code." size={1800}>
          <Flow
            label="The four layers"
            links={['messages', 'payments', 'settlement']}
            steps={C.STACK.map((x, i) => ({ title: x.name, detail: x.detail, href: x.href, tone: i === 1 ? ('ink' as const) : i === 3 ? ('soft' as const) : ('plain' as const) }))}
          />
          <dl className={s.spec}>
            {spec.map((r) => (
              <div key={r.k}><dt>{r.k}</dt><dd>{r.v}</dd><a href={r.href} target="_blank" rel="noopener noreferrer">Source</a></div>
            ))}
          </dl>
          {C.WAVE1_CLASSES.length > 0 && (
            <p className={s.small}>
              Wave 1 contract classes, recorded in{' '}
              <a href={C.FACT_SOURCES.classes} target="_blank" rel="noopener noreferrer">deployments/aztec-testnet.json</a>:{' '}
              {C.WAVE1_CLASSES.map((c, i) => <span key={c.id}>{i > 0 && ' · '}{c.name} <code>{c.id.slice(0, 10)}…{c.id.slice(-4)}</code></span>)}
            </p>
          )}
        </Section>

        {/* What it protects, and what not yet. */}
        <Section k="protects" title={['What it protects. ', 'What not yet', '.']} size={900}>
          <h3 className={s.h3}>Protected</h3>
          <ul className={s.yes}>{C.PROTECTS.yes.map((x) => <li key={x}>{x}</li>)}</ul>
          <h3 className={s.h3}>Not yet</h3>
          <ul className={s.no}>{C.PROTECTS.notYet.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className={s.note}>{C.FEE_PRIVACY.long}</p>
          <p className={s.links}>
            <a href="/docs/security-model">Security model</a>
            <a href="/chat">Wallet → Security view</a>
            <a href="/docs/overview">Documentation</a>
          </p>
        </Section>

        {/* Built in the open, and what comes next. */}
        <Section k="open" title={['Built in the ', 'open', '.']} size={1300}>
          <dl className={s.spec}>
            {facts.map((f) => <div key={f.k}><dt>{f.k}</dt><dd>{f.v}</dd><a href={f.href} target="_blank" rel="noopener noreferrer">{f.src}</a></div>)}
          </dl>
          <p className={s.links}>
            {C.OPEN.map((o) => <a key={o.label} href={o.href} {...(o.href.startsWith('/') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>{o.label}</a>)}
          </p>
          <h3 className={s.h3}>What comes next</h3>
          <Flow label="What comes next" links={['then', 'then']} steps={C.ROADMAP.map((r, i) => ({ title: r.when, detail: r.what, tone: i === 0 ? ('ink' as const) : ('plain' as const) }))} />
        </Section>

        {/* Questions: native disclosure, no script. */}
        <Section k="faq" title={['Questions, ', 'answered', '.']} size={900}>
          <div className={s.faq}>
            {C.FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}<span aria-hidden="true" className={s.plus} /></summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </Section>

        {/* Every screen. */}
        <Section k="devices" id="devices" title={['The same account on ', 'every screen', '.']} lead="Sign in with the same wallet and your conversations follow you. Proofs for private payments are made on the device you hold." size={760}>
          <ul className={s.devices}>{C.DEVICES.map((d) => <li key={d.name}><b>{d.name}</b><p>{d.how}</p></li>)}</ul>
        </Section>

        <section className={s.close} aria-labelledby="close-title">
          <Title id="close-title" parts={['Say hi to ', 'anyone', '.']} />
          <a href="/chat" className={s.cta}>Open Ledger Chat</a>
          <p className={s.small}>{C.SETTLES}</p>
          <p className={s.marks}><Mark name="aztec" /><Mark name="ethereum" /></p>
          <p className={s.small}>{C.TRADEMARKS}</p>
        </section>
      </main>

      <MobileFooter />
    </div>
  );
}

export default MobileLanding;
