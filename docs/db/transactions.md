# Database Multi-Table Transaction Invariants

All multi-table mutations are wrapped in `prisma.$transaction([...])` with serializable or read-committed isolation:
1. Community Join: `create(CommunityMember)` + `increment(Community.memberCount)`
2. Account Deletion: Delete memberships, auth tokens, sessions, moderation flags in atomic batch.
3. Moderation Action: `create(ModerationLog)` + `update(CommunityMember.role)` or `delete(CommunityMember)`.
