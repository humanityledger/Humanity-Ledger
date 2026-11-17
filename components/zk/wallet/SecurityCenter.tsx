'use client';

/**
 * components/zk/wallet/SecurityCenter.tsx — the Security view of the private wallet.
 *
 * One list of facts about this account and this build, each with its real state. Nothing here is
 * a promise: a row is green only when the property holds right now in this browser (keys made
 * here, a second way in enrolled, address checks bound to this network, new value allowed by the
 * operator switch). What does not hold yet (no external audit, the fee payer is public) is said as
 * plainly, in the same list.
 */
import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import { networkLabel } from '@/lib/aztec/wallet/config';
import { currentValueMode, type ValueMode } from '@/lib/aztec/value-mode';
import { Card, CardHead, INK, INK_2, INK_3, OK } from './WalletUI';
import { usePasskeyRecords } from './PasskeyCard';

type Tone = 'ok' | 'warn' | 'neutral';

function Row({ tone, title, value, detail }: { tone: Tone; title: string; value: string; detail: string }) {
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'warn' ? AlertTriangle : Circle;
  const color = tone === 'ok' ? OK : tone === 'warn' ? '#b54708' : '#98a2b3';
  return (
    <li className="flex gap-3 py-3.5 border-t border-[#eef0f3] first:border-t-0">
      <Icon size={19} strokeWidth={2} className="shrink-0 mt-[1px]" style={{ color }} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-semibold" style={{ color: INK }}>{title}</span>
          <span className="text-[13px] font-semibold text-right shrink-0" style={{ color: tone === 'warn' ? '#b54708' : INK_2 }}>
            <span className="sr-only">{tone === 'ok' ? 'In place: ' : tone === 'warn' ? 'Attention: ' : ''}</span>
            {value}
          </span>
        </div>
        <p className="mt-0.5 text-[13px] leading-snug" style={{ color: INK_3 }}>{detail}</p>
      </div>
    </li>
  );
}

export function SecurityCenter({ address, alpha, linkedComputer }: { address: string; alpha: boolean; linkedComputer?: boolean }) {
  const { records } = usePasskeyRecords(address);
  const [mode, setMode] = useState<{ mode: ValueMode; unconfirmed?: boolean } | null>(null);
  useEffect(() => {
    let live = true;
    currentValueMode().then((m) => live && setMode(m), () => live && setMode({ mode: 'exits-only', unconfirmed: true }));
    return () => {
      live = false;
    };
  }, []);
  const passkeys = records?.length ?? 0;

  return (
    <Card label="Security">
      <CardHead title="Security" sub="What protects this account right now, and what does not yet." />
      <ul className="px-5 pb-3" aria-label="Security of this account">
        <Row
          tone="ok"
          title="Keys"
          value="Made on this device"
          detail="Derived from your wallet signature in this browser. They never reach our server, and proofs are made here."
        />
        <Row
          tone={passkeys > 0 ? 'ok' : 'neutral'}
          title="Ways to open"
          value={records === null ? '…' : passkeys > 0 ? `Wallet + ${passkeys} passkey${passkeys === 1 ? '' : 's'}` : 'Ethereum wallet only'}
          detail={passkeys > 0 ? 'Any of them opens the same account. Remove a passkey you no longer control.' : 'Add a passkey below so losing your Ethereum wallet does not lose the account.'}
        />
        {linkedComputer && (
          <Row tone="ok" title="Signing" value="Approved on your phone" detail="This computer asks your phone for each signature; the phone shows what it signs." />
        )}
        <Row
          tone="ok"
          title="Address checks"
          value={`Bound to ${alpha ? 'Aztec Alpha' : networkLabel()}`}
          detail="A payment address verified in a chat is valid only on this network. A test-network proof cannot direct a real payment."
        />
        <Row
          tone={mode === null ? 'neutral' : mode.mode === 'open' ? 'ok' : 'warn'}
          title="New payments"
          value={mode === null ? '…' : mode.mode === 'open' ? 'Allowed' : mode.unconfirmed ? 'Not confirmed' : 'Paused'}
          detail={
            mode?.mode === 'exits-only'
              ? 'Nothing new can go in right now. Claims, refunds and withdrawals of your own money still work.'
              : 'Checked again immediately before every new payment. If the check fails, nothing is sent.'
          }
        />
        <Row
          tone="warn"
          title="Network fee"
          value="Paid publicly"
          detail="Your account pays each fee in Fee Juice, which the network can see. Private fee payment comes next."
        />
        <Row
          tone="warn"
          title="External audit"
          value="Not yet"
          detail="Ledger Chat's own contracts (agreements, escrow, portal) are open source and tested in CI on every change. No independent firm has audited them yet. Use amounts you can afford to lose."
        />
      </ul>
    </Card>
  );
}
