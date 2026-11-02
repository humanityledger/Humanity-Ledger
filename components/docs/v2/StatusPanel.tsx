"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CircleAlert, CircleCheck, CircleDashed, CircleX, LoaderCircle, RefreshCw } from "lucide-react";
import s from "./Docs.module.css";

/**
 * A live check of our own services, run from the reader's browser.
 *
 * It reports only what it measured. There is no stored history and no
 * hand written "operational" label: if the request fails, the page says so.
 */

type State = "checking" | "ok" | "degraded" | "down" | "unmonitored";

interface Health {
  status?: string;
  services?: {
    database?: { status?: string; latencyMs?: number };
    cache?: { status?: string };
  };
}

interface Result {
  at: Date;
  roundTripMs: number;
  reachable: boolean;
  health: Health | null;
}

function stateOf(ok: boolean | undefined): State {
  if (ok === undefined) return "down";
  return ok ? "ok" : "degraded";
}

const STATE_TEXT: Record<State, string> = {
  checking: "Checking",
  ok: "Working",
  degraded: "Degraded",
  down: "Unreachable",
  unmonitored: "Not monitored here",
};

function StateMark({ state }: { state: State }) {
  const map = {
    checking: { Icon: LoaderCircle, cls: s.stateIdle, spin: true },
    ok: { Icon: CircleCheck, cls: s.stateOk, spin: false },
    degraded: { Icon: CircleAlert, cls: s.stateWarn, spin: false },
    down: { Icon: CircleX, cls: s.stateDown, spin: false },
    unmonitored: { Icon: CircleDashed, cls: s.stateIdle, spin: false },
  }[state];
  const { Icon, cls, spin } = map;
  return (
    <span className={`${s.componentState} ${cls}`}>
      <Icon size={16} strokeWidth={2} className={spin ? s.spin : undefined} aria-hidden="true" />
      {STATE_TEXT[state]}
    </span>
  );
}

function time(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function StatusPanel() {
  const [result, setResult] = useState<Result | null>(null);
  const [checking, setChecking] = useState(true);

  const check = useCallback(async () => {
    setChecking(true);
    const started = performance.now();
    let reachable = false;
    let health: Health | null = null;
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 8000);
      const res = await fetch("/api/health", { cache: "no-store", signal: controller.signal });
      window.clearTimeout(timer);
      reachable = true;
      health = (await res.json().catch(() => null)) as Health | null;
    } catch {
      reachable = false;
    }
    setResult({ at: new Date(), roundTripMs: Math.round(performance.now() - started), reachable, health });
    setChecking(false);
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const db = result?.health?.services?.database;
  const cache = result?.health?.services?.cache;

  const rows: { name: string; hint: string; state: State }[] = [
    {
      name: "Website and API",
      hint: result?.reachable ? `Answered in ${result.roundTripMs} ms` : "The pages and the API behind Ledger Chat",
      state: checking ? "checking" : result?.reachable ? "ok" : "down",
    },
    {
      name: "Accounts and sign in",
      hint: db?.latencyMs !== undefined ? `Database answered in ${db.latencyMs} ms` : "Our database",
      state: checking ? "checking" : !result?.reachable ? "down" : stateOf(db?.status ? db.status === "OK" : undefined),
    },
    {
      name: "Realtime features and rate limits",
      hint: "Our cache, used for online status and delivery queues",
      state: checking ? "checking" : !result?.reachable ? "down" : stateOf(cache?.status ? cache.status === "OK" : undefined),
    },
    { name: "XMTP network", hint: "Delivery of direct messages. Run by XMTP.", state: "unmonitored" },
    { name: "Blockchains", hint: "Payments on Ethereum, its layer 2 networks and Aztec.", state: "unmonitored" },
  ];

  const measured = rows.slice(0, 3).map((r) => r.state);
  const overall: State = checking
    ? "checking"
    : measured.includes("down")
      ? "down"
      : measured.includes("degraded")
        ? "degraded"
        : "ok";

  const banner = {
    checking: { cls: s.statusBannerIdle, Icon: LoaderCircle, title: "Checking our services" },
    ok: { cls: s.statusBannerOk, Icon: CircleCheck, title: "Our services are working" },
    degraded: { cls: s.statusBannerWarn, Icon: CircleAlert, title: "Some services are degraded" },
    down: { cls: s.statusBannerDown, Icon: CircleX, title: "We could not reach our servers" },
    unmonitored: { cls: s.statusBannerIdle, Icon: CircleDashed, title: "" },
  }[overall];

  return (
    <div>
      <div className={`${s.statusBanner} ${banner.cls}`} role="status" aria-live="polite">
        <banner.Icon size={22} strokeWidth={2} className={overall === "checking" ? s.spin : undefined} aria-hidden="true" />
        <div className={s.statusBannerBody}>
          <p className={s.statusBannerTitle}>{banner.title}</p>
          <p className={s.statusBannerMeta}>
            {result ? `Checked at ${time(result.at)} from your browser` : "Running the check from your browser"}
          </p>
        </div>
        <button type="button" className={s.recheck} onClick={check} disabled={checking}>
          <RefreshCw size={14} strokeWidth={2} className={checking ? s.spin : undefined} aria-hidden="true" />
          Check again
        </button>
      </div>

      <div className={s.components}>
        {rows.map((r) => (
          <div key={r.name} className={s.component}>
            <div>
              <span className={s.componentName}>{r.name}</span>
              <span className={s.componentHint}>{r.hint}</span>
            </div>
            <StateMark state={r.state} />
          </div>
        ))}
      </div>
    </div>
  );
}
