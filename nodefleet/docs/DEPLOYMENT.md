# NodeFleet Deployment Guide

## Prerequisites

- **Docker** (version 20.10 or later)
- **Docker Compose** (version 2.0 or later, included with Docker Desktop)
- **Minimum 4 GB RAM** available to Docker (required for building and running all services)

---

## Environment Configuration

Copy `.env.example` to `.env` and configure each variable:

```bash
cp .env.example .env
```

### Variable Reference

| Variable              | Description                                                                 |
|-----------------------|-----------------------------------------------------------------------------|
| `DATABASE_URL`        | PostgreSQL connection string. Format: `postgresql://user:pass@host:port/db`. In Docker, the host is the service name (e.g., `postgres`). |
| `REDIS_URL`           | Redis connection string. Format: `redis://host:port`. In Docker, use the service name (e.g., `redis`). |
| `S3_ENDPOINT`         | S3-compatible storage endpoint. Use MinIO URL for local development (e.g., `http://minio:9000`). |
| `S3_ACCESS_KEY`       | Access key for S3/MinIO.                                                    |
| `S3_SECRET_KEY`       | Secret key for S3/MinIO.                                                    |
| `S3_BUCKET`           | S3 bucket name for media storage.                                           |
| `S3_REGION`           | S3 region (e.g., `us-east-1`). For MinIO, any value works.                  |
| `NEXTAUTH_URL`        | Public URL of the application (e.g., `http://localhost:8888`).              |
| `NEXTAUTH_SECRET`     | Secret used to sign session tokens. Must be a strong random string in production. |
| `STRIPE_SECRET_KEY`   | Stripe API secret key for payment processing.                               |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret for verifying incoming events.              |
| `WS_URL`              | WebSocket server URL (e.g., `ws://localhost:8082` or internal Docker URL).  |
| `WS_SECRET`           | Shared secret between the web app and WebSocket server for authentication.  |
| `AUTH_TRUST_HOST`     | Set to `true` when running behind a reverse proxy or in Docker. Required for NextAuth to work correctly in containerized environments. |

---

## Development Setup

### 1. Start All Services

```bash
docker compose up -d
```

This starts PostgreSQL, Redis, MinIO, the Next.js web application, and the WebSocket server.

### 2. Seed the Database

Connect to the PostgreSQL instance and run the following SQL to set up the schema and a test user.

```bash
docker exec -i nodefleet-postgres psql -U nodefleet -d nodefleet
```

The database tables are created automatically when the application starts. To seed test data, run the following SQL:

```sql
-- Seed test user (password: test1234)
INSERT INTO users (id, email, name, password_hash, role) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'test@nodefleet.io', 'Test User',
   '$2b$10$Rc3vxncpXSfCxlKJ/UJ2h.a29HXyCfe/WqiflWezj27YWiMOOjE26', 'admin');

-- Seed organization
INSERT INTO organizations (id, name, slug, owner_id, plan, device_limit, storage_limit) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Test Organization', 'test-org',
   'a0000000-0000-0000-0000-000000000001', 'pro', 10, 10737418240);

-- Seed org membership
INSERT INTO org_members (org_id, user_id, role) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner');

-- Note: The organization will be assigned a readable identifier (e.g., NF-TESTORGA-64E58D)
-- automatically by the application, derived from SHA-256 of orgId:orgName:ownerEmail.

-- Seed demo devices
INSERT INTO devices (org_id, name, hw_model, serial_number, pairing_code, status, firmware_version, last_heartbeat_at, last_ip) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Gateway Alpha', 'ESP32-S3', 'NF-ESP32-001', 'A1B2C3', 'online', '2.3.1', now() - interval '2 minutes', '10.0.1.101'),
  ('b0000000-0000-0000-0000-000000000001', 'Sensor Beta', 'ESP32-C3', 'NF-ESP32-002', 'D4E5F6', 'online', '2.1.0', now() - interval '5 minutes', '10.0.1.102'),
  ('b0000000-0000-0000-0000-000000000001', 'Camera Unit 1', 'ESP32-CAM', 'NF-ESP32-003', 'G7H8I9', 'offline', '1.8.5', now() - interval '45 minutes', '10.0.1.103'),
  ('b0000000-0000-0000-0000-000000000001', 'Fleet Monitor 03', 'ESP32-CAM', 'NF-ESP32-004', 'J1K2L3', 'online', '2.3.1', now() - interval '1 minute', '192.168.1.104'),
  ('b0000000-0000-0000-0000-000000000001', 'Mobile Unit 12', 'ESP32-S3', 'NF-ESP32-005', 'M4N5O6', 'pairing', '1.0.0', NULL, NULL);
```

After seeding, the test user credentials are:

- **Email:** `test@nodefleet.io`
- **Password:** `test1234`

### Demo Seed Data

The seed SQL creates test data that populates all dashboard pages:
- 1 admin user (test@nodefleet.io / test1234)
- 1 organization (Test Organization, Pro plan)
- 3 fleets: HQ Office (San Francisco), Warehouse West (Los Angeles), Field Ops (Houston)
- 5 devices with various statuses, each assigned to a fleet via `fleet_id`
- 12 telemetry records, 10 GPS points, 6 media files, 4 schedules with assignments, and 6 command history entries
- Organization readable identifiers are generated at runtime (format: `NF-PREFIX-HASH`)

The `api_keys` table is created automatically by the application schema. It stores:

| Column         | Description                                      |
|----------------|--------------------------------------------------|
| `id`           | UUID primary key                                 |
| `user_id`      | Foreign key to `users`                           |
| `org_id`       | Foreign key to `organizations`                   |
| `name`         | Descriptive name for the key                     |
| `key_hash`     | SHA-256 hash of the full API key                 |
| `key_prefix`   | First segment of the key (e.g., `nf_a1b2c3d4`)  |
| `last_used_at` | Timestamp of last usage (nullable)               |
| `expires_at`   | Optional expiration timestamp                    |
| `created_at`   | Creation timestamp                               |

To remove all seed data and start fresh:
```bash
docker exec -i nodefleet-postgres psql -U nodefleet -d nodefleet -c "DELETE FROM org_members; DELETE FROM organizations; DELETE FROM users;"
```

---

## Port Mapping

The Docker Compose configuration remaps default service ports to avoid conflicts with locally running instances:

| Service        | Host Port | Container Port | Description                        |
|----------------|-----------|----------------|------------------------------------|
| Nginx          | 8888      | 80             | HTTP reverse proxy (main entry)    |
| Nginx HTTPS    | 8443      | 443            | HTTPS                              |
| Web (Next.js)  | 3002      | 3000           | Web application                    |
| WebSocket      | 8081      | 8080           | Device real-time comms             |
| PostgreSQL     | 5433      | 5432           | Database                           |
| Redis          | 6381      | 6379           | Cache and pub/sub                  |
| MinIO API      | 9000      | 9000           | Object storage                     |
| MinIO Console  | 9001      | 9001           | Storage web UI                     |
| UDP Discovery  | 5555      | 5555           | Device auto-discovery (UDP)        |

To change a port mapping, edit the `ports` section of the relevant service in `docker-compose.yml`. For example, to change the web app from port 8888 to 3000:

```yaml
services:
  web:
    ports:
      - "3000:3000"   # was "8888:3000"
```

After changing ports, update `NEXTAUTH_URL` in your `.env` file to match the new external port.

---

## Production Considerations

Before deploying to production, make the following changes:

### Security

- **Change `NEXTAUTH_SECRET`** to a cryptographically strong random string. Generate one with:
  ```bash
  openssl rand -base64 32
  ```
- **Set real Stripe keys.** Replace test keys (`sk_test_...`) with live keys (`sk_live_...`) and update `STRIPE_WEBHOOK_SECRET` to match the production webhook endpoint.
- **Restrict database access.** Change the default PostgreSQL username and password.

### HTTPS

Configure HTTPS using a reverse proxy (e.g., Nginx, Caddy, or Traefik) in front of the web application. Update `NEXTAUTH_URL` to use `https://`.

Ensure `AUTH_TRUST_HOST=true` is set when running behind a reverse proxy so NextAuth correctly reads the forwarded host and protocol headers.

### Environment

- Set `NODE_ENV=production` in the web service environment.
- Remove or disable any debug logging.

---

## Rebuilding Services

After making code changes, rebuild the affected service images:

```bash
# Rebuild the Next.js web application
docker compose build web

# Rebuild the WebSocket server
docker compose build ws-server

# Rebuild and restart in one step
docker compose up -d --build web ws-server
```

The ws-server includes built-in device discovery (UDP broadcast on port 5555 and mDNS). See [Device Discovery](DEVICE_DISCOVERY.md) for details.

To rebuild all services:

```bash
docker compose build
docker compose up -d
```

---

## Health Checks

All services in the Docker Compose configuration include health checks. To verify that every service is running and healthy:

```bash
docker ps
```

Look for `(healthy)` in the STATUS column for each container. A service marked `(unhealthy)` indicates a problem -- check its logs:

```bash
docker compose logs <service-name>
```

---

## Troubleshooting

### Port Conflicts

**Symptom:** `Bind for 0.0.0.0:XXXX failed: port is already allocated`

**Fix:** Another process is using the port. Either stop the conflicting process or change the port mapping in `docker-compose.yml` as described in the Port Mapping section above.

Find what is using a port:

```bash
# Linux
sudo lsof -i :8888

# Windows (PowerShell)
netstat -ano | findstr :8888
```

### npm ci Out of Memory

**Symptom:** The build fails with `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`

**Fix:** Increase Docker memory allocation to at least 4 GB. In Docker Desktop, go to Settings > Resources > Memory and set it to 4 GB or higher. Alternatively, set the Node.js memory limit in the Dockerfile:

```dockerfile
ENV NODE_OPTIONS="--max-old-space-size=4096"
```

### Edge Runtime Errors

**Symptom:** `Dynamic server usage` or `Edge Runtime is not supported` errors during build or at runtime.

**Fix:** This typically occurs when server-only code (database queries, file system access) is imported into an Edge-compatible route or middleware. Ensure that:

1. API routes using Prisma or Node.js APIs are not marked with `export const runtime = 'edge'`.
2. Middleware only uses Edge-compatible APIs.
3. Server-only imports are not accidentally included in client components.

### Database Connection Refused

**Symptom:** `ECONNREFUSED` when the web app tries to connect to PostgreSQL.

**Fix:** Ensure the `DATABASE_URL` uses the Docker service name (`postgres`) as the host, not `localhost`. Inside Docker, services communicate via the internal network using service names.

```
DATABASE_URL=postgresql://nodefleet:nodefleet@postgres:5432/nodefleet
```

### WebSocket Connection Failures

**Symptom:** Real-time updates (device status, telemetry) do not appear in the dashboard.

**Fix:** Verify the WebSocket server is running and healthy with `docker ps`. Check that `WS_URL` is set correctly and that the WebSocket port is accessible from the client browser. If running behind a reverse proxy, ensure it supports WebSocket upgrades.

### Container Keeps Restarting

**Symptom:** A service repeatedly restarts, shown by an increasing restart count in `docker ps`.

**Fix:** Check the service logs for the root cause:

```bash
docker compose logs --tail 50 <service-name>
```

Common causes include missing environment variables, incorrect database credentials, or a dependency service that has not finished starting.
