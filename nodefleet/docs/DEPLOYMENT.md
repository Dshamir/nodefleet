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
docker compose exec postgres psql -U nodefleet -d nodefleet
```

Then execute:

```sql
-- Create enums
CREATE TYPE "DeviceStatus" AS ENUM ('PENDING', 'ONLINE', 'OFFLINE', 'ERROR');
CREATE TYPE "CommandType" AS ENUM ('REBOOT', 'UPDATE', 'PLAY', 'STOP', 'CUSTOM');
CREATE TYPE "CommandStatus" AS ENUM ('PENDING', 'SENT', 'ACKNOWLEDGED', 'FAILED');
CREATE TYPE "RepeatType" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- Create organizations table
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- Create users table
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Create devices table
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hwModel" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'PENDING',
    "pairingCode" TEXT,
    "jwtSecret" TEXT,
    "lastSeen" TIMESTAMP(3),
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Device_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Device_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "Device_serialNumber_key" ON "Device"("serialNumber");
CREATE UNIQUE INDEX "Device_pairingCode_key" ON "Device"("pairingCode");

-- Create telemetry table
CREATE TABLE "Telemetry" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "cpuUsage" DOUBLE PRECISION,
    "memUsage" DOUBLE PRECISION,
    "diskUsage" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "uptime" INTEGER,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Telemetry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Telemetry_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE
);

-- Create commands table
CREATE TABLE "Command" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "command" "CommandType" NOT NULL,
    "payload" JSONB,
    "status" "CommandStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Command_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Command_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE
);

-- Create content table
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "s3Key" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Content_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Content_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

-- Create schedules table
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cronExpression" TEXT NOT NULL,
    "repeatType" "RepeatType" NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Schedule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

-- Create schedule items table
CREATE TABLE "ScheduleItem" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "ScheduleItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ScheduleItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE,
    CONSTRAINT "ScheduleItem_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE
);

-- Create device-schedule assignments table
CREATE TABLE "DeviceSchedule" (
    "deviceId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    CONSTRAINT "DeviceSchedule_pkey" PRIMARY KEY ("deviceId", "scheduleId"),
    CONSTRAINT "DeviceSchedule_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE,
    CONSTRAINT "DeviceSchedule_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE
);

-- Insert test organization and user
-- Password: test1234 (bcrypt hash)
INSERT INTO "Organization" ("id", "name", "createdAt", "updatedAt")
VALUES ('org-test-001', 'Test Organization', NOW(), NOW());

INSERT INTO "User" ("id", "email", "password", "name", "orgId", "createdAt", "updatedAt")
VALUES (
    'user-test-001',
    'admin@example.com',
    '$2b$10$Rc3vxncpXSfCxlKJ/UJ2h.a29HXyCfe/WqiflWezj27YWiMOOjE26',
    'Admin User',
    'org-test-001',
    NOW(),
    NOW()
);
```

After seeding, the test user credentials are:

- **Email:** `admin@example.com`
- **Password:** `test1234`

---

## Port Mapping

The Docker Compose configuration remaps default service ports to avoid conflicts with locally running instances:

| Service    | Internal Port | External (Host) Port | Notes                              |
|------------|---------------|----------------------|------------------------------------|
| PostgreSQL | 5432          | 5433                 | Avoids conflict with local PostgreSQL |
| Redis      | 6379          | 6381                 | Avoids conflict with local Redis   |
| MinIO API  | 9000          | 8081                 | S3-compatible API                  |
| Web App    | 3000          | 8888                 | Next.js application                |

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
