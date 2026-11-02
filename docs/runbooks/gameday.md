# Gameday — Quarterly Incident Simulation

**Owner**: Tech lead  
**Frequency**: Quarterly  
**Duration**: 2–3 hours

---

## Purpose

Practice incident response in a controlled environment so the team is prepared for real incidents.

---

## Scenarios to Simulate

| Scenario | Quarter |
|----------|---------|
| Database outage | Q1 |
| Redis eviction / loss of rate limiting | Q2 |
| Compromised API key (JWT rotation) | Q3 |
| LiveKit outage (calls down) | Q4 |

---

## Procedure

1. **Pre-game (30 min)**: Brief the team. Confirm staging environment is set up.
2. **Inject failure** in STAGING only (never production):
   - DB: Terminate connections or stop Postgres
   - Redis: Flush all keys (`FLUSHALL`)
   - JWT: Change `JWT_SECRET` and redeploy
   - LiveKit: Point `LIVEKIT_URL` to a non-existent endpoint
3. **Run incident response** following the runbooks
4. **Measure**:
   - MTTD: How long to detect?
   - MTTR: How long to resolve?
5. **Retrospective (30 min)**: What worked? What didn't?
6. **Update runbooks** based on findings

---

## Gameday Log

| Date | Scenario | MTTD | MTTR | Notes |
|------|----------|------|------|-------|
| TBD | TBD | TBD | TBD | First gameday |
