/**
 * The landing page of ledgerchat.org (21 November 2026, second pass): product first, then the
 * protection explained in plain words, then in detail. A server component with four small client
 * islands (the conversation seen from inside and outside, the private payment in four steps, the
 * two-balls example and the architecture diagram). Everything else is HTML and CSS, native scroll.
 *
 * Copy: lib/landing/chapters.ts. Status words: lib/landing/claims.ts. Library versions are read
 * from the repository (lib/landing/facts.ts). Nothing here is typed by hand.
 */
import React from 'react';
import * as K from '@/lib/landing/chapters';
import { versions } from '@/lib/landing/facts';
import { labelOf } from '@/lib/landing/claims';
import { Arrow, SiteFooter, SiteHeader } from './Chrome';
import { StatusLabel } from './StatusLabel';
import { HeroConversation } from './HeroConversation';
import { ProofSequence } from './ProofSequence';
import { ZkAnalogy } from './ZkAnalogy';
import { Architecture } from './Architecture';
import { PhoneScreen } from './Phones';
import { GlyphIcon } from './Glyphs';
import s from './site.module.css';
import { getT } from '@/lib/i18n/server';

const Info = () => (
  <svg width="17" height="17" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M8 7v4M8 5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
);

function Head({ id, title, body, center, eyebrow }: { id: string; title: string; body?: string; center?: boolean; eyebrow?: string }) {
  return (
    <header className={`${s.head} ${center ? s.center : ''}`}>
      {eyebrow ? <p className={s.eyebrow}>{eyebrow}</p> : null}
      <h2 className={s.h2} id={`${id}-title`}>{title}</h2>
      {body ? <p className={s.body}>{body}</p> : null}
    </header>
  );
}

function Section({ id, tone, children }: { id: string; tone?: 'wash' | 'ink'; children: React.ReactNode }) {
  const cls = [s.section, tone === 'wash' ? s.sectionWash : '', tone === 'ink' ? `${s.sectionInk} ${s.onInk}` : ''].join(' ');
  return (
    <section id={id} className={cls} aria-labelledby={`${id}-title`}>
      <div className={s.wrap}>{children}</div>
    </section>
  );
}

export async function SiteLanding() {
  const __t = await getT();
  const v = versions();
  const stack = K.stackRows(v);

  return (
    <div className={s.site} data-site="public">
      <a href="#main" className={s.skip}>{__t("Skip to content")}</a>
      <SiteHeader />

      <main id="main">
        {/* Hero */}
        <section className={s.hero} aria-labelledby="hero-title">
          <div className={s.wrap}>
            <div className={s.heroGrid}>
              <div>
                <h1 className={s.h1} id="hero-title">{__t(K.HERO.title)}</h1>
                <p className={s.lede}>{K.HERO.line}</p>
                <div className={s.actions}>
                  <a className={`${s.btn} ${s.btnPrimary}`} href={K.HERO.primary.href}>{__t(K.HERO.primary.label)}<Arrow /></a>
                  <a className={s.textLink} href={K.HERO.secondary.href}>{__t(K.HERO.secondary.label)}<Arrow /></a>
                </div>
                <ul className={s.points}>
                  {K.HERO.points.map((p) => <li key={p}>{__t(p)}</li>)}
                </ul>
              </div>
              <div className={s.heroPhone}>
                <HeroConversation thread={K.HERO_THREAD} />
              </div>
            </div>
            <p className={s.builtOn}>
              <span>{__t("Built on open networks")}</span>
              <b>{__t("XMTP")}</b>
              <b>{__t("Aztec Network")}</b>
              <b>{__t("Ethereum")}</b>
            </p>
          </div>
        </section>

        {/* Features, one row each */}
        <section id="features" className={s.section} aria-label={__t("Features")}>
          <div className={`${s.wrap} ${s.rows}`}>
            {K.FEATURES_ROWS.map((r) => {
              const label = labelOf(r.claim);
              return (
                <article key={r.id} id={r.id} className={s.row} aria-labelledby={`${r.id}-title`}>
                  <div className={s.rowText}>
                    <h2 className={s.h2} id={`${r.id}-title`}>{r.title}</h2>
                    <p className={s.body}>{r.body}</p>
                    {r.note ? <p className={s.rowNote}><Info />{r.note}</p> : null}
                    {label === 'Not enabled yet' || label === 'In design' ? (
                      <div className={s.rowLabel}><StatusLabel label={label} /></div>
                    ) : null}
                  </div>
                  <div className={s.rowArt}>
                    <PhoneScreen screen={r.screen} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Why */}
        <Section id="why" tone="wash">
          <Head id="why" title={__t(K.WHY.title)} body={__t(K.WHY.body)} center />
          <ul className={s.why} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {K.WHY.items.map((w) => (
              <li key={w.title} className={s.whyCard}>
                <span className={s.whyIcon}><GlyphIcon name={w.glyph} /></span>
                <h3>{__t(w.title)}</h3>
                <p>{__t(w.text)}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* How it protects you, and a private payment step by step */}
        <Section id="how">
          <Head id="how" eyebrow={__t("How it works")} title={__t(K.HOW.title)} body={__t(K.HOW.body)} center />
          <ul className={s.pillars} style={{ listStyle: 'none', padding: 0 }}>
            {K.HOW.pillars.map((p, i) => (
              <li key={p.title} className={s.pillar}>
                <GlyphIcon name={(['device', 'network', 'people'] as const)[i]} size={30} />
                <h3>{__t(p.title)}</h3>
                <p>{__t(p.text)}</p>
              </li>
            ))}
          </ul>
          <div className={s.subHead} id="payment">
            <div>
              <h3 className={s.h3}>{__t(K.PAYMENT.title)}</h3>
              <p>{__t(K.PAYMENT.body)}</p>
            </div>
          </div>
          <ProofSequence steps={K.PAYMENT.steps} label={<StatusLabel label={K.PAYMENT.label} />} />
          <p className={s.honest}><Info />{K.PAYMENT.honest}</p>
        </Section>

        {/* Zero-knowledge, in plain words */}
        <Section id="zero-knowledge" tone="wash">
          <div className={s.zkGrid}>
            <Head id="zero-knowledge" eyebrow={__t("Zero-knowledge, in plain words")} title={__t(K.ZK.title)} body={__t(K.ZK.body)} />
            <ZkAnalogy steps={K.ZK.analogy} />
          </div>
          <ol className={s.timeline} aria-label={__t("Zero-knowledge proofs, from 1985 to today")}>
            {K.ZK.timeline.map((t) => (
              <li key={t.year} className={s.tlItem}>
                <span className={s.tlYear}>{t.year}</span>
                <span className={s.tlText}>{__t(t.text)}</span>
              </li>
            ))}
          </ol>
          <div className={s.bridge}>
            <p>{K.ZK.bridge}</p>
            <a className={s.textLink} href={K.ZK.more.href}>{__t(K.ZK.more.label)}<Arrow /></a>
          </div>
        </Section>

        {/* What our server can see */}
        <Section id="visibility">
          <Head id="visibility" eyebrow={__t("Transparency")} title={__t(K.VISIBILITY.title)} body={__t(K.VISIBILITY.body)} center />
          <div className={`${s.tableWrap} ${s.tableCard}`}>
            <table className={`${s.table} ${s.vis}`}>
              <caption className={s.srOnly}>{__t("Who can read each part of Ledger Chat today, and what our server sees")}</caption>
              <thead><tr>{K.VISIBILITY.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>
                {K.VISIBILITY.rows.map((r) => (
                  <tr key={r.part}>
                    <th scope="row">
                      {__t(r.part)}
                      <span className={`${s.mark} ${r.e2e ? s.markOn : s.markOff}`} style={{ display: 'flex' }}>
                        <i aria-hidden="true" />{r.e2e ? __t("Encrypted from end to end") : __t("Readable by our server today")}
                      </span>
                    </th>
                    <td data-k={K.VISIBILITY.head[1]}>{__t(r.who)}</td>
                    <td data-k={K.VISIBILITY.head[2]}>{__t(r.server)}</td>
                    <td data-k={K.VISIBILITY.head[3]}>{__t(r.next) || __t("No change needed")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Under the hood */}
        <Section id="architecture" tone="wash">
          <Head id="architecture" eyebrow={__t("Architecture")} title={__t(K.ARCHITECTURE.title)} body={__t(K.ARCHITECTURE.body)} />
          <Architecture nodes={K.ARCHITECTURE.nodes} states={K.ARCHITECTURE.states} goal={K.ARCHITECTURE.goal} />
          <div style={{ display: 'grid', gap: 20, marginTop: 56 }}>
            <div className={`${s.tableWrap} ${s.tableCard}`}>
              <table className={`${s.table} ${s.stack}`}>
                <caption className={s.srOnly}>{__t("The stack, layer by layer")}</caption>
                <thead><tr>{K.ARCHITECTURE.stackHead.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
                <tbody>
                  {stack.map((r) => (
                    <tr key={r.layer}>
                      <th scope="row">{r.layer}</th>
                      <td data-k="Technology">{r.tech}</td>
                      <td data-k="Standard">{r.standard}</td>
                      <td data-k="Status"><StatusLabel label={r.label} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={s.tableCard}>
              <h3 className={s.h3} style={{ fontSize: 22, margin: '18px 0 6px' }}>{__t(K.MESSAGES.title)}</h3>
              <dl className={s.spec}>
                {K.MESSAGES.spec.map((r) => (
                  <div key={r.k} className={s.specRow}><dt>{r.k}</dt><dd>{r.v}</dd></div>
                ))}
              </dl>
              <p className={s.limit} style={{ marginBottom: 18 }}><Info />{K.MESSAGES.limit}</p>
            </div>
          </div>
        </Section>

        {/* For organisations: Ledger Relay */}
        <Section id="relay" tone="ink">
          <div className={s.relayGrid}>
            <div>
              <div className={s.relayHead}>
                <p className={s.eyebrow}>{__t("For organisations")}</p>
                <StatusLabel label={K.RELAY.label} />
              </div>
              <h2 className={s.h2} id="relay-title">{__t(K.RELAY.title)}</h2>
              <p className={s.body}>{__t(K.RELAY.body)}</p>
              <a className={s.inkLink} href={K.RELAY.source.href} target="_blank" rel="noopener noreferrer">{__t(K.RELAY.source.label)}<Arrow /></a>
            </div>
            <div className={s.relayPanel}>
              <dl className={s.spec}>
                {K.RELAY.carries.map((r) => (
                  <div key={r.k} className={s.specRow}><dt>{r.k}</dt><dd>{r.v}</dd></div>
                ))}
              </dl>
              <p className={s.never}>{K.RELAY.never}</p>
              <p className={s.relayGoal}>{K.RELAY.goal}</p>
            </div>
          </div>
        </Section>

        {/* Open and verifiable */}
        <Section id="open">
          <Head id="open" eyebrow={__t("Open and verifiable")} title={__t(K.OPEN.title)} body={__t(K.OPEN.body)} center />
          <div className={s.cards}>
            {K.OPEN.cards.map((c) => (
              <a key={c.title} className={s.card} href={c.href} {...(c.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                <h3>{__t(c.title)}</h3>
                <p>{__t(c.text)}</p>
                <span>{__t(c.cta)}<Arrow /></span>
              </a>
            ))}
          </div>
          <p className={s.reviewNote}>{K.OPEN.review}</p>
        </Section>

        {/* What's next */}
        <Section id="next" tone="wash">
          <Head id="next" eyebrow={__t("Roadmap")} title={__t(K.NEXT.title)} body={__t(K.NEXT.body)} center />
          <ul className={s.next} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {K.NEXT.items.map((n) => (
              <li key={n.title} className={s.nextItem}>
                <StatusLabel label={labelOf(n.claim)} />
                <h3>{__t(n.title)}</h3>
                <p>{__t(n.text)}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* Questions */}
        <Section id="questions">
          <Head id="questions" title={__t("Questions")} center />
          <div className={s.faq}>
            {K.FAQ.map((f) => (
              <details key={f.q} className={s.faqItem}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </Section>

        {/* Every screen */}
        <section id="start" className={s.section} style={{ paddingTop: 0 }} aria-labelledby="start-title">
          <div className={s.wrap}>
            <div className={s.closing}>
              <h2 className={s.h2} id="start-title">{__t(K.CLOSING.title)}</h2>
              <p className={s.body}>{__t(K.CLOSING.body)}</p>
              <a className={s.btn} href="/chat">{__t("Open Ledger Chat")}<Arrow /></a>
              <div className={s.devices}>
                {K.DEVICES.map((d) => (
                  <div key={d.name} className={s.device}><b>{d.name}</b><span>{d.how}</span></div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
