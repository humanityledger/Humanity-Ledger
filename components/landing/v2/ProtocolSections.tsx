"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatUnits } from "@/lib/aztec/wallet/amounts";
import {
  ALLOCATIONS,
  FEE_ROUTING,
  HLC_DECIMALS,
  HLC_MAX_SUPPLY,
  LAUNCH_CONDITIONS,
  STAKING_LOCKS,
  TEAM_VESTING,
  teamVested,
  type Allocation,
} from "@/lib/protocol/tokenomics";
import { useProtocolReport } from "@/components/protocol/useProtocolReport";
import s from "./Landing.module.css";
import p from "./Protocol.module.css";

/**
 * Landing sections: how the layers fit, where it runs, and HLC.
 *
 * Every token figure comes from lib/protocol/tokenomics.ts (bigint, tested), and the live figures
 * from GET /api/protocol/metrics, so the page cannot say something the protocol does not. HLC is
 * presented as a plan: nothing is sold, and the launch conditions are shown with their real state.
 */

const COLOR: Record<Allocation["id"], string> = {
  community: "var(--c-community)",
  "fair-launch": "var(--c-fair)",
  treasury: "var(--c-treasury)",
  team: "var(--c-team)",
};

const UNIT = 10n ** BigInt(HLC_DECIMALS);
const whole = (units: bigint) => formatUnits(units, HLC_DECIMALS, 0);
const pct = (bps: bigint) => `${(bps / 100n).toString()}%`;

/* ── How it fits together ─────────────────────────────────────────────────── */

const LAYERS = [
  {
    name: "Ledger Chat",
    text: "The app: direct messages, communities, calls and a private wallet, in the browser on a computer or a phone.",
    fact: "Your wallet is your account",
  },
  {
    name: "XMTP with MLS",
    text: "Direct messages are encrypted on your device with the MLS protocol and carried by the XMTP network. Only the two of you hold the keys.",
    fact: "End-to-end encrypted",
  },
  {
    name: "Aztec Alpha",
    text: "Private payments and agreements. Amounts and recipients stay private, and the proof is made on your own device. On Alpha the account that pays the network fee is visible.",
    fact: "Proofs made on your device",
  },
  {
    name: "Ethereum",
    text: "Aztec settles on Ethereum mainnet. Network fees are paid in Fee Juice, bridged from Ethereum through Aztec's own portal, which the app pins and checks.",
    fact: "Settles on chain 1",
  },
] as const;

export function StackSection() {
  return (
    <div className={p.section}>
      <div className={s.sectionHead}>
        <h2 id="stack-title" className={s.h2}>
          Four layers, each doing one job.
        </h2>
        <p className={p.lead}>
          Ledger Chat does not invent its own cryptography. It joins open protocols that already carry real messages and
          real value, and checks each of them before it trusts them.
        </p>
      </div>
      <ol className={p.stack}>
        {LAYERS.map((l) => (
          <li key={l.name} className={p.layer}>
            <h3 className={p.layerName}>{l.name}</h3>
            <p className={p.layerText}>{l.text}</p>
            <p className={p.layerFact}>{l.fact}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ── Where it runs ────────────────────────────────────────────────────────── */

const DEVICES = [
  {
    name: "Computer",
    frame: "desktop",
    live: true,
    status: "Available now",
    text: "Any current browser on macOS, Windows or Linux. Nothing to install.",
  },
  {
    name: "iPhone",
    frame: "phone",
    live: true,
    status: "In Safari now",
    text: "Open ledgerchat.org in Safari and add it to the Home Screen. A native app is in development.",
  },
  {
    name: "Android",
    frame: "phone",
    live: true,
    status: "In Chrome now",
    text: "Open ledgerchat.org in Chrome and install it from the menu. A native app is in development.",
  },
] as const;

export function DevicesSection() {
  return (
    <div className={p.section}>
      <div className={s.sectionHead}>
        <h2 id="devices-title" className={s.h2}>
          The same account on every screen.
        </h2>
        <p className={p.lead}>
          Sign in with the same wallet and your conversations follow you. Proofs for private payments are made on the
          device you are holding.
        </p>
      </div>
      <div className={p.devices}>
        {DEVICES.map((d) => (
          <article key={d.name} className={p.device}>
            <div className={`${p.deviceFrame} ${d.frame === "desktop" ? p.frameDesktop : p.framePhone}`} aria-hidden="true">
              <span className={p.screenLine} />
              <span className={p.screenLine} />
              <span className={p.screenLine} />
            </div>
            <h3 className={p.deviceName}>{d.name}</h3>
            <p className={p.deviceStatus}>
              <span className={d.live ? p.dotLive : p.dotLater} aria-hidden="true" />
              {d.status}
            </p>
            <p className={p.deviceText}>{d.text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ── HLC ──────────────────────────────────────────────────────────────────── */

/** One cell per million HLC, in allocation order. */
function SupplyLedger() {
  const cells = useMemo(() => {
    const out: { id: Allocation["id"]; i: number }[] = [];
    const perCell = 1_000_000n * UNIT;
    for (const a of ALLOCATIONS) {
      const n = Number(a.amount / perCell); // a count of cells for layout, not money
      for (let k = 0; k < n; k++) out.push({ id: a.id, i: out.length });
    }
    return out;
  }, []);
  return (
    <div className={p.ledger} role="img" aria-label="One thousand squares, one per million HLC: 450 community airdrop, 200 fair launch, 200 protocol treasury, 150 team.">
      {cells.map((c) => (
        <i
          key={c.i}
          className={p.cell}
          style={{ ["--c" as string]: COLOR[c.id], ["--p" as string]: (c.i / cells.length).toFixed(3) } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/** Team tokens vested by month, from teamVested (bigint). */
function VestingChart() {
  const months = TEAM_VESTING.totalMonths;
  const team = ALLOCATIONS.find((a) => a.id === "team")!.amount;
  const points = useMemo(() => Array.from({ length: months + 1 }, (_, m) => ({ m, v: teamVested(m) })), [months]);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const ref = useRef<SVGSVGElement>(null);

  const W = 880;
  const H = 280;
  const pad = { l: 64, r: 16, t: 16, b: 36 };
  const x = (m: number) => pad.l + (m / months) * (W - pad.l - pad.r);
  // Pixel positions only: the ratio of two bigints scaled to 10,000 before it becomes a number.
  const y = (v: bigint) => pad.t + (1 - Number((v * 10_000n) / team) / 10_000) * (H - pad.t - pad.b);
  // A step at the cliff: flat at zero until month 18, then straight up to what vests that month.
  const path = points
    .map((pt, i) => {
      const prev = points[i - 1];
      const step = prev && prev.v === 0n && pt.v > 0n ? `L${x(pt.m).toFixed(1)},${y(0n).toFixed(1)} ` : "";
      return `${step}${i ? "L" : "M"}${x(pt.m).toFixed(1)},${y(pt.v).toFixed(1)}`;
    })
    .join(" ");
  const ticksY = [0n, team / 2n, team];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = ref.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const m = Math.round(((sx - pad.l) / (W - pad.l - pad.r)) * months);
    setHover(Math.max(0, Math.min(months, m)));
  };

  const hp = hover === null ? null : points[hover];

  return (
    <div className={p.chart}>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className={p.chartSvg}
        role="img"
        aria-label={`Team tokens vested by month: none before month ${TEAM_VESTING.cliffMonths}, then linear to all ${whole(team)} HLC at month ${months}.`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticksY.map((t) => (
          <g key={t.toString()}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e4e7ec" strokeWidth={1} />
            <text x={pad.l - 10} y={y(t) + 4} textAnchor="end" fontSize={12} fill="#727a88">
              {t === 0n ? "0" : `${whole(t / 1_000_000n)}M`}
            </text>
          </g>
        ))}
        {[0, TEAM_VESTING.cliffMonths, 24, 36, months].map((m) => (
          <text key={m} x={x(m)} y={H - 10} textAnchor="middle" fontSize={12} fill="#727a88">
            {m === 0 ? "Genesis" : `Month ${m}`}
          </text>
        ))}
        <line x1={x(TEAM_VESTING.cliffMonths)} x2={x(TEAM_VESTING.cliffMonths)} y1={pad.t} y2={H - pad.b} stroke="#e4e7ec" strokeWidth={1} />
        <path d={path} fill="none" stroke="var(--c-team)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(months)} cy={y(team)} r={4} fill="var(--c-team)" />
        {hp && (
          <g>
            <line x1={x(hp.m)} x2={x(hp.m)} y1={pad.t} y2={H - pad.b} stroke="#a3a9b4" strokeWidth={1} />
            <circle cx={x(hp.m)} cy={y(hp.v)} r={5} fill="var(--c-team)" stroke="#ffffff" strokeWidth={2} />
          </g>
        )}
        {/* Hit area larger than the line */}
        <rect x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={H - pad.t - pad.b} fill="transparent" />
      </svg>
      {hp && (
        <div className={p.tooltip} style={{ left: `${(x(hp.m) / W) * 100}%` }} role="status">
          {hp.m === 0 ? "Genesis" : `Month ${hp.m}`}: {whole(hp.v)} HLC vested
        </div>
      )}
      <button type="button" className={p.tableToggle} onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
        {showTable ? "Hide the table" : "Show as a table"}
      </button>
      {showTable && (
        <table className={p.table}>
          <thead>
            <tr>
              <th>Month</th>
              <th>Team HLC vested</th>
            </tr>
          </thead>
          <tbody>
            {[0, 17, 18, 24, 30, 36, 42, 48].map((m) => (
              <tr key={m}>
                <td>{m === 0 ? "Genesis" : m}</td>
                <td>{whole(teamVested(m))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function LiveFigures() {
  const { state } = useProtocolReport();
  const get = (id: string) => (state.kind === "ready" ? state.report.metrics.find((m) => m.id === id) : undefined);
  const items = [
    { id: "hlc-supply", label: "HLC minted today" },
    { id: "hlc-admin", label: "Minting authority" },
    { id: "protocol-fees", label: "Protocol fees collected" },
  ];
  return (
    <div className={p.live} aria-live="polite">
      {items.map((it) => {
        const m = get(it.id);
        return (
          <div key={it.id} className={p.liveItem}>
            <p className={p.liveLabel}>{it.label}</p>
            {state.kind === "loading" ? (
              <span className={p.liveSkeleton} aria-hidden="true" />
            ) : (
              <p className={p.liveValue}>{m?.value ?? "—"}</p>
            )}
          </div>
        );
      })}
      <Link href="/protocol" className={p.liveLink}>
        Read on the network
      </Link>
    </div>
  );
}

export function TokenSection() {
  return (
    <div className={p.section}>
      <div className={`${s.sectionHead} ${p.supplyHead}`}>
        <h2 id="hlc-title" className={p.supply}>
          {whole(HLC_MAX_SUPPLY)}
          <span className={p.supplyUnit}>HLC, planned as a fixed supply. On-chain name: Humanity Ledger Corp.</span>
        </h2>
        <p className={p.lead}>
          HLC is the token of the Humanity Ledger protocol. The plan has no investors and no private round: almost half
          goes to the people who use Ledger Chat, and every protocol fee will be spent buying HLC back and burning it.
        </p>
        <p className={p.notice}>
          HLC is not on sale and nothing is being distributed. It launches only when the five conditions below are met,
          including an external audit and a legal opinion. The figures on this page are the plan, read from the same file
          the protocol dashboard uses.
        </p>
      </div>

      <div className={p.ledgerWrap}>
        <SupplyLedger />
        <ul className={p.legend}>
          {ALLOCATIONS.map((a) => (
            <li key={a.id} className={p.legendItem}>
              <span className={p.swatch} style={{ ["--c" as string]: COLOR[a.id] } as React.CSSProperties} aria-hidden="true" />
              <div>
                <p className={p.legendName}>{a.label}</p>
                <p className={p.legendTerms}>{a.terms}</p>
              </div>
              <p className={p.legendShare}>
                {pct(a.bps)}
                <span className={p.legendAmount}>{whole(a.amount)}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>

      <h3 className={p.subhead}>Where the value goes</h3>
      <p className={p.subLead}>
        {FEE_ROUTING.buybackAndBurnBps === 10_000n ? "Every protocol fee" : `${pct(FEE_ROUTING.buybackAndBurnBps)} of protocol fees`} goes
        to buying HLC back and burning it; nothing is paid out to holders. There are no fees yet: the escrow contract that will
        charge them is not deployed.
      </p>
      <ol className={p.flow}>
        <li className={p.flowStep}>
          <p className={p.flowTitle}>A fee on each agreement</p>
          <p className={p.flowText}>
            Taken inside the private deposit as a private note, so it reveals no amount. Rounded up, with a minimum, so
            splitting a payment never pays less.
          </p>
        </li>
        <li className={p.flowStep}>
          <p className={p.flowTitle}>Bought on the open market</p>
          <p className={p.flowText}>
            The treasury publishes the weekly total and a public contract buys HLC with it over seven days.
          </p>
        </li>
        <li className={p.flowStep}>
          <p className={p.flowTitle}>Burned</p>
          <p className={p.flowText}>The purchased HLC is destroyed, and the supply only goes down.</p>
        </li>
      </ol>

      <h3 className={p.subhead}>Staking lowers fees. It pays nothing.</h3>
      <p className={p.subLead}>
        Locking HLC gives a weight that lowers your fees on agreements and sponsors network fees for new members of your
        community. Longer locks weigh more.
      </p>
      <div className={p.locks}>
        {STAKING_LOCKS.map((l) => (
          <div key={l.id} className={p.lock}>
            <p className={p.lockWeight}>{`${l.weightBps / 10_000n}.${(l.weightBps % 10_000n) / 1_000n}×`}</p>
            <p className={p.lockName}>{l.label}</p>
          </div>
        ))}
      </div>

      <h3 className={p.subhead}>Team tokens wait eighteen months</h3>
      <p className={p.subLead}>
        Nothing vests before month {TEAM_VESTING.cliffMonths}; then the team allocation vests month by month until month{" "}
        {TEAM_VESTING.totalMonths}. Tokens not yet vested can be cancelled back to the treasury.
      </p>
      <VestingChart />

      <h3 className={p.subhead}>Five conditions before launch</h3>
      <ul className={p.conditions}>
        {LAUNCH_CONDITIONS.map((c) => (
          <li key={c.id} className={p.condition}>
            <div>
              <p className={p.conditionLabel}>{c.label}</p>
              <p className={p.conditionEvidence}>{c.evidence}</p>
            </div>
            <span className={c.met ? p.met : p.unmet}>{c.met ? "Met" : "Not yet"}</span>
          </li>
        ))}
      </ul>

      <LiveFigures />
    </div>
  );
}
