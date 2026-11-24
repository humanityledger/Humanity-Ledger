import type { Metadata } from 'next';
import React from 'react';
import mainnet from '@/deployments/aztec-mainnet.json';
import { WAVE1_CLASSES } from '@/lib/landing/content';
import { EXTERNAL_LINKS } from '@/lib/constants/links';
import { SiteFooter, SiteHeader } from '@/components/landing/site/Chrome';
import { CopyText } from '@/components/landing/site/CopyText';
import s from '@/components/landing/site/site.module.css';
import { getT } from '@/lib/i18n/server';

/**
 * Ledger Record: the reviewer page that took over the landing's "On chain" section (landing brief,
 * chapter 11). Every value is read from deployments/aztec-mainnet.json and deployments/aztec-testnet.json
 * at build time; nothing is typed here. Hashes are shown shortened, with the full value in the title
 * and a copy button, and each links to the public explorer.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ledger Record: what Ledger Chat deployed, on a public record',
  description: 'Deployments and the first private payments sent from Ledger Chat on Aztec Alpha, each with its transaction and a link to the public explorer.',
  alternates: { canonical: '/record' },
};

type Tx = { step?: string; what?: string; txHash: string; block: number; feeAztec?: string };
type Rec = {
  network: { name: string; l1ChainId: number; rollupVersion: number };
  audit: unknown;
  internalReview?: { report: string; date: string; baseCommit: string };
  closedAlpha?: { maxTesters?: number; classes?: string[] };
  firstPrivatePayment: { date: string; txs: Tx[]; confirmedBy: string };
  secondPrivatePayment: { date: string; txHash: string; block: number; amount: string; onChain: string; confirmedBy: string };
  measuredFees: { txs: Tx[] };
  newUserFlow: { firstPayment: { txHash: string; block: number; amount: string; onChain: string } };
};
const R = mainnet as unknown as Rec;

const EXPLORER = 'https://aztecscan.xyz/tx-effects/';
const REPO = EXTERNAL_LINKS.github.repo;

/** Plain names for the record's steps, without amounts or asset names. */
function describe(step: string): string {
  const t = step.toLowerCase();
  if (t.includes('deploy')) return 'Token contract deployed';
  if (t.includes('issue') || t.includes('mint')) return 'Issued to a private balance';
  if (t.includes('account created') || t.includes("contact's deposit")) return 'Private transfer from a newly created account';
  if (t.includes('gas limits estimated')) return 'Private transfer, with the network fee estimated beforehand';
  if (t.includes('wallet screen')) return 'Private transfer from the wallet screen';
  if (t.includes('claimed')) return 'Private transfer that also claimed a fee deposit';
  if (t.includes('transfer')) return 'Private transfer';
  return 'Transaction';
}

async function TxCell({ hash }: { hash: string }) {
  const __t = await getT();
  return <CopyText value={hash} label={__t("transaction hash")} />;
}
async function Explorer({ hash }: { hash: string }) {
  const __t = await getT();
  return <a className={s.extLink} href={`${EXPLORER}${hash}`} target="_blank" rel="noopener noreferrer">{__t("View on Aztecscan")}</a>;
}

export default async function RecordPage() {
  const __t = await getT();
  const fees = new Map(R.measuredFees.txs.map((t) => [t.txHash, t.feeAztec]));
  const payments: { what: string; hash: string; block: number; date: string }[] = [
    ...R.firstPrivatePayment.txs.map((t) => ({ what: t.step ?? '', hash: t.txHash, block: t.block, date: R.firstPrivatePayment.date })),
    { what: 'private transfer from the wallet screen', hash: R.secondPrivatePayment.txHash, block: R.secondPrivatePayment.block, date: R.secondPrivatePayment.date },
    ...R.measuredFees.txs
      .filter((t) => ![...R.firstPrivatePayment.txs.map((x) => x.txHash), R.secondPrivatePayment.txHash].includes(t.txHash))
      .map((t) => ({ what: t.what ?? '', hash: t.txHash, block: t.block, date: R.secondPrivatePayment.date })),
  ].sort((a, b) => a.block - b.block);

  return (
    <div className={s.site} data-site="public">
      <a href="#main" className={s.skip}>{__t("Skip to content")}</a>
      <SiteHeader home={false} />
      <main id="main">
        <section className={s.pageHead}>
          <div className={s.wrap}>
            <p className={s.eyebrow}>{__t("Ledger Record")}</p>
            <h1 className={s.h1}>{__t("What we deployed, and what it did.")}</h1>
            <p className={s.lede}>
              {__t("Every entry on this page is read from the deployment records in our repository and links to a public explorer, so anyone can check it without trusting us. On chain, a private transfer shows note hashes, nullifiers and the fee payment; it does not show the sender, the recipient or the amount.")}
            </p>
          </div>
        </section>

        <section className={s.section} aria-labelledby="network-title">
          <div className={s.wrap}>
            <header className={s.head}>
              <p className={s.eyebrow}>{__t("Network and assurance")}</p>
              <h2 className={s.h2} id="network-title">{__t("Where it runs, and who has reviewed it.")}</h2>
            </header>
            <dl className={s.facts}>
              <div><dt>{__t("Network")}</dt><dd>{R.network.name}</dd></div>
              <div><dt>{__t("Settles on")}</dt><dd>{__t("Ethereum, chain {l1ChainId}", { l1ChainId: R.network.l1ChainId })}</dd></div>
              <div><dt>{__t("Rollup version")}</dt><dd>{R.network.rollupVersion}</dd></div>
              <div><dt>{__t("External audit")}</dt><dd>{R.audit ? __t("See report") : __t("None yet")}</dd></div>
            </dl>
            {R.internalReview ? (
              <p className={s.note}>{__t("Internal security review of {date}, at commit {0}:{value}{1}. It is not an external audit.", { date: R.internalReview.date, 0: <code className={s.mono}>{R.internalReview.baseCommit}</code>, value: ' ', 1: <a className={s.extLink} href={`${REPO}/blob/main/${R.internalReview.report}`} target="_blank" rel="noopener noreferrer">{__t("read the report")}</a> })}</p>
            ) : null}
          </div>
        </section>

        <section className={s.section} aria-labelledby="payments-title">
          <div className={s.wrap}>
            <header className={s.head}>
              <p className={s.eyebrow}>{__t("First private payments")}</p>
              <h2 className={s.h2} id="payments-title">{__t("The first transactions from Ledger Chat on Aztec Alpha.")}</h2>
              <p className={s.body}>
                {__t("Every private payment recorded here went between two accounts of the operator. Each account pays its own network fee in Fee Juice, and that fee payment is public.")}
              </p>
            </header>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <caption className={s.srOnly}>{__t("Recorded transactions on Aztec Alpha")}</caption>
                <thead><tr><th scope="col">{__t("Block")}</th><th scope="col">{__t("What")}</th><th scope="col">{__t("Transaction")}</th><th scope="col">{__t("Fee")}</th><th scope="col"><span className={s.srOnly}>{__t("Explorer")}</span></th></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.hash}>
                      <th scope="row" className={s.mono}>{p.block}</th>
                      <td>{__t(describe(p.what))}</td>
                      <td><TxCell hash={p.hash} /></td>
                      <td className={s.mono}>{fees.get(p.hash) ? __t("{get} AZTEC", { get: fees.get(p.hash) }) : '—'}</td>
                      <td><Explorer hash={p.hash} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={s.note}>{__t("The first three transactions were confirmed by the read-only preflight workflow in our public CI; the others are confirmed on Aztecscan.")}</p>
          </div>
        </section>

        {WAVE1_CLASSES.length ? (
          <section className={`${s.section} ${s.sectionWash}`} aria-labelledby="classes-title">
            <div className={s.wrap}>
              <header className={s.head}>
                <p className={s.eyebrow}>{__t("Closed alpha")}</p>
                <h2 className={s.h2} id="classes-title">{__t("The contract classes of the closed alpha.")}</h2>
                <p className={s.body}>{__t("Escrow and payment streams are tested on the Aztec test network and refused on Aztec Alpha until an external audit.{value}", { value: R.closedAlpha?.maxTesters ? __t(" The closed alpha is limited to {maxTesters} testers.", { maxTesters: R.closedAlpha.maxTesters }) : '' })}
                </p>
              </header>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead><tr><th scope="col">{__t("Contract")}</th><th scope="col">{__t("Class id")}</th></tr></thead>
                  <tbody>
                    {WAVE1_CLASSES.map((c) => (
                      <tr key={c.id}><th scope="row">{__t(c.name)}</th><td><CopyText value={__t(c.id)} label={__t("{name} class id", { name: c.name })} /></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : null}

        <section className={s.section} aria-labelledby="source-title">
          <div className={s.wrap}>
            <header className={s.head}>
              <p className={s.eyebrow}>{__t("Source of this page")}</p>
              <h2 className={s.h2} id="source-title">{__t("Check it against the repository.")}</h2>
            </header>
            <ul className={s.links}>
              {[
                { k: 'Alpha record', v: 'deployments/aztec-mainnet.json', href: `${REPO}/blob/main/deployments/aztec-mainnet.json` },
                { k: 'Test network record', v: 'deployments/aztec-testnet.json', href: `${REPO}/blob/main/deployments/aztec-testnet.json` },
                { k: 'Preflight runs', v: 'Read-only checks of the record against the network', href: `${REPO}/actions` },
              ].map((it) => (
                <li key={it.k}>
                  <a className={s.linkRow} href={it.href} target="_blank" rel="noopener noreferrer"><b>{it.k}</b><span>{it.v}</span><span aria-hidden="true">→</span></a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
