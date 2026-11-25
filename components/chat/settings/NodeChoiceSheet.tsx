'use client';

/**
 * components/chat/settings/NodeChoiceSheet.tsx — choose the Aztec node the private wallet talks to
 * (lib/aztec/wallet/node-choice.ts, alignment item R5).
 */

import React, { useState } from 'react';
import { toast } from 'sonner';
import { AZTEC_WALLET_CONFIG, networkLabel } from '@/lib/aztec/wallet/config';
import { chosenNodeUrl, nodeUrlProblem, setChosenNodeUrl } from '@/lib/aztec/wallet/node-choice';
import { useT } from '@/lib/i18n/client';

export function NodeChoiceSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [current, setCurrent] = useState<string | null>(() => chosenNodeUrl());
  const [value, setValue] = useState(current ?? '');
  const problem = value.trim() ? nodeUrlProblem(value) : null;

  const save = () => {
    try {
      const saved = setChosenNodeUrl(value);
      setCurrent(saved);
      toast.success(t("Saved. It is used the next time you open your private wallet."));
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Could not save."));
    }
  };
  const reset = () => {
    setChosenNodeUrl(null);
    setCurrent(null);
    setValue('');
    toast.success(t("Back to the public node."));
  };

  return (
    <div className="px-6 pb-6" data-testid="node-choice">
      <h3 className="text-[20px] font-semibold text-[#15171c] mb-1">{t("Aztec node")}</h3>
      <p className="text-[14px] text-[#5b606b] leading-relaxed mb-4">
        {t("The node your private wallet talks to sees your IP address and which notes your wallet looks for. It never sees your keys, amounts or recipients. If you run your own node, that stays with you.")}
      </p>
      <dl className="mb-4 rounded-xl border border-[#e4e7ec] px-4 py-2 text-[13.5px]">
        <div className="flex justify-between gap-3 py-1.5"><dt className="text-[#5b606b]">{t("Network")}</dt><dd className="m-0 font-medium text-[#15171c]">{t(networkLabel())}</dd></div>
        <div className="flex justify-between gap-3 py-1.5"><dt className="text-[#5b606b]">{t("In use")}</dt><dd className="m-0 truncate font-mono text-[12.5px] text-[#15171c]">{current ?? t(AZTEC_WALLET_CONFIG.nodeUrl)}</dd></div>
      </dl>
      <label htmlFor="node-url" className="block text-[12px] font-semibold uppercase tracking-[0.1em] text-[#5b606b] mb-1.5">{t("Your node URL")}</label>
      <input id="node-url" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder={t("https://")} value={value} onChange={(e) => setValue(e.target.value)} className="w-full h-12 rounded-xl border border-[#d0d5dd] px-4 font-mono text-[14px] text-[#15171c] outline-none focus:border-[#15171c]" />
      {problem && <p role="alert" className="mt-2 text-[13px] text-[#b42318]">{problem}</p>}
      <p className="mt-3 text-[12.5px] leading-relaxed text-[#5b606b]">{t("The wallet checks the node before using it: it must be on {networkLabel} and on the rollup this version of Ledger Chat supports, or the wallet refuses it. A node you choose is never replaced by our relay.", { networkLabel: t(networkLabel()) })}</p>
      <div className="mt-5 grid gap-2">
        <button type="button" disabled={!value.trim() || !!problem} onClick={save} className="w-full h-12 rounded-xl bg-[#15171c] text-white font-semibold text-[15px] disabled:opacity-50">{t("Use this node")}</button>
        {current && <button type="button" onClick={reset} className="w-full h-12 rounded-xl border border-[#d0d5dd] bg-white text-[#15171c] font-semibold text-[15px]">{t("Use the public node")}</button>}
        <button type="button" onClick={onClose} className="w-full h-11 text-[#5b606b] font-semibold text-[15px]">{t("Cancel")}</button>
      </div>
    </div>
  );
}
