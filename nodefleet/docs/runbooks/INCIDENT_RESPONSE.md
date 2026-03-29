# NodeFleet Incident Response Runbook

This document defines severity levels, escalation procedures, communication templates, and recovery steps for common NodeFleet incidents.

---

## Severity Levels

| Level | Name | Response Time | Description | Examples |
|-------|------|---------------|-------------|----------|
| **P1** | Critical | 15 minutes | Complete service outage or data loss affecting all users | PostgreSQL down, Nginx unreachable, data corruption |
| **P2** | High | 1 hour | Major feature degraded or affecting a significant portion of users | WebSocket server down (devices disconnected), MinIO unreachable (no media uploads), Redis down (no real-time updates) |
| **P3** | Medium | 4 hours | Minor feature degraded, workaround available | Slow dashboard queries, single device unable to pair, Grafana metrics gap |
| **P4** | Low | 24 hours | Cosmetic issue, minor inconvenience, non-urgent improvement | UI rendering glitch, non-critical log noise, documentation typo |

---

## Escalation Procedures

### Escalation Matrix

| Level | First Responder | Escalation (if unresolved in...) | Escalated To |
|-------|----------------|----------------------------------|--------------|
| P1 | On-call engineer | 15 minutes | Team lead + all available engineers |
| P2 | On-call engineer | 1 hour | Team lead |
| P3 | Assigned engineer | 8 hours | Team lead |
| P4 | Assigned engineer | Next sprint | N/A |

### Escalation Steps

1. **Acknowledge** -- Confirm receipt of the alert within the response time for the severity level.
2. **Assess** -- Determine the scope: how many users/devices are affected? Is data at risk?
3. **Communicate** -- Post an initial status update (see templates below).
4. **Mitigate** -- Apply the relevant recovery procedure (see Common Incidents below).
5. **Resolve** -- Confirm the issue is resolved and services are healthy.
6. **Review** -- Schedule a post-incident review for P1 and P2 incidents.

---

## Communication Templates

### Initial Incident Notification

```
INCIDENT: [Brief description]
SEVERITY: P[1-4]
STATUS: Investigating
IMPACT: [What is affected -- users, devices, features]
TIME DETECTED: [ISO 8601 timestamp]
ASSIGNED TO: [Name]
NEXT UPDATE: [Time of next status update]
```

### Status Update

```
INCIDENT UPDATE: [Brief description]
STATUS: [Investigating | Identified | Mitigating | Resolved]
ROOT CAUSE: [If identified]
ACTIONS TAKEN: [What has been done so far]
NEXT STEPS: [What will happen next]
NEXT UPDATE: [Time]
```

### Resolution Notification

```
INCIDENT RESOLVED: [Brief description]
SEVERITY: P[1-4]
DURATION: [Start time] to [End time] ([total duration])
ROOT CAUSE: [Summary]
RESOLUTION: [What fixed it]
FOLLOW-UP: [Post-incident review scheduled for DATE / Tracking issue #N]
```

---

## Common Incidents

### 1. Service Down (Web App / WS Server / Nginx)

**Symptoms:** Dashboard unreachable, devices cannot connect, HTTP 502/503 errors.

**Diagnosis:**

```bash
# Check all service status
./nodefleet.sh --status

# Check specific container
docker compose ps
docker compose logs --tail=100 web
docker compose logs --tail=100 ws-server
docker compose logs --tail=100 nginx
```

**Recovery:**

```bash
# Restart the affected service
docker compose restart web        # Next.js app
docker compose restart ws-server  # WebSocket server
docker compose restart nginx      # Reverse proxy

# If restart fails, rebuild the service
./nodefleet.sh rebuild web
./nodefleet.sh rebuild ws-server

# Nuclear option: restart entire stack (preserves volumes)
docker compose down && docker compose up -d

# Verify recovery
./nodefleet.sh health
```

**Post-recovery checks:**
- Confirm dashboard loads at `http://localhost:50080`
- Confirm at least one device reconnects via WebSocket
- Check `/api/health` returns 200

---

### 2. Database Connection Pool Exhausted

**Symptoms:** API requests return 500 errors with "too many clients" or "connection pool timeout" messages. Dashboard partially loads but data fetches fail.

**Diagnosis:**

```bash
# Check current connection count
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname = 'nodefleet';"

# Check connections by state
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "SELECT state, count(*) FROM pg_stat_activity WHERE datname = 'nodefleet' GROUP BY state;"

# Check for long-running queries
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
   FROM pg_stat_activity
   WHERE datname = 'nodefleet' AND state != 'idle'
   ORDER BY duration DESC
   LIMIT 10;"
```

**Recovery:**

```bash
# Terminate idle connections (safe)
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE datname = 'nodefleet'
     AND state = 'idle'
     AND pid <> pg_backend_pid();"

# Terminate long-running queries (> 5 minutes)
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE datname = 'nodefleet'
     AND state = 'active'
     AND now() - query_start > interval '5 minutes'
     AND pid <> pg_backend_pid();"

# If still exhausted, restart the web and ws-server to reset pools
docker compose restart web ws-server

# Verify
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname = 'nodefleet';"
```

**Prevention:**
- Monitor connection count in Grafana
- Set `max_connections` in PostgreSQL appropriately (default: 100)
- Ensure Drizzle ORM connection pool `max` is set below `max_connections`

---

### 3. Device Fleet Disconnection

**Symptoms:** All or many devices show "offline" status. Telemetry and GPS data stops flowing. Dashboard device count drops.

**Diagnosis:**

```bash
# Check ws-server health and logs
docker compose logs --tail=200 ws-server

# Check Redis pub/sub is functioning
docker exec nodefleet-redis redis-cli PING

# Check if WebSocket port is reachable
curl -s -o /dev/null -w "%{http_code}" http://localhost:50081/health

# Check device token validity
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "SELECT count(*) FROM device_tokens WHERE revoked_at IS NULL AND expires_at > NOW();"

# Check recent device status changes
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "SELECT id, name, status, updated_at FROM devices ORDER BY updated_at DESC LIMIT 20;"
```

**Recovery:**

```bash
# Step 1: Restart ws-server (devices will auto-reconnect)
docker compose restart ws-server

# Step 2: If Redis is the issue, restart Redis
docker compose restart redis

# Step 3: Verify ws-server is accepting connections
curl http://localhost:50081/health

# Step 4: Wait 60-90 seconds for devices to reconnect (exponential backoff)
# Monitor reconnection progress
docker compose logs -f ws-server | grep -i "connect"
```

**If devices do not reconnect:**
- Check network connectivity between devices and server
- Verify Nginx is correctly proxying WebSocket upgrades (`/ws/` path)
- Check if device JWT tokens have expired (re-pairing may be needed)
- For ESP32 devices: check serial monitor for connection errors

---

### 4. Storage Full (Disk / MinIO / PostgreSQL)

**Symptoms:** File uploads fail, database writes fail with "no space left on device", MinIO returns 500 errors.

**Diagnosis:**

```bash
# Check host disk usage
df -h

# Check Docker volume sizes
docker system df -v

# Check PostgreSQL database size
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "SELECT pg_size_pretty(pg_database_size('nodefleet'));"

# Check largest tables
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
   FROM pg_catalog.pg_statio_user_tables
   ORDER BY pg_total_relation_size(relid) DESC
   LIMIT 10;"

# Check MinIO bucket size
docker exec nodefleet-minio mc ls --recursive --summarize local/nodefleet-media 2>/dev/null || \
  echo "Use MinIO Console at http://localhost:50901 to check bucket size"
```

**Recovery:**

```bash
# Clean up old telemetry data (keep last 30 days)
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "DELETE FROM telemetry_records WHERE recorded_at < NOW() - INTERVAL '30 days';"

# Clean up old GPS records (keep last 30 days)
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "DELETE FROM gps_records WHERE recorded_at < NOW() - INTERVAL '30 days';"

# Reclaim space after large deletes
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c "VACUUM FULL;"

# Clean up Docker build cache
docker builder prune -f

# Clean up unused Docker images
docker image prune -f

# Clean up old backups
ls -la backups/
# Remove old backups as needed: rm -rf backups/YYYYMMDD_HHMMSS
```

**Prevention:**
- Set up Grafana alerts on disk usage (threshold: 80%)
- Implement data retention policies for telemetry and GPS tables
- Schedule regular `VACUUM` jobs (see DATABASE_MAINTENANCE.md)
- Monitor MinIO storage via the console at port 50901

---

## Post-Incident Review Template

Schedule a post-incident review within 48 hours for all P1 and P2 incidents. Use the following template:

```markdown
# Post-Incident Review

## Incident Summary
- **Date:** [YYYY-MM-DD]
- **Duration:** [Start] to [End] ([total])
- **Severity:** P[1-4]
- **Affected services:** [List]
- **User/device impact:** [Number of users/devices affected]

## Timeline
| Time (UTC) | Event |
|------------|-------|
| HH:MM | [Alert triggered / Issue reported] |
| HH:MM | [First responder acknowledged] |
| HH:MM | [Root cause identified] |
| HH:MM | [Mitigation applied] |
| HH:MM | [Service restored] |
| HH:MM | [All-clear declared] |

## Root Cause
[Detailed technical explanation of what went wrong and why]

## Resolution
[What was done to fix the issue]

## What Went Well
- [Item 1]
- [Item 2]

## What Could Be Improved
- [Item 1]
- [Item 2]

## Action Items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Preventive measure 1] | [Name] | [Date] | Open |
| [Preventive measure 2] | [Name] | [Date] | Open |

## Monitoring Gaps
[Were there alerts that should have fired but didn't? What monitoring should be added?]
```

---

## Quick Reference: Health Check Commands

```bash
# Full system health
./nodefleet.sh health

# Individual service checks
curl -s http://localhost:50080/api/health          # Web app
curl -s http://localhost:50081/health              # WebSocket server
docker exec nodefleet-postgres pg_isready -U nodefleet  # PostgreSQL
docker exec nodefleet-redis redis-cli PING         # Redis

# Service logs
docker compose logs --tail=50 <service-name>
./nodefleet.sh logs <service-name>
```
