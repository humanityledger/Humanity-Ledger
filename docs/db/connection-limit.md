# Database Connection Pooling Configuration

To prevent PostgreSQL connection exhaustion across horizontal replicas on Railway:
- `DATABASE_URL`: Appends `?connection_limit=10&pool_timeout=20`
- PgBouncer: Configured in `transaction` pooling mode.
- Formula: `max_connections = (replicas * connection_limit) + buffer = (10 * 10) + 20 = 120 <= 150 (PostgreSQL limit)`.
