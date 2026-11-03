/**
 * lib/aztec/provenanceIndexer.ts
 *
 * Provenance events (forum posts, page visits) used to be written to the
 * `transaction` table as if they were Aztec transactions: a keccak hash of
 * the event text was stored as `txHash`, the chain id was labelled "Aztec
 * Mainnet" and `Date.now()` was stored as the block number. None of that was
 * on any chain, and the records read as real transactions.
 *
 * Until an event is actually anchored on a network (and carries the hash the
 * Aztec SDK returns for it), nothing is recorded and no hash is returned.
 * Callers already treat a `null` result as "not logged".
 *
 * Master prompt, task R-04 (docs/zk/MASTER_PROMPT.md).
 */

export type ProvenanceEventType =
  | 'IDENTITY_PROOF'
  | 'FORUM_POST'
  | 'LEDGER_CHAT_SYNC'
  | 'PORTFOLIO_ACCESS'
  | 'STUDIO_ACCESS';

export interface ProvenanceRecord {
  txHash: string;
}

export async function logProvenanceEvent(
  _type: ProvenanceEventType,
  _address: string,
  _details: Record<string, unknown>,
): Promise<ProvenanceRecord | null> {
  return null;
}
