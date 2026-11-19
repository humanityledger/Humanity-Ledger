# Runbook: HLC Test Token with a neutral name

Estado: listo para usar tras fusionar los paquetes 1 y 2 · Fecha: 19/11/2026 · Dueño: Stefan Antonio Cirisanu · Fuente de verdad: `HLC_TOKEN_META` en `lib/payments/assets.ts` y `deployments/aztec-mainnet.json`

**Why.** The HLC instance on Alpha (`0x1f49571a…24e5`, L2 block 28992, 14/11/2026) is named "Humanity Ledger Corp.". That suggests a company that does not exist (preliminary legal note, A.4). The standard Token sets name, symbol and decimals in its constructor, so the fix is a new instance, not an update. The precedent is in `retiredTokens` (the instance of 11/11/2026, retired on 14/11/2026).

**Who does what.** Steps marked **Stefan** are done by Stefan in his own wallet. The agent never signs, sends or broadcasts a transaction on Alpha or Ethereum. It only reads the network through the preflight.

## Before starting

- [ ] Packages 1 and 2 are merged and deployed to production (`npm run ship`, then Railway).
- [ ] The read-only preflight ("Aztec mainnet preflight" workflow) is green on the current state. With package 1 it also checks that the current instance's on-chain name equals the recorded name.
- [ ] Stefan's Aztec account, which will be the admin, has Fee Juice for one deploy transaction.

## Steps

1. **Stefan.** Open `https://ledgerchat.org/chat#hlc-deploy` and go to Wallet. Use the operator card "Deploy HLC Test Token (operator)". It deploys with `HLC_TOKEN_META`: name "HLC Test Token", symbol HLC, 6 decimals, admin = this account. The deploy is universal, as on 14/11/2026. Approve in your wallet. The card issues nothing.
2. **Stefan.** When the card shows the new address and the deploy hash, send both to the agent. Do not issue HLC yet.
3. **Agent.** Run the "Aztec mainnet preflight" workflow with the new address and hash added to the record in a branch. It reads the network only. Note five values from its summary:
    - the block;
    - the class, which must be the standard Token class already recorded (`0x067df4dd…91e0`);
    - the deployer, which must be zero (universal deploy);
    - the on-chain name, which must be "HLC Test Token";
    - the decimals, which must be 6.

   If any value differs, stop and report. Do not retry with other parameters.
4. **Agent.** Open a PR that does three things:
    - move `0x1f49571a…24e5` to `retiredTokens`, with `retired`: "renombrado: el nombre del contrato sugería una sociedad inexistente (nota jurídica del 19/11/2026, A.4)" and the date;
    - record the new instance in `tokens`, with its hash, block, class, the preflight run id and no `renamePending`;
    - update `NEXT_PUBLIC_AZTEC_TOKENS` in the docs and in `.env.example`. `scripts/aztec/check-alpha-config.mjs` must pass.
5. **Stefan.** Merge the PR, change `NEXT_PUBLIC_AZTEC_TOKENS` in Railway, and deploy.
6. **Stefan.** In the explorer, check that the new address shows the name "HLC Test Token".
7. The old instance never issues again. Any test balance Stefan holds in it stays there. It is not migrated or burned, and the wallet no longer lists it.
8. HLC goes to testers only after `closedAlpha.distributor` is filled in (package 3) and each tester has passed admission (package 4).

## If something fails

Do not retry with other parameters. Stop, write what happened in `docs/alpha/INCIDENT.md`, and the agent proposes the fix in a PR.

## Testnet rehearsal

Before step 1, the same deploy and read run end to end on the Aztec test network from CI. The hash and block are recorded in `deployments/aztec-testnet.json`. **Pending:** no CI job yet deploys a Token on the testnet with test keys and reads its name back. Owner: agent, in a follow-up PR. Until it exists, this rehearsal is not done and is not claimed.
