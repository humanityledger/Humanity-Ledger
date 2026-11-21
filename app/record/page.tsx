import type { Metadata } from 'next';
import React from 'react';
import mainnet from '@/deployments/aztec-mainnet.json';
import { WAVE1_CLASSES } from '@/lib/landing/content';
import { EXTERNAL_LINKS } from '@/lib/constants/links';
import { SiteFooter, SiteHeader } from '@/components/landing/site/Chrome';
import { CopyText } from '@/components/landing/site/CopyText';
import s from '@/components/landing/site/site.module.css';

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

function TxCell({ hash }: { hash: string }) {
  return <CopyText value={hash} label="transaction hash" />;
}
function Explorer({ hash }: { hash: string }) {
  return <a className={s.extLink} href={`${EXPLORER}${hash}`} target="_blank" rel="noopener noreferrer">View on Aztecscan</a>;
}

export default function RecordPage() {
  const fees = new Map(R.measuredFees.txs.map((t) => [t.txHash, t.feeAztec]));
  const payments: { what: string; hash: string; block: number; date: string }[] = [
    ...R.firstPrivatePayment.txs.map((t) => ({ what: t.step ?? '', hash: t.txHash, block: t.block, date: R.firstPrivatePayment.date })),
    { what: 'private transfer from the wallet screen', hash: R.secondPrivatePayment.txHash, block: R.secondPrivatePayment.block, date: R.secondPrivatePayment.date },
    ...R.measuredFees.txs
      .filter((t) => ![...R.firstPrivatePayment.txs.map((x) => x.txHash), R.secondPrivatePayment.txHash].includes(t.txHash))
      .map((t) => ({ what: t.what ?? '', hash: t.txHash, block: t.block, date: R.secondPrivatePayment.date })),
  ].sort((a, b) => a.block - b.block);

  return (
    <div className={s.site}>
      <a href="#main" className={s.skip}>Skip to content</a>
      <SiteHeader home={false} />
      <main id="main">
        <section className={s.pageHead}>
          <div className={s.wrap}>
            <p className={s.eyebrow}>Ledger Record</p>
            <h1 className={s.h1}>What we deployed, and what it did.</h1>
            <p className={s.lede}>
              Every entry on this page is read from the deployment records in our repository and links to a public explorer, so anyone can check it
              without trusting us. On chain, a private transfer shows note hashes, nullifiers and the fee payment; it does not show the sender, the
              recipient or the amount.
            </p>
          </div>
        </section>

        <section className={s.section} aria-labelledby="network-title">
          <div className={s.wrap}>
            <header className={s.head}>
              <p className={s.eyebrow}>Network and assurance</p>
              <h2 className={s.h2} id="network-title">Where it runs, and who has reviewed it.</h2>
            </header>
            <dl className={s.facts}>
              <div><dt>Network</dt><dd>{R.network.name}</dd></div>
              <div><dt>Settles on</dt><dd>Ethereum, chain {R.network.l1ChainId}</dd></div>
              <div><dt>Rollup version</dt><dd>{R.network.rollupVersion}</dd></div>
              <div><dt>External audit</dt><dd>{R.audit ? 'See report' : 'None yet'}</dd></div>
            </dl>
            {R.internalReview ? (
              <p className={s.note}>
                Internal security review of {R.internalReview.date}, at commit <code className={s.mono}>{R.internalReview.baseCommit}</code>:{' '}
                <a className={s.extLink} href={`${REPO}/blob/main/${R.internalReview.report}`} target="_blank" rel="noopener noreferrer">read the report</a>.
                It is not an external audit.
              </p>
            ) : null}
          </div>
        </section>

        <section className={s.section} aria-labelledby="payments-title">
          <div className={s.wrap}>
            <header className={s.head}>
              <p className={s.eyebrow}>First private payments</p>
              <h2 className={s.h2} id="payments-title">The first transactions from Ledger Chat on Aztec Alpha.</h2>
              <p className={s.body}>
                Every private payment recorded here went between two accounts of the operator. Each account pays its own network fee in Fee Juice,
                and that fee payment is public.
              </p>
            </header>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <caption className={s.srOnly}>Recorded transactions on Aztec Alpha</caption>
                <thead><tr><th scope="col">Block</th><th scope="col">What</th><th scope="col">Transaction</th><th scope="col">Fee</th><th scope="col"><span className={s.srOnly}>Explorer</span></th></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.hash}>
                      <th scope="row" className={s.mono}>{p.block}</th>
                      <td>{describe(p.what)}</td>
                      <td><TxCell hash={p.hash} /></td>
                      <td className={s.mono}>{fees.get(p.hash) ? `${fees.get(p.hash)} AZTEC` : '—'}</td>
                      <td><Explorer hash={p.hash} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={s.note}>The first three transactions were confirmed by the read-only preflight workflow in our public CI; the others are confirmed on Aztecscan.</p>
          </div>
        </section>

        {WAVE1_CLASSES.length ? (
          <section className={`${s.section} ${s.sectionWash}`} aria-labelledby="classes-title">
            <div className={s.wrap}>
              <header className={s.head}>
                <p className={s.eyebrow}>Closed alpha</p>
                <h2 className={s.h2} id="classes-title">The contract classes of the closed alpha.</h2>
                <p className={s.body}>
                  Escrow and payment streams are tested on the Aztec test network and refused on Aztec Alpha until an external audit.
                  {R.closedAlpha?.maxTesters ? ` The closed alpha is limited to ${R.closedAlpha.maxTesters} testers.` : ''}
                </p>
              </header>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead><tr><th scope="col">Contract</th><th scope="col">Class id</th></tr></thead>
                  <tbody>
                    {WAVE1_CLASSES.map((c) => (
                      <tr key={c.id}><th scope="row">{c.name}</th><td><CopyText value={c.id} label={`${c.name} class id`} /></td></tr>
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
              <p className={s.eyebrow}>Source of this page</p>
              <h2 className={s.h2} id="source-title">Check it against the repository.</h2>
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
