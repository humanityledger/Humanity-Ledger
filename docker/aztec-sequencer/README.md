# Aztec sequencer kit (v6.0.0)

```
docker-compose.yml               sequencer (azteclabs/aztec:6.0.0) + optional monitoring profile
aztec-sequencer.env.example      every variable, with what it is for
keystore.example.json            keystore schema v1 (keys stay in ./keys, never in git)
scripts/preflight.sh             read-only checks: L1, tracing, beacon, canonical rollup, keys, ports, hardware
monitoring/                      OTEL collector, Prometheus + alert rules, Grafana dashboard
```

```bash
cp aztec-sequencer.env.example .env
mkdir -p keys data && cp ~/.aztec/keystore/key1.json keys/ && chmod 600 keys/*.json
./scripts/preflight.sh        # needs curl and jq
docker compose up -d
docker compose logs -f --tail 100 aztec-sequencer
```

Full runbook, requirements and sources: `docs/AZTEC_SEQUENCER_SPEC.md`.
