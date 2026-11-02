# Private Community Plaintext Migration & Purge

1. **Audit**: Identify all legacy private communities storing plaintext posts in the PostgreSQL `CommunityPost` table.
2. **Notification**: Owners and members receive in-app notice to migrate to XMTP MLS group channels.
3. **Purge**: Post contents cleared and replaced with cryptographic group invitation refs.
