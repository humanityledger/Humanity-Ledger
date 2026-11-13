#!/usr/bin/env node
/**
 * scripts/aztec/check-alpha-config.mjs
 *
 * Build-time check of the Aztec Alpha (mainnet) configuration, run in the
 * Dockerfile right before `next build`. NEXT_PUBLIC_* values are inlined into
 * the client at that moment, so this is the last point where a wrong token or
 * cap can be caught before it reaches users.
 *
 * Only acts when NEXT_PUBLIC_AZTEC_NETWORK=alpha. Checks, against
 * deployments/aztec-mainnet.json (the record the preflight verifies on the node):
 *   - NEXT_PUBLIC_AZTEC_TOKENS is a JSON object keyed by wallet slot (USDC, DAI,
 *     ETH), and every entry is a recorded token with the same address, symbol
 *     and decimals;
 *   - every key of NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS is the 32-byte address of a
 *     recorded and configured token, with a positive decimal cap;
 *   - L1 chain 1, Alpha enabled on purpose, an explorer set; a recorded token
 *     still pending the preflight (deployBlock 0) is reported.
 *
 * Mode (AZTEC_ALPHA_CONFIG_CHECK): "strict" exits 1 on any error, so a wrong
 * build never replaces the running one; the Dockerfile sets it by default since
 * the preflight confirmed HLC (11 November 2026). "warn" (the default when the
 * script is run by hand) prints the same problems and exits 0. Nothing here is
 * secret: every value checked is public (NEXT_PUBLIC_*) and is printed as such.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SLOTS = ['USDC', 'DAI', 'ETH'];
const HEX32 = /^0x[0-9a-fA-F]{64}$/;

function parseJson(raw, label, errors) {
  if (raw === undefined || raw === '') return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    errors.push(`${label} is not valid JSON`);
    return undefined;
  }
}

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** Pure check: returns the problems, never throws on bad input. */
export function checkAlphaConfig(env, registry) {
  const errors = [];
  const warnings = [];
  if (env.NEXT_PUBLIC_AZTEC_NETWORK !== 'alpha') return { active: false, errors, warnings };

  if (env.NEXT_PUBLIC_AZTEC_ALPHA_ENABLED !== 'true') {
    warnings.push('NEXT_PUBLIC_AZTEC_NETWORK=alpha without NEXT_PUBLIC_AZTEC_ALPHA_ENABLED=true: the private wallet stays off');
  }
  if (env.NEXT_PUBLIC_AZTEC_L1_CHAIN_ID && env.NEXT_PUBLIC_AZTEC_L1_CHAIN_ID !== '1') {
    errors.push(`NEXT_PUBLIC_AZTEC_L1_CHAIN_ID is ${env.NEXT_PUBLIC_AZTEC_L1_CHAIN_ID}; Aztec Alpha settles on L1 chain 1`);
  }
  if (!env.NEXT_PUBLIC_AZTEC_EXPLORER) warnings.push('NEXT_PUBLIC_AZTEC_EXPLORER is not set: no transaction links on Alpha (https://aztecscan.xyz)');

  const recorded = Array.isArray(registry?.tokens) ? registry.tokens : [];
  const byAddress = new Map(recorded.map((t) => [String(t.address).toLowerCase(), t]));
  for (const t of recorded) {
    if (!t.deployBlock || t.status === 'pending-preflight') {
      warnings.push(`${t.symbol} (${t.address}) is recorded but not yet confirmed by the preflight (deployBlock ${t.deployBlock}, classId ${t.classId})`);
    }
  }

  // Tokens.
  const tokens = parseJson(env.NEXT_PUBLIC_AZTEC_TOKENS, 'NEXT_PUBLIC_AZTEC_TOKENS', errors);
  const configured = new Set();
  if (tokens !== undefined) {
    if (!isPlainObject(tokens)) {
      errors.push('NEXT_PUBLIC_AZTEC_TOKENS must be an object keyed by wallet slot (USDC, DAI, ETH), not an array');
    } else {
      for (const [slot, t] of Object.entries(tokens)) {
        if (!SLOTS.includes(slot)) { errors.push(`NEXT_PUBLIC_AZTEC_TOKENS: unknown slot "${slot}" (expected ${SLOTS.join(', ')})`); continue; }
        if (!isPlainObject(t) || !HEX32.test(String(t.address))) { errors.push(`NEXT_PUBLIC_AZTEC_TOKENS.${slot}: address must be 0x + 64 hex`); continue; }
        const addr = t.address.toLowerCase();
        const rec = byAddress.get(addr);
        if (!rec) { errors.push(`NEXT_PUBLIC_AZTEC_TOKENS.${slot} (${t.address}) is not recorded in deployments/aztec-mainnet.json`); continue; }
        if (rec.key !== slot) errors.push(`NEXT_PUBLIC_AZTEC_TOKENS.${slot}: recorded under slot ${rec.key}`);
        if (rec.symbol !== t.symbol) errors.push(`NEXT_PUBLIC_AZTEC_TOKENS.${slot}: symbol "${t.symbol}", recorded "${rec.symbol}"`);
        if (Number(rec.decimals) !== Number(t.decimals)) errors.push(`NEXT_PUBLIC_AZTEC_TOKENS.${slot}: decimals ${t.decimals}, recorded ${rec.decimals}`);
        configured.add(addr);
      }
    }
  }

  // Caps.
  const caps = parseJson(env.NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS, 'NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS', errors);
  if (caps !== undefined) {
    if (!isPlainObject(caps)) {
      errors.push('NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS must be an object keyed by token address');
    } else {
      for (const [addr, v] of Object.entries(caps)) {
        if (!HEX32.test(addr)) { errors.push(`NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS: key "${addr}" is not a 32-byte token address (0x + 64 hex)`); continue; }
        if (!byAddress.has(addr.toLowerCase())) errors.push(`NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS: ${addr} is not a recorded token`);
        else if (!configured.has(addr.toLowerCase())) warnings.push(`NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS: ${addr} is recorded but not in NEXT_PUBLIC_AZTEC_TOKENS`);
        if (typeof v !== 'string' || !/^[0-9]{1,39}$/.test(v) || BigInt(v) <= 0n) errors.push(`NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS[${addr}]: cap must be a positive decimal string in base units`);
      }
    }
  }

  return { active: true, errors, warnings };
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const mode = process.env.AZTEC_ALPHA_CONFIG_CHECK === 'strict' ? 'strict' : 'warn';
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(path.join(root, 'deployments/aztec-mainnet.json'), 'utf8'));
  } catch (e) {
    registry = undefined;
  }
  const { active, errors, warnings } = checkAlphaConfig(process.env, registry);
  if (!active) {
    console.log('[check-alpha-config] network is not Alpha: nothing to check');
    return;
  }
  if (!registry) errors.push('deployments/aztec-mainnet.json could not be read');
  for (const w of warnings) console.warn(`[check-alpha-config] warning: ${w}`);
  for (const e of errors) console.error(`[check-alpha-config] ${mode === 'strict' ? 'error' : 'warning (would fail in strict mode)'}: ${e}`);
  console.log(`[check-alpha-config] Alpha, mode ${mode}: ${errors.length} error(s), ${warnings.length} warning(s)`);
  if (mode === 'strict' && errors.length) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
