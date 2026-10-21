# On-Call Procedure

**Last updated**: October 2025

---

## On-Call Rotation

| Week | Primary | Secondary |
|------|---------|-----------|
| Current | [TBD] | [TBD] |

**Escalation**: If primary is unreachable, escalate to secondary, then to tech lead.

---

## Channels

| Channel | Purpose |
|---------|---------|
| #incidents (Slack) | Live incident coordination |
| #alerts (Slack) | Automated monitoring alerts |
| security@humanityledger.com | Security incidents |
| privacy@humanityledger.com | Privacy/legal incidents |

---

## Severity Levels

| SEV | Description | Response Time | Examples |
|-----|-------------|--------------|---------|
| SEV-1 | Complete outage or data breach | 15 min | DB down, auth broken, data leak |
| SEV-2 | Significant degradation | 1 hour | Messages delayed, calls failing |
| SEV-3 | Minor degradation | 4 hours | Slow queries, UI glitches |
| SEV-4 | Cosmetic / low impact | Next business day | Typos, minor UI issues |

---

## First Response Checklist

1. [ ] Join #incidents channel and declare incident commander
2. [ ] Check `/api/health` — what's failing?
3. [ ] Check Railway dashboard — any service down?
4. [ ] Check recent deployments — did a deploy trigger this?
5. [ ] Assess impact and assign severity
6. [ ] If SEV-1: notify tech lead immediately
7. [ ] Start incident timeline in the postmortem doc
8. [ ] Communicate status to users if needed (in-app banner)
