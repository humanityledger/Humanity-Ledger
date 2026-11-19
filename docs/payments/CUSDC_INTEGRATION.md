# cUSDC: the planned asset for real payments

**Status (19 November 2026): planned, off.** Decision PA-1 (`docs/alpha/OPERATOR_DECISIONS.md`). HLC stays the only
asset in the closed alpha, as a test token with no monetary value. Nothing in this document is switched on.

## What cUSDC is

- **Clean USDC**, issued on Aztec by human.tech through its Shield bridge. Humanity Ledger issues nothing and holds nothing.
- Each cUSDC is backed 1:1 by USDC held in Shield's Token Portal contract on Ethereum. Withdrawing burns the cUSDC on Aztec and the portal releases the USDC on L1.
- A standard Aztec token. Its only minter is a minter proxy with compliance checks. Ledger Chat's wallet handles it like HLC: same Token interface, private notes.
- To bridge in private mode, the user passes identity, sanctions and PEP screening at the bridge (Proof of Clean Hands or Human Passport). Today the "clean" designation does not travel with the token.
- Fees: 0.5% on deposits and withdrawals, taken by the portal, plus L1 gas.
- Shield does not work in mobile browsers yet. Users bridge on desktop at shield.human.tech and then pay from any device in Ledger Chat.
- According to Shield's documentation, Nethermind Security reviewed its bridge contracts independently. It also warns that Aztec is an alpha network and that users should bridge only what they can afford to lose. Ledger Chat repeats that warning; it makes no claim of its own about Shield's security.
- Wording: say "Ledger Chat supports cUSDC". Never "partner", "official", "backed by" or "endorsed" (master prompt).

Sources: [Shield docs](https://docs.human.tech/shield) · [Clean SDK](https://docs.human.tech/clean-sdk) · [Fees and tokens](https://support.shield.human.tech/fees-and-tokens) · [Contracts](https://support.shield.human.tech/contracts).

## Addresses (copied 19/11/2026 from Shield's contracts page, not yet confirmed on the node)

| Network | Contract | Address |
| --- | --- | --- |
| Aztec mainnet v6.0.0 | Clean USDC (cUSDC) | `0x30112e52178143b74cf6037d047bbba924f4b0db8aab587a340aacfc6ecb4f38` |
| Aztec mainnet v6.0.0 | Shield Token Bridge (cUSDC) | `0x023aafff7595c5698625486a010e385144a4a960d268df8ccb205f9134afd775` |
| Aztec mainnet v6.0.0 | Token Minter Proxy (cUSDC) | `0x05fcce110ae9d190e0808596af79ffb21031a3eaf854cf5c74bac3437e86a5fd` |
| Aztec mainnet v6.0.0 | Bridged FPC | `0x0b51d3763feeb55654cf5145d9a4562aba31384d10289e9f19fd68dcd2f59502` |
| Ethereum mainnet | Shield Token Portal (USDC) | `0x6c34d66633ffc36be2dfddc7b0c652fbb305e74c` |
| Ethereum mainnet | USDC | `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48` |

Only the cUSDC address is recorded in `deployments/aztec-mainnet.json` (`plannedTokens`). Shield's page warns that
look-alike contracts exist and asks users to compare the full address; the preflight below does that on the node.
Shield's v5 addresses are for withdrawals only and are never used.

## Switching it on: the steps, in order

Each step is a pull request on a `claude/` branch. Stefan merges it. No agent signs or broadcasts.

1. **Gate `legal`:** a written note from counsel. It covers that Ledger Chat is non-custodial software and is not a crypto-asset service provider for cUSDC payments, plus the terms for real payments. Agents do not write legal texts (OD-8).
2. **Gate `entity`:** the S.L. exists. Its terms of use and privacy policy are published.
3. **Gate `onchain`:** extend the read-only preflight (`test/live/aztec-mainnet-preflight.live.test.ts`) to read the cUSDC instance from the v6 node. It records the class ID and the deployment, and the token's name, symbol and decimals from public storage. If all of that matches, `verifiedOnChain` becomes true with the run number.
4. **Wallet slot:** add a `CUSDC` slot to `TokenKey` and `TOKEN_ORDER` (`lib/aztec/wallet/config.ts`) and to `SLOTS` (`scripts/aztec/check-alpha-config.mjs`). Move cUSDC from `plannedTokens` to `tokens`. The test `never names an operator token like a real asset` keeps refusing operator tokens named USDC; give it an `issuer` exception for third-party tokens.
5. **Caps:** a cap per payment in cUSDC in `NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS`, signed by Stefan (gate `operator`).
6. **Fees:** optional. Use Shield's Bridged FPC so users can pay fees without bridging AZTEC. This is a separate decision, because Ledger Chat sponsors no fee today.
7. **Words:** the wallet labels cUSDC "Issued by human.tech" and links to Shield to bridge in and out. The landing FAQ answer changes from "planned" to "available" only in this PR.
8. **Gate `alpha`:** the HLC alpha has finished within the targets in `docs/alpha/TESTER_MISSIONS.md`.

## Gate 3 of the preliminary legal note (added 19/11/2026)

Four more gates in `CUSDC_GATES`, all unmet:

- `issuerWrittenClassification`: human.tech answers in writing how cUSDC qualifies under MiCA, which entity issues it, and who guarantees redemption 1:1.
- `legalNoteNotCasp`: counsel confirms that the integration does not make the company a crypto-asset service provider or a payment service provider.
- `sanctionsPolicy`: a written policy on users from sanctioned countries, and how it is applied.
- `insurance`: professional liability and cyber insurance in force.

While any gate is unmet, the wallet drops cUSDC from its token list even if it is configured (`withoutGatedTokens` in `lib/payments/assets.ts`, applied in `lib/aztec/wallet/config.ts`). The read-only preflight reports the cUSDC instance, its class, name and decimals as evidence. `verifiedOnChain` changes only in a PR.

## What stays true after the switch

- HLC remains a test token. It is either kept as a "test mode" or removed from the wallet. It is never converted into anything.
- Ledger Chat never holds a user's key or funds. Every payment is signed in the user's own wallet.
- `audit` stays `null` in the manifest until an external audit of Humanity Ledger's own contracts exists.

## Wallet slot (package 9, 19/11/2026)

- `CUSDC` is a wallet slot in `lib/aztec/wallet/config.ts`. It is built only on Alpha, from `NEXT_PUBLIC_AZTEC_TOKENS.CUSDC`, and always passes through `withoutGatedTokens`. While any gate in `CUSDC_GATES` is unmet, it stays empty, even if the variable is set.
- Test-network readiness counts only the faucet slots (`TESTNET_TOKEN_KEYS`: USDC, DAI, ETH). Adding the slot did not change it.
- `test/unit/aztec/deployments-registry.test.ts` exempts a third-party token from the reserved-symbol rule only when it matches a `plannedTokens` entry by symbol and address, with role `real` and an issuer. Operator tokens may no longer contain a real asset's symbol either.
- **Still to do, each behind its gate:**
  - the preflight confirming the address on the node (`onchain`);
  - a token record in `tokens` with its class;
  - Stefan's PR turning each gate's `met` to true, with evidence.

