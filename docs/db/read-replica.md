# Read Replica Strategy for Analytics & History

When active concurrent users exceed 5,000:
- Primary instance handles all writes (transactions, auth, community posts).
- Read replica attached via WAL streaming for read-heavy operations:
  - Aggregated community analytics
  - Public directory browsing
  - Audit log queries
