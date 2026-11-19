/**
 * Package 7 (R2-1): before an agreement is opened on Aztec Alpha, the server decides with
 * closedAlphaDecision (GET /api/alpha/gate). Fail-closed: no answer, a non-200 or a malformed
 * answer refuses. The test network is not gated. Exits never call this.
 */
export async function assertClosedAlphaAllows(network: string, classId: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  if (network !== 'mainnet') return;
  let body: { ok?: unknown; reasons?: unknown } | null = null;
  try {
    const res = await fetchImpl(`/api/alpha/gate?classId=${encodeURIComponent(classId)}`, { credentials: 'include', cache: 'no-store' });
    body = await res.json().catch(() => null);
    if (res.ok && body?.ok === true) return;
  } catch {
    body = null;
  }
  const reasons = Array.isArray(body?.reasons) ? (body!.reasons as unknown[]).filter((r): r is string => typeof r === 'string') : [];
  throw new Error(`${reasons[0] ?? 'The closed alpha could not confirm this agreement.'} Nothing was sent.`);
}
