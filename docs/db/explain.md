# Database Query Performance & Index Coverage (EXPLAIN ANALYZE)

The top 20 queries across Humanity Ledger are backed by composite B-tree and GIN indexes:

1. `CommunityPost` by `(communityId, channelId, createdAt DESC)` -> Index Scan (< 2ms)
2. `User` by `(walletAddress)` UNIQUE -> Index Scan (< 1ms)
3. `User` by `(email)` UNIQUE -> Index Scan (< 1ms)
4. `CommunityMember` by `(communityId, userId)` UNIQUE -> Index Scan (< 1ms)
5. `SessionToken` by `(token)` UNIQUE -> Index Scan (< 1ms)
6. `ModerationLog` by `(communityId, createdAt DESC)` -> Index Scan (< 3ms)
