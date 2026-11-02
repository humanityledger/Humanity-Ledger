# Runbook: LiveKit Calls

**Owner**: On-call engineer  
**Last updated**: October 2025

---

## 1. Calls Not Connecting

### Symptoms
- Users report calls fail to start
- `/api/call/token` returns 503

### Steps

1. Check LiveKit Cloud dashboard: [dashboard.livekit.io](https://dashboard.livekit.io)
2. Verify `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` are set in Railway
3. Verify `LIVEKIT_URL` points to the correct project
4. Check Railway deploy logs for token generation errors

### If LiveKit Cloud is down

1. Display in-app banner: "Calls are temporarily unavailable"
2. Check [status.livekit.io](https://status.livekit.io)
3. Estimate recovery time from LiveKit status page

---

## 2. Poor Call Quality

### Symptoms
- Audio/video choppy or frozen
- High packet loss reported

### Steps

1. Check participant network quality in LiveKit dashboard
2. Verify TURN is configured for users behind symmetric NAT
3. Check TURN server credentials (`NEXT_PUBLIC_TURN_URLS`)
4. LiveKit Cloud automatically handles TURN — check if users are on cellular

---

## 3. Token Expiry Issues

Call tokens are valid for 10 minutes. If calls disconnect after 10 minutes:

1. Implement token refresh before expiry in `GroupPartyCall.tsx`
2. Token refresh endpoint: `POST /api/call/token` (same as initial)

---

## 4. Cost Alert

If LiveKit bill exceeds budget:

1. Check dashboard for unusual usage spikes
2. Set budget alerts in LiveKit Cloud console
3. Add `max_participants` limit to rooms via token grants
