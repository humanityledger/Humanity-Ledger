# Private membership proof: decision (24 November 2026)

Alignment item R9, replacing "achievements". Decided by Claude on the operator's delegation.

## The idea

A member proves to a community that they belong to it, or hold a token, without revealing which
account they are: a Noir contract keeps a Merkle root of member commitments; the member proves
inclusion in a private function and emits a nullifier per community and epoch, so the same proof
cannot be used twice and two proofs cannot be linked across communities.

## Decision

**Not built in this cycle.** It is a new contract that would gate access, it needs its own test
suite on the test network and an external review before anyone relies on it, and nothing in Ledger
Chat needs anonymous entry today: communities on MLS (phase 4) already keep posts away from our
server, and membership itself is still known to the server by design. It is added to the scope of
the external audit as a candidate (`docs/audit/EXTERNAL_AUDIT_SCOPE.md`) and to the open-source
package as a planned module.

## When to revisit

When a community asks for anonymous entry, or when Aztec publishes a reviewed membership or
allowlist library that this contract could use instead of its own Merkle code.
