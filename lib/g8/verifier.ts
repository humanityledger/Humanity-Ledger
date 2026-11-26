/**
 * G8 proof verification (spec §6). Fail-closed: until the compiled circuit
 * (circuits/g8_admission/target/g8_admission.json) and its verification key
 * are pinned in G8_CIRCUIT, every proof is rejected with 'circuit-not-pinned'
 * — Level 2 is shown as "coming", never faked. Context, root, scope and
 * freshness checks are pure and run first, so they are tested today.
 */
import { MAX_CLOCK_SKEW_SECONDS } from '@/lib/g8/constants';
import { contextBinding, type ContextInput } from '@/lib/g8/hash';

/** Filled by the release that pins the compiled circuit (sha256 of the artifact + VK). */
export const G8_CIRCUIT: { artifactSha256: string; vkHex: string } | null = null;

export interface AdmissionProof {
  proofHex: string;
  publicInputs: { root: string; sanctionRoot: string; scope: string; tag: string; context: string; tMin: number; tierMask: number };
  context: ContextInput;
}
export interface VerifierState { roots: string[]; sanctionRoot: string; myScope: string; now: number }

export type VerifyResult = { ok: true; tag: string } | { ok: false; reason: 'circuit-not-pinned' | 'root' | 'sanctions' | 'scope' | 'stale' | 'context' | 'proof' };

export async function checkPublicInputs(p: AdmissionProof, st: VerifierState): Promise<VerifyResult> {
  const pi = p.publicInputs;
  if (!st.roots.map(r => r.toLowerCase()).includes(pi.root.toLowerCase())) return { ok: false, reason: 'root' };
  if (pi.sanctionRoot.toLowerCase() !== st.sanctionRoot.toLowerCase()) return { ok: false, reason: 'sanctions' };
  if (pi.scope.toLowerCase() !== st.myScope.toLowerCase()) return { ok: false, reason: 'scope' };
  if (Math.abs(p.context.tNow - Math.floor(st.now / 1000)) > MAX_CLOCK_SKEW_SECONDS) return { ok: false, reason: 'stale' };
  const c = await contextBinding(p.context);
  if (BigInt(pi.context) !== c) return { ok: false, reason: 'context' };
  return { ok: true, tag: pi.tag };
}

export async function verifyAdmissionProof(p: AdmissionProof, st: VerifierState): Promise<VerifyResult> {
  const pre = await checkPublicInputs(p, st);
  if (!pre.ok) return pre;
  if (!G8_CIRCUIT) return { ok: false, reason: 'circuit-not-pinned' };
  try {
    const { UltraHonkVerifierBackend } = await import('@aztec-foundation/bb.js') as unknown as { UltraHonkVerifierBackend: new (vk: Uint8Array) => { verifyProof(x: { proof: Uint8Array; publicInputs: string[] }): Promise<boolean> } };
    const hex = (h: string) => Uint8Array.from((h.replace(/^0x/, '').match(/../g) ?? []).map(b => parseInt(b, 16)));
    const v = new UltraHonkVerifierBackend(hex(G8_CIRCUIT.vkHex));
    const pi = p.publicInputs;
    const ok = await v.verifyProof({ proof: hex(p.proofHex), publicInputs: [pi.root, pi.sanctionRoot, pi.scope, pi.tag, pi.context, '0x' + pi.tMin.toString(16), '0x' + pi.tierMask.toString(16)] });
    return ok ? { ok: true, tag: pi.tag } : { ok: false, reason: 'proof' };
  } catch {
    return { ok: false, reason: 'proof' };
  }
}
