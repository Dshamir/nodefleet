# NodeFleet - IoT Device Fleet Management Platform

Enterprise-grade fleet management for ESP32 IoT devices with real-time monitoring, GPS tracking, media capture, and remote command execution. NodeFleet provides a complete solution for registering, monitoring, and controlling distributed IoT device fleets through a modern web dashboard backed by WebSocket-based real-time communication.

## Tech Stack

![Next.js 14](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![Redis](https://img.shields.io/badge/Redis-7-red?logo=redis)
![MinIO](https://img.shields.io/badge/MinIO-latest-C72E49?logo=minio)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)
![WebSocket](https://img.shields.io/badge/WebSocket-RFC6455-010101)
![Leaflet](https://img.shields.io/badge/Leaflet-Maps-199900?logo=leaflet)

## Architecture Overview

NodeFleet runs as a set of 6 Docker Compose services:

| Service      | Role                                      |
|--------------|-------------------------------------------|
| **postgres** | Primary relational database (PostgreSQL 16)|
| **redis**    | Cache, pub/sub message broker (Redis 7)   |
| **minio**    | S3-compatible object storage for media     |
| **web**      | Next.js 14 application server (dashboard + API) |
| **ws-server**| WebSocket server for real-time device communication |
| **nginx**    | Reverse proxy and TLS termination          |

For a detailed breakdown of the architecture, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Quick Start

```bash
git clone <repo>
cd nodefleet
cp .env.example .env
docker compose up -d
# Visit http://localhost:8888
```

After the services are running:

1. Log in with the default credentials (see below) or register a new account.
2. **Create a device** in the dashboard -- enter a name, hardware model, and serial number. You will receive a 6-character pairing code valid for 24 hours.
3. **Pair your ESP32** by calling `POST /api/devices/pair` with `{"pairingCode":"XXXXXX"}`. The response contains a JWT `token` and `wsUrl`.
4. The ESP32 uses the token to connect via WebSocket (`ws://<server>:8081/device?token=...`). The device appears online in the dashboard.

## Port Mappings

| Service        | Host Port | Description              |
|----------------|-----------|--------------------------|
| Nginx          | 8888      | Main entry point         |
| Web (Next.js)  | 3002      | Direct web access        |
| WebSocket      | 8081      | Real-time device comms   |
| PostgreSQL     | 5433      | Database                 |
| Redis          | 6381      | Cache & pub/sub          |
| MinIO API      | 9000      | Object storage           |
| MinIO Console  | 9001      | Storage UI               |
| UDP Discovery  | 5555 (UDP) | Device auto-discovery |

## Default Test Credentials

| Field    | Value                |
|----------|----------------------|
| Email    | test@nodefleet.io    |
| Password | test1234             |

## Project Structure

```
nodefleet/
├── firmware/              # Device firmware
│   └── esp32_agent/       # ESP32 agent source code
├── nginx/                 # Nginx reverse proxy configuration
│   ├── Dockerfile
│   └── nginx.conf
├── web/                   # Next.js 14 web application
│   └── src/
│       ├── app/           # App Router pages and API routes
│       ├── components/    # React components
│       ├── lib/           # Shared libraries (auth, db, utils)
│       └── middleware.ts  # Edge-compatible auth middleware
├── ws-server/             # WebSocket server (Node.js/TypeScript)
│   └── src/
├── docker-compose.yml     # Service orchestration
├── .env.example           # Environment variable template
├── ARCHITECTURE.md        # System architecture documentation
└── README.md              # This file
```

## Key Features

- **Real-time monitoring** -- Live device status, telemetry (battery, signal, CPU temp, memory), and heartbeat tracking via WebSocket connections.
- **GPS tracking with Leaflet maps** -- Interactive map views showing device locations, routes, speed, altitude, and satellite count.
- **Media capture** -- Remote photo, video, and audio capture from ESP32 devices with MinIO-backed storage and presigned URL uploads.
- **Remote commands** -- Send commands to devices (reboot, firmware update, capture, custom) with full lifecycle tracking (pending, sent, acknowledged, completed, failed, timeout).
- **Fleet management** -- Group devices by location into fleets (e.g., HQ Office, Warehouse West, Field Ops). Filter and manage devices per fleet.
- **Full CRUD on all resources** -- Create, read, update, and delete devices, content, and schedules. Device creation returns a pairing code. Content uploads via presigned URLs. Schedules support conditions, active/inactive toggling, and device assignment.
- **Inline media viewer** -- View images, video, and audio directly in the content library via S3 presigned URLs. Click-to-expand modal for full-size viewing. No downloads needed. Filter content with a 3-tier hierarchy: device, media type, and filename search. Each content card shows the source device name.
- **Task scheduling** -- Create recurring or one-time schedules with cron expressions and conditional execution (e.g., battery below threshold, temperature above limit). Assign them to devices and automate command execution.
- **Multi-tenant organizations** -- Organizations with role-based access control (owner, admin, member, viewer) and tiered plans (free, pro, team, enterprise).
- **Settings page** -- Fully functional settings with 6 sections: Profile editing, Organization management (readable org ID in NF-PREFIX-HASH format, stats cards, editable org name), Change Password, API Keys (generate, list, revoke), Billing link, and Danger Zone (account deletion with password confirmation).
- **API key management** -- Generate SHA-256 hashed API keys (format: `nf_<8char>_<32char>`), shown once with copy button. List keys (prefix only) and revoke them. Keys are scoped to the user and organization.
- **Stripe billing** -- Subscription management with per-organization device and storage limits.
- **JWT device authentication** -- Devices authenticate via a pairing code flow that issues JWT tokens for persistent, secure WebSocket connections.
- **Device detail page** -- Per-device view with real telemetry, GPS, and command history across 4 tabs (Overview, Telemetry, GPS, Commands). Send commands directly from the detail page.
- **Dashboard stats API** -- Real-time dashboard statistics (total devices, online count, media files, storage used, activity) fetched from the database. Zero hardcoded data across all pages.
- **Device Auto-Discovery** - UDP broadcast and mDNS for zero-config LAN setup

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) -- System architecture, data flows, and service descriptions
- [docs/API.md](./docs/API.md) -- REST and WebSocket API reference
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) -- Production deployment guide
- [docs/USER_GUIDE.md](./docs/USER_GUIDE.md) -- End-user documentation
- [firmware/esp32_agent/README.md](./firmware/esp32_agent/README.md) -- ESP32 firmware setup and flashing instructions
- [Device Discovery](docs/DEVICE_DISCOVERY.md) - ESP32 auto-discovery protocols (UDP + mDNS)

## License

This project is licensed under the [MIT License](./LICENSE).
