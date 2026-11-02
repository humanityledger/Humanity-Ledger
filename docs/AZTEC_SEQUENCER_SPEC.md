# Running an Aztec sequencer with Humanity Ledger (v6.0.0)

Status: checked against the live networks on 27 October 2026, the day after
v6 became the canonical rollup (26 Oct 2026, 08:00 UTC).

This replaces an earlier draft of this file. That draft described things
Aztec does not have (an `EpochCommittee.sol` contract, a 100 ETH stake,
"Fernet"/"BBA" consensus, `node_getTreeRoots`-style RPC methods, the
`aztecprotocol/aztec:0.55` image) and its dashboard showed generated numbers
when the node was unreachable. Everything below was verified against
docs.aztec.network, the public Aztec nodes and the L1 contracts.

## 1. What a sequencer is on Aztec today

A sequencer is an **attester identity** registered on the Rollup contract
with stake, plus a node that signs with that identity.

- Each epoch is 32 slots of 72 s. A committee of 48 attesters is drawn per
  epoch; in each slot one of them proposes and the rest attest.
- A proposer builds L2 blocks and publishes a checkpoint to L1, paying gas
  from its **publisher** account. Provers later prove the epoch.
- Rewards accrue on the Rollup contract to the **coinbase** address and are
  claimed with `claimSequencerRewards(coinbase)`. L2 fees are not enabled
  yet, so `feeRecipient` stays zero.

Live values (read on chain, mainnet):

| Value | Mainnet | Testnet (Sepolia) |
|---|---|---|
| Rollup | `0xE37A2663Cc9c119BA41572C40fAb0bbb23a5402f` | `0x1f435a7F2dA358caF887A470FAeEE7d5D5f4eFBA` |
| Rollup version | 2070860440 | 679261766 |
| Stake to activate | 200,000 AZTEC | 200,000 (test staking asset) |
| Ejected below | 100,000 | 100,000 |
| Exit delay | 96 h | 1 h |
| Slot / epoch / committee | 72 s / 32 slots / 48 | 72 s / 32 slots / 48 |
| Active sequencers (27 Oct) | 3,205 | 505 |

All L1 addresses live in `lib/aztec/sequencer/networks.ts`.

## 2. What we need (nothing here is optional)

1. **Stake**: 200,000 AZTEC per sequencer identity, staked through
   https://stake.aztec.network (self-stake), or run as a staking provider in
   the Staking Registry and let delegators fund our identities.
2. **A server**: 8 cores / 16 vCPU (Skylake or newer), 8 GB RAM, 1 TB NVMe,
   25 Mbps, TCP+UDP 40400 open to the internet.
3. **Ethereum access**: an execution RPC, a consensus (beacon) RPC, and an
   execution RPC that serves `debug_traceTransaction` or `trace_transaction`.
   Running our own Ethereum node (execution + consensus client) avoids rate
   limits; see the Nethermind notices on announce.aztec.network (1 and 22 Oct 2026).
4. **Keys**: generated with `aztec validator-keys new --staker-output ...`.
   The mnemonic goes offline. Only `keyN.json` files go on the server.
5. **Publisher ETH**: about 0.01 ETH per attester to start and ~0.03 ETH a
   year. Alert below 0.1 ETH: a sequencer without a funded publisher skips
   its slot.

## 3. Setup

```bash
# 1. Keys (on a trusted machine)
aztec-up install 6.0.0
# GSE: mainnet 0xa92ecFD0E70c9cd5E5cd76c50Af0F7Da93567a4f, testnet 0xb6A38A51a6C1de9012f9d8EA9745ef957212eAaC
aztec validator-keys new --staker-output \
  --gse-address $GSE \
  --l1-rpc-urls $ETH_RPC --fee-recipient 0x0000000000000000000000000000000000000000000000000000000000000000
# -> ~/.aztec/keystore/key1.json (private) and key1_staker_output.json (public)

# 2. Stake: upload key1_staker_output.json at https://stake.aztec.network
#    Activation takes 1-2 epochs after the queue processes it.

# 3. Server
cd docker/aztec-sequencer
cp aztec-sequencer.env.example .env          # fill it in
mkdir -p keys data && cp ~/.aztec/keystore/key1.json keys/ && chmod 600 keys/*.json
./scripts/preflight.sh                       # must end with "0 to fix"
docker compose up -d
docker compose --profile monitoring up -d    # optional: OTEL collector, Prometheus, Grafana
```

Checks once it runs:

```bash
curl -s http://localhost:8080/status
curl -s -X POST -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","method":"aztec_getChainTips","params":[],"id":1}' http://localhost:8080 | jq .result.proven
cast call $ROLLUP "getAttesterView(address)" $ATTESTER --rpc-url $ETH_RPC   # status 1 = VALIDATING
```

## 4. The Humanity Ledger side

The app reads, it never signs:

- `lib/aztec/sequencer/` talks to the node over the `aztec_*` JSON-RPC
  (`aztec_getChainTips`, `aztec_getNodeInfo`, `aztec_getBlock`,
  `aztec_getValidatorStats`, `aztec_getWorldStateSyncStatus`,
  `aztec_getPendingTxCount`, `aztec_isReady`) and to the Registry and
  Rollup contracts on L1 (canonical rollup, epoch/slot, committee, proposer,
  stake thresholds, `getAttesterView`, `getSequencerRewards`).
- `GET /api/aztec/sequencer/overview` (signed in) returns all of it, with
  every unreadable value marked as such. `GET /api/aztec/sequencer/health`
  answers 200 only when our node is READY and no critical alert is open.
- `/sequencer` is the dashboard; `/sequencer` in the chat links to it.
- `node node_modules/tsx/dist/cli.mjs scripts/aztec-sequencer-check.ts testnet <attester>`
  prints the same overview in a terminal and exits 1 on a critical alert.

Server env for the app: `AZTEC_NETWORK`, `AZTEC_NODE_URL` (private address of
port 8080), `AZTEC_L1_RPC_URL`, `AZTEC_ATTESTER_ADDRESSES`,
`AZTEC_PUBLISHER_ADDRESSES`, `AZTEC_COINBASE_ADDRESS`.

Node modes shown by the dashboard:

| Mode | Meaning |
|---|---|
| READY | API answers, trees synced, within 4 blocks of the network |
| SYNCING | API answers but behind or `isReady=false` |
| STANDBY | Only `/status` answers: v6 standby, the canonical rollup does not match the node yet |
| DOWN | Nothing answers |

## 5. Operating rules

- **Upgrades**: follow https://announce.aztec.network. For a new rollup,
  start the new version in standby on a separate host or with a separate
  container name, ports and empty data directory, keep the old one running
  until the new one attests, then remove the old one. Never pin
  `ROLLUP_VERSION`.
- **Slashing** (v6): proposing a checkpoint with a forged `lastArchiveRoot`,
  and equivocation (one key signing two checkpoints). Never run the same
  keys on two nodes without the HA signing setup (shared PostgreSQL,
  `VALIDATOR_HA_*`). Slashing is off for the first 8,400 slots of v6
  (until about 2 Nov 2026 08:00 UTC); missed slots still cost rewards.
- **Exits**: `aztec sequencers remove` / `aztec remove-l1-validator` now
  require `--recipient`; attester-initiated exits are rate limited.
- **Alerts** (`docker/aztec-sequencer/monitoring/alerts.yml`): L2 height
  stalled 15 min, L1 height stalled 5 min, publisher below 0.1 ETH or unable
  to afford sends, fewer than 5 peers, slashing votes near quorum.

## Sources

- https://announce.aztec.network/a/2026-10-upgrade-the-v6-upgrade-executed-on
- https://github.com/aztec-labs-eng/aztec-node/releases/tag/v6.0.0
- https://docs.aztec.network/networks
- https://docs.aztec.network/the_aztec_network/setup/sequencer_management
- https://docs.aztec.network/operate/operators/solo-sequencer/register-sequencer
- https://docs.aztec.network/operate/operators/concepts/monitoring
- https://docs.aztec.network/operate/operators/sequencer-management/useful-commands
