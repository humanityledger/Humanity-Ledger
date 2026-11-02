# API Idempotency Implementation

Creation endpoints (`POST /api/chat/communities`, `POST /api/chat/communities/[id]/channels`) accept optional `Idempotency-Key` header:
- Key cached in Redis with 24-hour TTL (`idempotency:{key}`).
- If key matches in-flight or completed request, cached response is returned without re-executing mutations.
