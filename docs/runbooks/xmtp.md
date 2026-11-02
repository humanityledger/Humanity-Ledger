# Runbook: XMTP Network Degradation Contingency

1. Client detects connection failure across 3 consecutive exponential retries.
2. In-app banner: "Encrypted messaging network is reconnecting. Messages queued locally in IndexedDB."
3. Outbox queue resumes automatic flushing upon network restoration.
