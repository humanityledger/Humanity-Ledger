/**
 * Live check of the sequencer integration against the real Aztec network.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/aztec-sequencer-check.ts [mainnet|testnet] [attester,...]
 *
 * Reads only. Uses the same env vars as the dashboard (AZTEC_NODE_URL,
 * AZTEC_L1_RPC_URL, AZTEC_ATTESTER_ADDRESSES, ...). Exit code 1 when any
 * critical alert is open, so it can gate a deploy or a cron.
 */
import { buildOverview, loadSequencerConfig } from '../lib/aztec/sequencer/client';

async function main() {
  const [netArg, attArg] = process.argv.slice(2);
  const env = { ...process.env };
  if (netArg) env.AZTEC_NETWORK = netArg;
  if (attArg) env.AZTEC_ATTESTER_ADDRESSES = attArg;
  const cfg = loadSequencerConfig(env);
  const o = await buildOverview(cfg);

  const line = (k: string, v: unknown) => console.log(`${k.padEnd(28)} ${v}`);
  console.log(`\n${o.network.label}  (expects node ${o.network.expectedNodeVersion}, rollup version ${o.network.rollupVersion})\n`);
  line('reference node', o.reference.url);
  line('node version', o.reference.info.ok ? o.reference.info.value.nodeVersion : `ERR ${o.reference.info.error}`);
  if (o.reference.tips.ok) {
    const t = o.reference.tips.value;
    line('proposed block', t.proposed.number);
    line('checkpointed', `block ${t.checkpointed.block.number} / checkpoint ${t.checkpointed.checkpoint.number}`);
    line('proven', `block ${t.proven.block.number} / checkpoint ${t.proven.checkpoint.number}`);
  } else line('chain tips', `ERR ${o.reference.tips.error}`);
  line('pending txs', o.reference.pendingTxCount.ok ? o.reference.pendingTxCount.value : `ERR ${o.reference.pendingTxCount.error}`);
  line('recent blocks', o.reference.recentBlocks.ok ? o.reference.recentBlocks.value.map(b => b.number).join(', ') : `ERR ${o.reference.recentBlocks.error}`);
  line('drift', o.reference.drift.length ? JSON.stringify(o.reference.drift) : 'none');
  if (o.rollup.ok) {
    const r = o.rollup.value;
    line('canonical rollup', `${r.canonicalRollup} (${r.isCanonical ? 'matches' : 'DIFFERENT'})`);
    line('epoch / slot', `${r.currentEpoch} / ${r.currentSlot}  (${r.slotDurationSeconds}s slots, ${r.epochDurationSlots} per epoch)`);
    line('active attesters', r.activeAttesterCount);
    line('entry queue', r.entryQueueLength);
    line('committee', `${r.committee.length} of target ${r.targetCommitteeSize}`);
    line('stake to activate', `${BigInt(r.activationThreshold) / 10n ** BigInt(r.stakingAsset.decimals)} ${r.stakingAsset.symbol}`);
    line('ejection below', `${BigInt(r.ejectionThreshold) / 10n ** BigInt(r.stakingAsset.decimals)} ${r.stakingAsset.symbol}`);
    line('exit delay', `${r.exitDelaySeconds / 3600} h`);
    line('checkpoints', `pending ${r.pendingCheckpoint}, proven ${r.provenCheckpoint}`);
  } else line('rollup', `ERR ${o.rollup.error}`);
  line('own node', `${o.ownNode.mode}${o.ownNode.lagBlocks !== null ? `, ${o.ownNode.lagBlocks} behind` : ''}`);
  if (o.attesters.ok) for (const a of o.attesters.value) {
    const s = a.stats.ok ? a.stats.value.validator : null;
    line(`attester ${a.address.slice(0, 10)}…`, `${a.status}, balance ${a.effectiveBalance}, committee ${a.inCurrentCommittee}${s ? `, last attestation slot ${s.lastAttestation?.slot ?? '-'}, missed att ${s.missedAttestations.count}/${s.missedAttestations.total}` : `, stats ERR ${a.stats.ok ? '' : a.stats.error}`}`);
  }
  if (o.publishers.ok) for (const p of o.publishers.value) line(`publisher ${p.address.slice(0, 10)}…`, `${p.balanceEth} ETH${p.low ? '  LOW' : ''}`);
  console.log('\nalerts:');
  for (const a of o.alerts) console.log(`  [${a.level}] ${a.code}: ${a.message}`);
  process.exit(o.alerts.some(a => a.level === 'critical') ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
