# Postmortem Template

**Incident ID**: INC-YYYY-NNN  
**Date**: YYYY-MM-DD  
**Severity**: SEV-1 (Critical) / SEV-2 (High) / SEV-3 (Medium)  
**Status**: Open / Resolved  
**Duration**: X hours Y minutes  
**Incident Commander**: [Name]

---

## 1. Executive Summary

_One paragraph. What happened, impact on users, and how it was resolved._

---

## 2. Timeline

| Time (UTC) | Event |
|-----------|-------|
| HH:MM | Incident detected / alert fired |
| HH:MM | Incident commander assigned |
| HH:MM | Root cause identified |
| HH:MM | Mitigation applied |
| HH:MM | Full recovery confirmed |

---

## 3. Impact

- **Users affected**: N (estimated)
- **Duration**: X hours
- **Services affected**: [e.g., messaging, calls, authentication]
- **Data affected**: [e.g., none / logs only / user data]

---

## 4. Root Cause

_Technical description of what went wrong._

---

## 5. Contributing Factors

- [Factor 1]
- [Factor 2]

---

## 6. What Went Well

- [e.g., Monitoring alert fired within 2 minutes]
- [e.g., Rollback procedure worked smoothly]

---

## 7. What Could Be Improved

- [e.g., Alert threshold was too high]
- [e.g., No runbook for this scenario]

---

## 8. Action Items

| Action | Owner | Priority | Due Date | Status |
|--------|-------|----------|----------|--------|
| Fix root cause | [Name] | P1 | YYYY-MM-DD | Open |
| Add monitoring | [Name] | P2 | YYYY-MM-DD | Open |
| Update runbook | [Name] | P3 | YYYY-MM-DD | Open |

---

## 9. Metrics

- **MTTD** (Mean Time To Detect): X min
- **MTTR** (Mean Time To Resolve): X min
- **Uptime impact**: X% in the affected period
