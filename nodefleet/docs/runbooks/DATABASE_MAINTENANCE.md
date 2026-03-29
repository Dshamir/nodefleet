# NodeFleet Database Maintenance Runbook

This document covers routine PostgreSQL maintenance, monitoring queries, backup/restore procedures, migration workflows, and troubleshooting for the NodeFleet database.

**Database:** PostgreSQL 16
**ORM:** Drizzle ORM
**Container:** `nodefleet-postgres`
**Credentials:** `nodefleet` / `nodefleet` (default)
**Host port:** 50432 | **Internal port:** 5432

---

## Routine Maintenance

### VACUUM

PostgreSQL uses MVCC (Multi-Version Concurrency Control), which means deleted or updated rows leave behind dead tuples. `VACUUM` reclaims this space.

```bash
# Standard VACUUM (non-blocking, reclaims space for reuse within the table)
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c "VACUUM;"

# VACUUM with statistics update
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c "VACUUM ANALYZE;"

# VACUUM FULL on a specific table (blocks writes, reclaims disk space to OS)
# Use only during maintenance windows
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c "VACUUM FULL telemetry_records;"
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c "VACUUM FULL gps_records;"

# Check autovacuum status
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "SELECT relname, last_vacuum, last_autovacuum, last_analyze, last_autoanalyze
   FROM pg_stat_user_tables
   ORDER BY last_autovacuum DESC NULLS LAST;"
```

**Recommended schedule:** Run `VACUUM ANALYZE` weekly. Run `VACUUM FULL` on high-churn tables (`telemetry_records`, `gps_records`) monthly during off-peak hours.

### ANALYZE

Updates query planner statistics so PostgreSQL can choose optimal execution plans.

```bash
# Analyze all tables
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c "ANALYZE;"

# Analyze a specific table
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c "ANALYZE telemetry_records;"
```

**Recommended schedule:** Run after large bulk inserts or deletes. `VACUUM ANALYZE` covers both.

### REINDEX

Rebuilds indexes that have become bloated. Indexes on frequently-updated columns can fragment over time.

```bash
# Reindex a specific table
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c "REINDEX TABLE telemetry_records;"

# Reindex the entire database (takes longer, acquires locks)
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c "REINDEX DATABASE nodefleet;"

# Concurrently reindex (PostgreSQL 12+, non-blocking)
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "REINDEX TABLE CONCURRENTLY telemetry_records;"
```

**Recommended schedule:** Monthly, or when monitoring shows significant index bloat.

---

## Monitoring Queries

### Table Sizes

```sql
-- Top 10 largest tables (including indexes)
SELECT
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  pg_size_pretty(pg_relation_size(relid)) AS table_size,
  pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;
```

```bash
# Run from host
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS total
   FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;"
```

### Database Size

```bash
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "SELECT pg_size_pretty(pg_database_size('nodefleet')) AS db_size;"
```

### Index Usage

```sql
-- Find unused indexes (candidates for removal)
SELECT
  schemaname, relname AS table_name, indexrelname AS index_name,
  idx_scan AS times_used, pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

```sql
-- Index hit ratio (should be > 0.99 for good performance)
SELECT
  relname,
  CASE WHEN idx_scan + seq_scan = 0 THEN 0
       ELSE round(100.0 * idx_scan / (idx_scan + seq_scan), 2)
  END AS index_hit_pct,
  idx_scan, seq_scan
FROM pg_stat_user_tables
WHERE (idx_scan + seq_scan) > 0
ORDER BY index_hit_pct ASC;
```

### Slow Queries

```sql
-- Currently running queries sorted by duration
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  state,
  left(query, 120) AS query_preview
FROM pg_stat_activity
WHERE datname = 'nodefleet'
  AND state != 'idle'
ORDER BY duration DESC
LIMIT 20;
```

```sql
-- If pg_stat_statements is enabled: top queries by total time
SELECT
  left(query, 100) AS query,
  calls,
  round(total_exec_time::numeric, 2) AS total_ms,
  round(mean_exec_time::numeric, 2) AS avg_ms
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

### Connection Count

```sql
-- Total connections by state
SELECT state, count(*)
FROM pg_stat_activity
WHERE datname = 'nodefleet'
GROUP BY state
ORDER BY count DESC;

-- Total connections vs max
SELECT
  (SELECT count(*) FROM pg_stat_activity WHERE datname = 'nodefleet') AS current,
  (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max;
```

### Dead Tuples (Bloat Indicator)

```sql
-- Tables with the most dead tuples (need VACUUM)
SELECT
  relname,
  n_live_tup,
  n_dead_tup,
  CASE WHEN n_live_tup = 0 THEN 0
       ELSE round(100.0 * n_dead_tup / n_live_tup, 2)
  END AS dead_pct,
  last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 0
ORDER BY n_dead_tup DESC
LIMIT 10;
```

---

## Backup and Restore

NodeFleet includes a backup script at `scripts/backup.sh` that handles PostgreSQL, MinIO, and Redis.

### Create a Backup

```bash
# Run the backup script (creates timestamped backup in ./backups/)
./scripts/backup.sh

# What it does:
# 1. pg_dump of the nodefleet database -> postgres.sql.gz
# 2. Copies MinIO data -> minio_data.tar.gz
# 3. Triggers Redis BGSAVE and copies dump.rdb -> dump.rdb.gz
```

### List Existing Backups

```bash
./scripts/backup.sh --list
```

### Restore from Backup

```bash
# Restore by timestamp directory name
./scripts/backup.sh --restore 20260329_120000

# Or by full path
./scripts/backup.sh --restore ./backups/20260329_120000

# WARNING: This overwrites current data. There is a 5-second countdown to cancel.
```

### Manual PostgreSQL-Only Backup

```bash
# Dump only (no compression)
docker exec nodefleet-postgres pg_dump -U nodefleet -d nodefleet > backup.sql

# Dump with compression
docker exec nodefleet-postgres pg_dump -U nodefleet -d nodefleet | gzip > backup.sql.gz

# Restore from manual dump
gunzip -c backup.sql.gz | docker exec -i nodefleet-postgres psql -U nodefleet -d nodefleet
```

### Backup Schedule Recommendation

| Frequency | What | Retention |
|-----------|------|-----------|
| Daily | `./scripts/backup.sh` | 7 days |
| Weekly | Full backup + off-site copy | 4 weeks |
| Before migrations | `./scripts/backup.sh` | Until migration is verified |

---

## Migration Procedures

NodeFleet uses Drizzle ORM for schema management. Migrations live in `web/drizzle/` or are generated from the schema definitions in `web/src/lib/db/schema.ts`.

### Generate a Migration

After modifying the Drizzle schema files:

```bash
# From the web/ directory
cd web
npx drizzle-kit generate

# This creates a new SQL migration file in the migrations directory
```

### Apply Migrations

```bash
# Using the orchestration script (recommended)
./nodefleet.sh migrate

# Or directly via drizzle-kit
cd web
npx drizzle-kit migrate
```

### Migration Safety Checklist

1. **Backup first** -- Always run `./scripts/backup.sh` before applying migrations.
2. **Review the generated SQL** -- Read the migration file before applying. Check for destructive operations (`DROP TABLE`, `DROP COLUMN`, `ALTER TYPE`).
3. **Test locally** -- Apply the migration on a local/staging environment first.
4. **Apply during low-traffic periods** -- Migrations that alter large tables can lock them.
5. **Verify after migration** -- Check that the application starts cleanly and key queries work.

```bash
# Verify schema is in sync after migration
cd web
npx drizzle-kit check
```

### Rollback Considerations

Drizzle ORM does not provide automatic rollback. If a migration fails or causes issues:

1. Restore from the pre-migration backup: `./scripts/backup.sh --restore <timestamp>`
2. Fix the migration SQL and re-apply.
3. See [ROLLBACK.md](./ROLLBACK.md) for full rollback procedures.

---

## Troubleshooting

### Connection Pool Exhaustion

**Symptom:** `"too many clients already"` errors in web or ws-server logs.

```bash
# Check current connections
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "SELECT state, count(*) FROM pg_stat_activity WHERE datname = 'nodefleet' GROUP BY state;"

# Kill idle connections
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE datname = 'nodefleet' AND state = 'idle' AND pid <> pg_backend_pid();"

# Restart application services to reset pools
docker compose restart web ws-server
```

**Root causes:**
- Connection pool `max` set too high relative to `max_connections`
- Application not releasing connections (check for unclosed transactions)
- Multiple service restarts creating orphaned connections

**Fix:** Ensure Drizzle pool settings (`max`) across all services sum to less than PostgreSQL `max_connections` (default: 100). Reserve ~10 connections for admin/monitoring.

### Lock Contention

**Symptom:** Queries hang or are very slow. Other queries waiting on locks.

```bash
# Find blocking queries
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "SELECT
     blocked.pid AS blocked_pid,
     blocked.query AS blocked_query,
     blocking.pid AS blocking_pid,
     blocking.query AS blocking_query,
     now() - blocked.query_start AS blocked_duration
   FROM pg_stat_activity blocked
   JOIN pg_locks bl ON bl.pid = blocked.pid
   JOIN pg_locks kl ON kl.locktype = bl.locktype
     AND kl.database IS NOT DISTINCT FROM bl.database
     AND kl.relation IS NOT DISTINCT FROM bl.relation
     AND kl.page IS NOT DISTINCT FROM bl.page
     AND kl.tuple IS NOT DISTINCT FROM bl.tuple
     AND kl.transactionid IS NOT DISTINCT FROM bl.transactionid
     AND kl.pid != bl.pid
     AND kl.granted
   JOIN pg_stat_activity blocking ON blocking.pid = kl.pid
   WHERE NOT bl.granted;"

# Terminate a specific blocking query
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "SELECT pg_terminate_backend(<blocking_pid>);"
```

**Prevention:**
- Keep transactions short
- Avoid `VACUUM FULL` and `REINDEX` (use `CONCURRENTLY` variants) during peak hours
- Use `SET lock_timeout = '10s';` in migration scripts to fail fast on contention

### Table Bloat

**Symptom:** Table size grows disproportionately to row count. Queries slow down.

```bash
# Check bloat ratio
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "SELECT
     relname,
     n_live_tup,
     n_dead_tup,
     pg_size_pretty(pg_total_relation_size(relid)) AS total_size
   FROM pg_stat_user_tables
   ORDER BY n_dead_tup DESC
   LIMIT 10;"

# Fix: VACUUM FULL reclaims space (acquires exclusive lock)
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "VACUUM FULL telemetry_records;"

# For high-churn tables, consider data retention
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "DELETE FROM telemetry_records WHERE recorded_at < NOW() - INTERVAL '90 days';"
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "VACUUM ANALYZE telemetry_records;"
```

**Prevention:**
- Tune autovacuum settings for high-churn tables (`autovacuum_vacuum_scale_factor`, `autovacuum_analyze_scale_factor`)
- Implement data retention policies to limit unbounded growth in `telemetry_records` and `gps_records`
- Monitor dead tuple counts via Grafana

---

## Quick Reference

```bash
# Connect to psql interactively
docker exec -it nodefleet-postgres psql -U nodefleet -d nodefleet

# Run arbitrary SQL
./nodefleet.sh db "SELECT count(*) FROM devices;"

# Check PostgreSQL is alive
docker exec nodefleet-postgres pg_isready -U nodefleet

# View PostgreSQL logs
docker compose logs --tail=100 postgres

# Database size
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "SELECT pg_size_pretty(pg_database_size('nodefleet'));"
```
