# NodeFleet Rollback Runbook

This document covers rollback procedures for services, database migrations, firmware, and full system recovery.

---

## Service Rollback via Docker

### Rolling Back a Single Service

If a newly deployed image causes issues, roll back to the previous working version by specifying an explicit image tag.

```bash
# Step 1: Identify the current image
docker compose ps --format "table {{.Service}}\t{{.Image}}"

# Step 2: Check available image tags (if using a registry)
docker image ls | grep nodefleet

# Step 3: Edit docker-compose.yml to pin the previous image tag
# Example: change "image: nodefleet-web:latest" to "image: nodefleet-web:v1.2.3"

# Step 4: Pull and restart only the affected service
docker compose pull web
docker compose up -d web

# Step 5: Verify health
./nodefleet.sh health
```

### Rolling Back with Docker Compose

```bash
# If you tagged your previous build, roll back the entire stack:
docker compose down
# Edit docker-compose.yml to reference previous image tags
docker compose up -d

# Or, if using local builds, check out the previous commit and rebuild:
git log --oneline -10
git checkout <previous-commit-hash>
docker compose build web ws-server
docker compose up -d web ws-server

# Verify all services
./nodefleet.sh --status
./nodefleet.sh health
```

### Quick Service Restart (No Rollback)

If the issue is transient (crash loop, memory spike), a simple restart may suffice:

```bash
docker compose restart web          # Restart Next.js app
docker compose restart ws-server    # Restart WebSocket server
docker compose restart nginx        # Restart reverse proxy
```

---

## Database Rollback

Drizzle ORM generates forward-only migrations and does not include automatic rollback. Use one of the following strategies.

### Strategy 1: Restore from Pre-Migration Backup (Recommended)

Always create a backup before running migrations. If the migration causes problems, restore:

```bash
# List available backups
./scripts/backup.sh --list

# Restore the pre-migration backup
./scripts/backup.sh --restore <timestamp>

# Example:
./scripts/backup.sh --restore 20260329_110000
```

This restores PostgreSQL, MinIO, and Redis to the backup point. After restoring, restart all services:

```bash
docker compose restart web ws-server
```

### Strategy 2: Manual SQL Rollback

If you know exactly what the migration changed, write a reverse SQL script:

```bash
# Example: undo an added column
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "ALTER TABLE devices DROP COLUMN IF EXISTS new_column;"

# Example: undo a renamed column
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "ALTER TABLE devices RENAME COLUMN new_name TO old_name;"

# Example: re-add a dropped column (data will be lost)
docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \
  "ALTER TABLE devices ADD COLUMN removed_column TEXT;"
```

After manual rollback, ensure the Drizzle schema files match the actual database state. You may need to revert the schema changes in code as well.

### Strategy 3: Point-in-Time Recovery (If WAL Archiving Is Configured)

For production deployments with WAL archiving enabled, PostgreSQL supports point-in-time recovery. This is not configured by default in the Docker Compose setup but can be added for production.

### Migration Rollback Checklist

- [ ] Identify the migration that caused the issue
- [ ] Determine if data was lost (DROP operations are not reversible without backup)
- [ ] Restore from backup OR write manual reverse SQL
- [ ] Revert the Drizzle schema changes in source code
- [ ] Restart web and ws-server services
- [ ] Verify the application works with the rolled-back schema
- [ ] Run `npx drizzle-kit check` to confirm schema sync

---

## Firmware Rollback

ESP32 devices running NodeFleet firmware can be rolled back via OTA (Over-The-Air) update using a presigned MinIO URL.

### OTA Re-Flash via Presigned URL

```bash
# Step 1: Upload the previous firmware binary to MinIO
# (Firmware binaries should be archived in MinIO after each successful build)
docker exec nodefleet-minio mc cp /path/to/firmware-v1.2.0.bin local/nodefleet-media/firmware/

# Step 2: Generate a presigned URL for the firmware binary
docker exec nodefleet-minio mc share download --expire=1h local/nodefleet-media/firmware/firmware-v1.2.0.bin

# Step 3: Send the update_firmware command to the device via the dashboard
# Or via API:
curl -X POST http://localhost:50080/api/devices/<device-id>/command \
  -H "Authorization: Bearer <api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "update_firmware",
    "payload": {
      "url": "<presigned-url-from-step-2>"
    }
  }'
```

### Fleet-Wide Firmware Rollback

To roll back firmware for all devices in a fleet:

```bash
# Use the fleet command broadcast endpoint
curl -X POST http://localhost:50080/api/fleets/<fleet-id>/command \
  -H "Authorization: Bearer <api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "update_firmware",
    "payload": {
      "url": "<presigned-url-to-previous-firmware>"
    }
  }'
```

### Manual Re-Flash via USB

If OTA is not possible (device unreachable, corrupt firmware), re-flash via USB:

```bash
# Using PlatformIO
cd firmware/esp32_agent
# Check out the previous firmware version
git checkout <previous-tag> -- firmware/esp32_agent/
# Flash
pio run -t upload

# Using Arduino IDE
# 1. Open firmware/esp32_agent/esp32_agent.ino
# 2. Select the correct board (ESP32-S3)
# 3. Click Upload
```

### Firmware Rollback Checklist

- [ ] Identify the firmware version to roll back to
- [ ] Confirm the binary is available in MinIO or can be rebuilt from source
- [ ] Test the rollback on a single device before fleet-wide deployment
- [ ] Send `update_firmware` command with presigned URL
- [ ] Monitor device command status (pending -> sent -> acknowledged -> completed)
- [ ] Verify device reconnects and reports the expected firmware version
- [ ] If OTA fails, prepare for USB re-flash

---

## Full System Rollback Checklist

Use this checklist when rolling back the entire NodeFleet stack (services + database + firmware).

### Pre-Rollback

- [ ] Identify the known-good state (git commit, image tags, backup timestamp, firmware version)
- [ ] Notify stakeholders of the planned rollback and expected downtime
- [ ] Confirm backup availability: `./scripts/backup.sh --list`

### Execute Rollback

1. **Stop all services:**
   ```bash
   docker compose down
   ```

2. **Restore database and storage from backup:**
   ```bash
   # Start only the data services
   docker compose up -d postgres redis minio
   sleep 10  # Wait for services to initialize

   # Restore from backup
   ./scripts/backup.sh --restore <timestamp>
   ```

3. **Roll back application code:**
   ```bash
   git checkout <known-good-commit>
   ```

4. **Rebuild and start application services:**
   ```bash
   docker compose build web ws-server
   docker compose up -d
   ```

5. **Verify all services are healthy:**
   ```bash
   ./nodefleet.sh --status
   ./nodefleet.sh health
   ```

6. **Roll back firmware (if needed):**
   ```bash
   # Upload previous firmware to MinIO and send OTA commands
   # See "Firmware Rollback" section above
   ```

### Post-Rollback Verification

- [ ] Dashboard loads and login works
- [ ] API health check returns 200: `curl http://localhost:50080/api/health`
- [ ] WebSocket server accepts connections: `curl http://localhost:50081/health`
- [ ] Devices reconnect and show "online" status
- [ ] Telemetry data is flowing (check dashboard or database)
- [ ] Media uploads work (test via dashboard)
- [ ] No error spikes in logs: `docker compose logs --tail=50`

### Post-Rollback Actions

- [ ] Document what was rolled back and why
- [ ] Create tracking issue for the root cause
- [ ] Schedule post-incident review (see INCIDENT_RESPONSE.md)
- [ ] Notify stakeholders that rollback is complete
