# NodeFleet Architecture

This document describes the system architecture, service topology, data flows, and security model of the NodeFleet platform.

## System Overview

```
                          +-------------------+
                          |     Browser       |
                          | (Dashboard User)  |
                          +--------+----------+
                                   |
                            HTTP / WSS
                                   |
                          +--------v----------+
                          |      Nginx        |
                          |  (Reverse Proxy)  |
                          |   Port 8888       |
                          +---+----------+----+
                              |          |
                   /app/*     |          |  /ws/*
                              |          |
                 +------------v--+    +--v--------------+
                 |   Web App     |    |   WS Server     |
                 |  (Next.js 14) |    |  (Node.js/TS)   |
                 |  Port 3002    |    |  Port 8081      |
                 +--+----+----+--+    +---+--------+----+
                    |    |    |           |         |
                    |    |    |           |         |
               +----v-+  | +-v------+  +-v------+  |
               |Postgres| | | MinIO |  | Redis  |  |
               |  :5433 | | | :9000 |  | :6381  |  |
               +--------+ | +-------+  +--------+  |
                           |                        |
                           +-------+  +-------------+
                                   |  |
                                   v  v
                          +-------------------+
                          |   ESP32 Device    |
                          |  (IoT Firmware)   |
                          +--------+----------+
                                   |
                          WSS :8081 / UDP :5555
```

Data flows:

- The **Browser** connects to **Nginx**, which routes HTTP traffic to the **Web App** and WebSocket upgrade requests to the **WS Server**.
- The **Web App** reads and writes to **PostgreSQL** (primary data), **Redis** (cache and pub/sub), and **MinIO** (object storage for media).
- The **WS Server** maintains persistent WebSocket connections with ESP32 devices and uses **Redis** pub/sub to exchange messages with the Web App.
- **ESP32 Devices** connect to the **WS Server** over WebSocket for telemetry reporting, command reception, and media upload coordination.

## Service Descriptions

### postgres (PostgreSQL 16)

The primary relational database. Stores all application state including users, organizations, devices, telemetry records, GPS data, media metadata, schedules, and commands. Runs with a health check on `pg_isready` and persists data to a named Docker volume (`postgres_data`).

- Host port: 5433
- Internal port: 5432
- Default credentials: `nodefleet` / `nodefleet`
- Database name: `nodefleet`

### redis (Redis 7 Alpine)

Serves two purposes: (1) caching frequently accessed data such as device status and session tokens, and (2) acting as a pub/sub message broker between the Web App and the WS Server. When a user sends a command from the dashboard, the Web App publishes it to a Redis channel; the WS Server subscribes to that channel and forwards the command to the target device.

- Host port: 6381
- Internal port: 6379
- Data persisted to `redis_data` volume

### minio (MinIO)

S3-compatible object storage for device-captured media (photos, videos, audio, documents). On startup, a companion `minio-init` container creates the `nodefleet-media` bucket. The Web App generates presigned upload URLs that devices use to upload media directly to MinIO, avoiding large payloads through the WebSocket connection.

- API port: 9000
- Console port: 9001
- Default credentials: `minioadmin` / `minioadmin`
- Data persisted to `minio_data` volume

### web (Next.js 14 Application)

The primary application server built with Next.js 14 App Router. Serves the dashboard UI and exposes REST API routes under `/api/`. Uses Drizzle ORM for database access, NextAuth v5 for authentication, and connects to Redis and MinIO for caching and storage operations.

- Host port: 3002
- Internal port: 3000
- Depends on: postgres, redis, minio

### ws-server (WebSocket Server)

A standalone Node.js/TypeScript WebSocket server that handles all real-time device communication. Devices establish persistent WebSocket connections authenticated with JWT tokens. The server validates tokens, processes incoming telemetry and GPS data, forwards commands from Redis pub/sub to connected devices, and manages device online/offline status.

- Host port: 8081
- Internal port: 8080
- Depends on: redis

### Discovery Service (built into ws-server)

Enables ESP32 devices to find the server on the local network without hardcoded IPs.

- **UDP Broadcast** (port 5555): Listens for `NODEFLEET_DISCOVER` packets, responds with server URLs
- **mDNS Responder**: Resolves `nodefleet.local` to the server IP via multicast DNS (port 5353)
- Both protocols are non-fatal and configurable via `ENABLE_DISCOVERY` env var

See [Device Discovery](docs/DEVICE_DISCOVERY.md) for full protocol specification.

### nginx (Reverse Proxy)

Routes incoming traffic to the appropriate backend service. HTTP requests are proxied to the Web App; WebSocket upgrade requests matching the `/ws/` path are proxied to the WS Server. Handles TLS termination in production deployments.

- Host port: 8888 (HTTP), 8443 (HTTPS)
- Internal port: 80

## Data Flows

### Device Registration (Pairing Code to JWT)

1. An admin creates a new device in the dashboard, which generates a 6-character pairing code with an expiration time.
2. The pairing code is stored in the `devices` table with status `pairing`.
3. The ESP32 device is configured with the pairing code and connects to the WS Server.
4. The WS Server validates the pairing code against the database.
5. On successful validation, the server generates a JWT token, stores it in the `device_tokens` table, and returns it to the device.
6. The device status is updated to `online`, and subsequent connections use the JWT token for authentication.

### Telemetry Pipeline

1. The ESP32 device collects sensor data (battery level, signal strength, CPU temperature, free memory, uptime).
2. The device sends a telemetry message over its WebSocket connection to the WS Server.
3. The WS Server writes the telemetry data to PostgreSQL via the `telemetry_records` table.
4. The WS Server publishes a telemetry event to Redis pub/sub.
5. The Web App (or any subscribed dashboard client) receives the event and updates the UI in real time.

### Command Flow

1. A user issues a command (e.g., `capture_photo`, `reboot`, `custom`) from the dashboard.
2. The Web App creates a `device_commands` record with status `pending`.
3. The Web App publishes the command to a Redis channel keyed by device ID.
4. The WS Server, subscribed to that channel, picks up the command.
5. The WS Server forwards the command over the WebSocket connection to the target device and updates the status to `sent`.
6. The device acknowledges receipt (status: `acknowledged`), executes the command, and reports the result (status: `completed` or `failed`).
7. Status transitions are persisted to the `device_commands` table with timestamps.

### Media Upload

1. A command (e.g., `capture_photo`) triggers the device to capture media.
2. The device requests a presigned upload URL from the WS Server.
3. The WS Server (or Web App API) generates a presigned PUT URL via MinIO.
4. The device uploads the file directly to MinIO using the presigned URL.
5. On completion, the device notifies the WS Server, which creates a `media_files` record with the S3 key, bucket, MIME type, file size, and dimensions.
6. The media file is then visible in the dashboard media gallery.

## Database Schema Overview

The database is managed with Drizzle ORM. All tables use UUID primary keys with `defaultRandom()`.

### Core Tables

| Table                  | Description                                                |
|------------------------|------------------------------------------------------------|
| `users`                | User accounts with email, password hash, name, role (user/admin) |
| `organizations`        | Multi-tenant organizations with plan, Stripe IDs, device/storage limits |
| `org_members`          | Join table linking users to organizations with roles (owner/admin/member/viewer) |
| `devices`              | Registered IoT devices with serial number, pairing code, status, firmware version |
| `device_tokens`        | JWT tokens issued to devices with expiration and revocation tracking |

### Telemetry and Location

| Table                  | Description                                                |
|------------------------|------------------------------------------------------------|
| `telemetry_records`    | Time-series device telemetry (battery, signal, CPU temp, memory, uptime) |
| `gps_records`          | GPS location data (lat, lon, altitude, speed, heading, accuracy, satellites) |

### Media and Scheduling

| Table                  | Description                                                |
|------------------------|------------------------------------------------------------|
| `media_files`          | Media metadata (type, filename, MIME, size, S3 key/bucket, dimensions) |
| `schedules`            | Named schedules with cron expressions and repeat types     |
| `schedule_items`       | Individual items within a schedule (command + payload + order) |
| `schedule_assignments` | Many-to-many link between schedules and devices            |
| `device_commands`      | Command queue with full lifecycle status tracking          |

### Authentication

| Table                  | Description                                                |
|------------------------|------------------------------------------------------------|
| `sessions`             | NextAuth session tokens                                    |
| `accounts`             | OAuth provider accounts (NextAuth adapter)                 |
| `verification_tokens`  | Email verification tokens                                  |

### Enums

- `user_role`: user, admin
- `org_plan`: free, pro, team, enterprise
- `org_member_role`: owner, admin, member, viewer
- `device_status`: online, offline, pairing, disabled
- `media_type`: image, video, audio, document
- `repeat_type`: once, daily, weekly, monthly, cron
- `command_type`: capture_photo, capture_video, record_audio, stream_video, reboot, update_firmware, custom
- `device_command_status`: pending, sent, acknowledged, completed, failed, timeout

## Authentication

### User Authentication

NodeFleet uses **NextAuth v5** (Auth.js) with the following configuration:

- **Credentials provider**: Email/password authentication with bcrypt-hashed passwords.
- **JWT session strategy**: Sessions are stored as signed JWT tokens (not database sessions), enabling stateless authentication with a 30-day expiry.
- **Drizzle adapter**: NextAuth uses the Drizzle ORM adapter for user/account/session persistence.
- **Edge-compatible middleware**: The auth configuration is split into two files:
  - `auth.config.ts` -- Minimal config safe for Edge Runtime (no Node.js-only imports). Used by `middleware.ts` to protect routes.
  - `auth.ts` -- Full config with the Credentials provider, database queries, and bcrypt. Runs in the Node.js runtime only.
- **JWT callbacks**: The JWT token is enriched with the user's organization ID and role on each request, enabling authorization checks without additional database queries.

### Device Authentication

Devices authenticate through a two-phase process:

1. **Pairing phase**: The device presents a 6-character pairing code (generated when the device is registered in the dashboard). The code has an expiration window.
2. **Token phase**: After successful pairing, the WS Server issues a JWT token stored in the `device_tokens` table. The device uses this token for all subsequent WebSocket connections. Tokens can be revoked by setting the `revokedAt` timestamp.

## Real-Time Communication

The real-time layer is built on two components:

### WebSocket Server

The WS Server (`ws-server/`) is a standalone Node.js/TypeScript process that:

- Accepts WebSocket connections from ESP32 devices on port 8080 (mapped to 8081 on the host).
- Validates device JWT tokens on connection.
- Processes incoming messages: telemetry reports, GPS updates, command acknowledgments, media upload notifications.
- Maintains an in-memory registry of connected devices for routing commands to the correct socket.
- Exposes a `/health` endpoint for Docker health checks.

### Redis Pub/Sub Bridge

Redis pub/sub serves as the communication bridge between the Web App and the WS Server:

- **Web App to device**: When a user sends a command, the Web App publishes to a Redis channel (e.g., `device:<deviceId>:commands`). The WS Server subscribes to these channels and forwards messages to the connected device.
- **Device to dashboard**: When a device sends telemetry or status updates, the WS Server publishes to Redis. Dashboard clients connected via Server-Sent Events or polling receive the updates.

This architecture decouples the Web App from the WS Server, allowing them to scale independently.

## Security

### Password Security

- User passwords are hashed with **bcrypt** (via `bcryptjs`) before storage.
- Passwords must be at least 8 characters (enforced by Zod schema validation at the auth layer).

### Token Security

- User sessions use signed JWT tokens with a configurable secret (`NEXTAUTH_SECRET`).
- Device tokens are stored in the database with explicit expiration and revocation timestamps.
- Tokens are validated on every WebSocket connection and API request.

### CSRF Protection

- NextAuth v5 includes built-in CSRF protection for all authentication endpoints.
- API routes validate session tokens on each request.

### Role-Based Access Control

Organization members are assigned one of four roles with escalating permissions:

| Role     | Capabilities                                              |
|----------|-----------------------------------------------------------|
| `viewer` | Read-only access to device data, telemetry, and media     |
| `member` | Viewer permissions plus the ability to send commands       |
| `admin`  | Member permissions plus device management and scheduling  |
| `owner`  | Full access including organization settings, billing, and member management |

Role information is embedded in the JWT token and checked in API route handlers and middleware.
