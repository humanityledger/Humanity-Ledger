# Multi-Replica Zero-Downtime Deployment Architecture

1. Minimum 2 web service replicas on Railway Enterprise.
2. HTTP health checks configured at `GET /api/health` with 10s timeout, 3 retry threshold.
3. Rolling deploys drain active in-flight requests before terminating old containers.
