# Communities Architecture Decision

> **Date**: 2025-10-20  
> **Status**: Decided

---

## Decision

| Community Type | Messaging Architecture | Label Shown |
|---------------|----------------------|------------|
| **Private** | XMTP MLS group (one group per community, one per private channel) | 🔒 Encrypted |
| **Public** | Server-stored PostgreSQL posts | 🌐 Public — not encrypted |

---

## Private Communities (XMTP MLS)

- Creating a private community → creates an XMTP MLS group
- Members join the group through their XMTP inbox
- Server stores: group ID, member wallet addresses, community metadata
- Server does **NOT** store: message content, encryption keys
- Admin actions (kick, ban) → remove from MLS group + server record

### MLS Group Limits

XMTP MLS groups currently support up to **400 members** per group. Groups above this limit are technically possible but may have performance degradation. Source: XMTP documentation. Behavior at limit: new join attempts fail with "group full" error.

### Private Channels

Each private channel within a private community is its own MLS group. Users must be individually added to each channel's group.

---

## Public Communities (Server-stored)

- Posts stored in PostgreSQL `CommunityPost` table
- Content is sanitized with DOMPurify before storage
- Label **"Public — not encrypted"** must be visible at all times
- Server enforces membership for write access
- Read access: public (paginated, cursor-based)

### Public Community Constraints

- All posts are readable by anyone with access (no false "encrypted" label)
- Cursor-based pagination — no offset pagination (performance)
- Moderation via `ModerationLog` and reports

---

## Migration Plan for Existing Private Communities

Existing private communities with plaintext content in PostgreSQL:
1. Users are notified via in-app banner
2. Options: migrate to XMTP (content is deleted from server), or archive (content exported then deleted)
3. Deadline: 90 days after feature launch
4. Automatic: after deadline, content is deleted from server

---

## Not Implemented Yet

- `NEXT_PUBLIC_COMMUNITIES_MLS=true` flag gates XMTP group creation
- Currently all communities use server-stored posts
- MLS integration: tracked as E-002 (pending)
