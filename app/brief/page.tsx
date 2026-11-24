import type { Metadata } from 'next';
import { BrandedQr } from '@/components/chat/profile/BrandedQr';
import React from 'react';
import { HLLogo } from '@/components/shared/HLLogo';
import { EXTERNAL_LINKS } from '@/lib/constants/links';
import { LEGAL_ENTITY } from '@/lib/constants/legalEntity';
import { FEATURES_ROWS, HERO, NEXT, PAYMENT, VISIBILITY } from '@/lib/landing/chapters';
import { labelOf, type ClaimLabel } from '@/lib/landing/claims';
import { PrintButton } from './PrintButton';
import s from './brief.module.css';
import Link from 'next/link';
import { getT } from '@/lib/i18n/server';

/**
 * /brief: a printable one-page A4 summary for events (landing brief, "Also build"). The same
 * claims as the landing, read from lib/landing/chapters.ts, so the paper never says more than the
 * page. The QR code is the app's own (round dots, rounded eyes, the mark in the centre) and points
 * to the site.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ledger Chat: one-page brief',
  description: 'A printable one-page summary of Ledger Chat: what it is, how it protects people, what our server sees and where it stands.',
  alternates: { canonical: '/brief' },
};

const SITE = 'https://ledgerchat.org';

export default async function BriefPage() {
  const t = await getT();
  const row = (id: string) => FEATURES_ROWS.find((r) => r.id === id)!;
  type StatusRow = { label: ClaimLabel; items: string[] };
  const rows: StatusRow[] = [
    { label: t("Live"), items: ['Direct and group messages', 'Voice and video calls', '@usernames and QR codes'] },
    { label: t("Closed alpha"), items: ['Private payments on Aztec Network, with a cap per payment'] },
    ...(['Not enabled yet', 'In design'] as ClaimLabel[]).map((label) => ({
      label,
      items: [...NEXT.items.filter((n) => labelOf(n.claim) === label).map((n) => n.title), ...(label === labelOf('files') ? ['Files of up to 32 GB'] : [])],
    })),
  ];
  const status = rows.filter((c) => c.items.length);

  return (
    <div className={s.desk}>
      <div className={s.bar}>
        <Link href="/">{t("Ledger Chat")}</Link>
        <PrintButton className={s.print} />
      </div>

      <article className={s.sheet} aria-label={t("Ledger Chat, one-page brief")}>
        <header className={s.top}>
          <span className={s.lock}><HLLogo variant="mark" size={22} label={t("Ledger Chat")} />{t("Ledger Chat")}</span>
          <span className={s.asOf}>{t("ledgerchat.org")}</span>
        </header>

        <section>
          <h1 className={s.title}>{t(HERO.title)}</h1>
          <p className={s.lede}>{t(HERO.line)}</p>
        </section>

        <section className={s.cols}>
          <div>
            <h2 className={s.h}>{t("No phone number")}</h2>
            <p>{t(row('identity').body)}</p>
          </div>
          <div>
            <h2 className={s.h}>{t("Messages and calls")}</h2>
            <p>{t(row('messages').body)} {t(row('calls').body)}</p>
          </div>
          <div>
            <h2 className={s.h}>{t("Private payments")}</h2>
            <p>{t("Each payment is proved on your device with Aztec. The network checks the proof without learning the amount or the recipient. {honest}", { honest: t(PAYMENT.honest) })}</p>
          </div>
        </section>

        <section className={s.twin}>
          <div>
            <h2 className={s.h}>{t(VISIBILITY.title)}</h2>
            <table className={s.tbl}>
              <thead><tr><th scope="col">{t("Part")}</th><th scope="col">{t("What our server sees today")}</th></tr></thead>
              <tbody>
                {VISIBILITY.rows.map((r) => (
                  <tr key={r.part}>
                    <th scope="row"><span className={r.e2e ? s.e2e : s.srv} aria-hidden="true">● </span>{t(r.part)}</th>
                    <td>{t(r.server)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h2 className={s.h}>{t("Where Ledger Chat stands")}</h2>
            <ul className={s.status}>
              {status.map((c) => (
                <li key={c.label}><b>{c.label}</b><span>{c.items.join('. ')}.</span></li>
              ))}
            </ul>
          </div>
        </section>

        <footer className={s.bottom}>
          <div>
            <p className={s.fine}>{t("Built on XMTP, Aztec Network and Ethereum. Source code: {replace}. Our contracts have had an internal security review, not an external audit. Report vulnerabilities privately through GitHub.", { replace: EXTERNAL_LINKS.github.repo.replace('https://', '') })}</p>
            <p className={s.fine} style={{ marginTop: '2mm' }}>{t("Ledger Chat, made by {tradingName}. Not a bank, broker or exchange; nothing here is financial advice. XMTP, Aztec and Ethereum are trademarks of their respective owners.", { tradingName: t(LEGAL_ENTITY.tradingName) })}</p>
          </div>
          <div className={s.qr}>
            <BrandedQr value={SITE} title={t("QR code for ledgerchat.org")} style={{ width: "26mm", height: "26mm" }} />
            <span>{t("ledgerchat.org")}</span>
          </div>
        </footer>
      </article>
    </div>
  );
}
