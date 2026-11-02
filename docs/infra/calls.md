# Calls Infrastructure Decision

> **Date**: 2025-10-20  
> **Status**: Decided — LiveKit Cloud (initial), self-hosted later

## Decision

Use **LiveKit Cloud** for the initial beta launch.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **LiveKit Cloud** | No infra to manage, global POPs, instant setup | Monthly cost scales with minutes |
| **Self-hosted LiveKit on Railway** | Control, no per-minute cost | Railway does **not** support UDP ingress — WebRTC requires UDP. Self-hosting on Railway is not viable without a separate VPS |
| **Self-hosted on VPS (Hetzner/DigitalOcean)** | Full control, cheapest at scale | Requires DevOps, TLS, coturn management |

### Rationale

Railway does not allow inbound UDP, which is required for WebRTC media. LiveKit Cloud resolves this and provides:
- Global TURN infrastructure
- Sub-100ms latency in major regions  
- SFU with 3-layer simulcast
- E2EE support

### Cost Estimate

| Users | Minutes/day | Cost/month (LiveKit Cloud ~$0.001/min) |
|-------|-------------|----------------------------------------|
| 1,000 | 10,000 | ~$300 |
| 10,000 | 100,000 | ~$3,000 |
| 100,000 | 1,000,000 | ~$30,000 |

At 100k+ users, migrate to self-hosted LiveKit on a VPS with Coturn.

## Environment Variables Required

```
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_URL=wss://your-project.livekit.cloud
```

## TURN Configuration

LiveKit Cloud provides its own TURN. For direct WebRTC (1:1 calls via WebRTCEngine), set:

```
NEXT_PUBLIC_TURN_URLS=turn:your-coturn-server.example.com:443?transport=tcp,turn:your-coturn-server.example.com:443
NEXT_PUBLIC_TURN_USERNAME=<hmac-temporal-username>
NEXT_PUBLIC_TURN_CREDENTIAL=<hmac-temporal-credential>
```

Generate HMAC-temporal credentials with Coturn's `turnadmin` tool. Do NOT use openrelayproject — credentials are public.
