# Breach Notification Procedure
# GDPR Article 33 — 72-hour notification

**Owner**: DPO (privacy@humanityledger.com)  
**Last updated**: October 2025

---

## 1. Detection & Triage (0–4 hours)

| Step | Action | Owner |
|------|--------|-------|
| 1.1 | Incident detected (alert, report, or discovery) | Any team member |
| 1.2 | Create incident ticket with timestamp | On-call engineer |
| 1.3 | Classify severity: Critical / High / Medium | Security lead |
| 1.4 | Convene incident response channel | On-call |

## 2. Containment (4–12 hours)

- Revoke compromised tokens / API keys
- Block attacker IP ranges (Railway WAF)
- Rotate affected secrets (see `docs/runbooks/secrets.md`)
- Preserve logs (do NOT delete — evidence)
- Take system snapshot if needed

## 3. Assessment (12–24 hours)

Determine:
- **What data was exposed?** (category, volume)
- **Who is affected?** (users, wallets, emails)
- **Is it ongoing?** (still active breach?)
- **Risk to individuals?** (identity theft, financial harm, discrimination)

Use this risk matrix:

| Data exposed | Risk level |
|-------------|-----------|
| Message content (should be E2EE) | Critical |
| Wallet addresses | Medium |
| Email addresses | Medium |
| Server logs only | Low |
| Session tokens (rotated) | Low |

## 4. Regulatory Notification (24–72 hours from discovery)

**If risk to individuals is NOT low, notify the supervisory authority within 72 hours.**

Template (adapt to actual incident):

```
To: [Lead DPA — e.g., AEPD for Spain, ICO for UK]
Subject: Personal Data Breach Notification — Humanity Ledger

1. Nature of the breach: [description]
2. Categories of data: [e.g., wallet addresses, email]
3. Approximate number of individuals: [N]
4. Likely consequences: [description]
5. Measures taken/proposed: [description]
6. Contact: privacy@humanityledger.com

Date of discovery: [datetime]
Date of this notification: [datetime]
```

## 5. User Notification (if required)

Required when breach is **likely to result in high risk** to individuals (Art. 34).

Send in-app banner + email within 72 hours of authority notification:

```
Subject: Important security notice — Humanity Ledger

We discovered a security incident on [date] that may have affected your account.
What happened: [brief description]
What was exposed: [data categories]
What we've done: [actions taken]
What you should do: [e.g., change PIN, revoke sessions]

Contact: privacy@humanityledger.com
```

## 6. Post-Incident (7 days)

- Full incident report (see `docs/postmortems/template.md`)
- Root cause analysis
- Corrective actions with owners and deadlines
- Update this procedure if gaps found

---

## Contact List

| Role | Name | Contact |
|------|------|---------|
| DPO | TBD | privacy@humanityledger.com |
| Security Lead | TBD | security@humanityledger.com |
| On-call | TBD | (Slack #oncall) |
