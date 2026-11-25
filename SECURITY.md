# Security policy

Ledger Chat is early software running on Aztec Alpha, a network that carries real value and that Aztec itself describes as early, with critical bugs expected. Read [`docs/TRUST.md`](docs/TRUST.md) for the current state in one page.

| | |
|---|---|
| External audit | Began 25 November 2026. **No report yet.** Nothing in this repository is externally audited until the report is published in full from [`/docs/audits`](https://ledgerchat.org/docs/audits). `deployments/aztec-mainnet.json` keeps `"audit": null` until then. |
| Value at risk | Closed cUSDC beta only: invited members, per-payment cap, hard maximum of 100 cUSDC per payment on Alpha (`ALPHA_MAX_AMOUNT`), exits-only switch that stops new payments without a deploy. |
| Deployed contracts of ours on Alpha | The HLC test token (no monetary value). Escrow, streams, the Ethereum portal and any fee contract are **not deployed**. |
| Affiliation | Not affiliated with, endorsed by or audited by Aztec Labs, the Aztec Foundation, XMTP Labs or human.tech. |

## Report a vulnerability

* **Preferred:** a private advisory on GitHub (Security → Report a vulnerability).
* **Email:** `humanityledger@icloud.com`.
* Please do not open a public issue for a vulnerability.

| Step | Target |
|---|---|
| Acknowledgement | 12 hours |
| Triage | 24 hours |
| Fix, critical | 5 business days |
| Fix, high | 7 business days |
| Fix, medium or low | 30 business days |

During the closed beta there are no monetary bounties. Reporters are credited in the advisory if they wish. A paid programme will be announced here if one is funded.

## Scope

**In scope**

| Area | Path |
|---|---|
| aztec-nr contracts (escrow, streams, identity, portal token, test token) | [`contracts/aztec/`](contracts/aztec/) |
| Ethereum portal and receiver factory (Solidity, not deployed) | [`contracts/portal/`](contracts/portal/) |
| Browser wallet, PXE orchestration, fees, G7 peer binding, passkeys | [`lib/aztec/`](lib/aztec/) |
| Payments and closed-beta gates | [`lib/payments/`](lib/payments/), [`lib/beta/`](lib/beta/) |
| XMTP integration, local encrypted store, attachments | [`lib/xmtp/`](lib/xmtp/), [`lib/chat/`](lib/chat/) |
| Session, CSRF, header stripping, rate limits | [`middleware.ts`](middleware.ts), [`lib/auth/`](lib/auth/), [`lib/security/`](lib/security/) |
| Community apps sandbox | [`lib/community-apps/`](lib/community-apps/), [`lib/security/eaf-guard.ts`](lib/security/eaf-guard.ts) |

**Out of scope**

* [`archive/standalone-circuits/`](archive/standalone-circuits/): retired on 25 November 2026, never deployed, known soundness issues ZK-01 to ZK-07 already listed in its README.
* Modules under `lib/` that the app does not import (see [`docs/audit/START_HERE.md`](docs/audit/START_HERE.md)).
* Volumetric denial of service without a logic flaw, social engineering of maintainers, and bugs in upstream projects (Aztec, XMTP, human.tech). Report those upstream; tell us too if Ledger Chat users are exposed.

## Safe harbour

We will not pursue legal action against research that stays within this policy, does not access other people's data or funds, and gives us a reasonable window before publication.

## Properties the code enforces, and where they are tested

| Property | Where | Test |
|---|---|---|
| Wallet keys, nullifier secrets and viewing keys stay in the browser; no server route receives them | [`lib/aztec/wallet/`](lib/aztec/wallet/) | [`test/key_custody.test.ts`](test/key_custody.test.ts), [`test/pxe_boundary_security.test.ts`](test/pxe_boundary_security.test.ts) |
| Proofs are built by the PXE on the device; no simulated or mock proofs in the tested paths | [`lib/aztec/wallet/client.ts`](lib/aztec/wallet/client.ts) | [`test/aztec_e2e_no_simulation.test.ts`](test/aztec_e2e_no_simulation.test.ts) |
| The payee is the Aztec address verified in the conversation (G7), never typed or taken from a request | [`lib/aztec/peer-binding.ts`](lib/aztec/peer-binding.ts) | `test/unit/aztec/peer-binding*.test.ts` |
| Client-supplied identity headers are removed before the server sets its own | [`middleware.ts`](middleware.ts) (`x-wallet-address`) | [`test/unit/security/resolve-caller.test.ts`](test/unit/security/resolve-caller.test.ts) |
| Secret comparisons in constant time | [`lib/security/constant-time.ts`](lib/security/constant-time.ts) | [`test/sidechannel_timing.test.ts`](test/sidechannel_timing.test.ts) |
| Key buffers wiped after use | [`lib/security/zeroize.ts`](lib/security/zeroize.ts) | [`test/property_fuzz.test.ts`](test/property_fuzz.test.ts) |
| Community apps run in a sandboxed frame with `connect-src 'none'`, a frozen bridge and an 8 KB message limit | [`lib/security/eaf-guard.ts`](lib/security/eaf-guard.ts) | [`test/eaf_isolation.adversarial.test.ts`](test/eaf_isolation.adversarial.test.ts) |
| No claim the code does not support reaches the README, docs or UI | [`scripts/check-forbidden-copy.mjs`](scripts/check-forbidden-copy.mjs) | CI |

## Known limits

| Limit | Detail |
|---|---|
| Metadata | XMTP protects message content, not who talks to whom or when. On Alpha the account that pays a fee is public, so one account's transactions can be linked to each other ([`docs/PRIVATE_FEES.md`](docs/PRIVATE_FEES.md) describes the optional route through a shared PrivateFPC, off by default). |
| IP address in calls | Calls connect peer to peer unless "Hide my IP address" is on, which forces TURN relay (`iceTransportPolicy: 'relay'`). |
| Passkeys | Whoever holds an enrolled passkey can spend, like whoever holds the wallet ([`docs/ACCOUNT_MODEL.md`](docs/ACCOUNT_MODEL.md)). |
| Two-person runs | Every private payment recorded on Alpha went between accounts operated by the operator. A run between two different people is still open (R8). |
| Quantum resistance | None. BN254, Grumpkin, secp256k1 and X25519 are not quantum resistant. |
| Formal verification | None of our contracts are formally verified. |

## Further reading

[`docs/TRUST.md`](docs/TRUST.md) · [`docs/audit/START_HERE.md`](docs/audit/START_HERE.md) · [`docs/security/THREAT_MODEL.md`](docs/security/THREAT_MODEL.md) · [`docs/AZTEC.md`](docs/AZTEC.md) · [`SECURITY-CHANGELOG.md`](SECURITY-CHANGELOG.md)

The previous version of this file (specification HL-SEC-2026.5) described the standalone Noir circuits, their verification-key registry and a 14-day timelock. Those circuits were retired on 25 November 2026 and the registry was never deployed, so those sections no longer describe the product. They remain in git history.
