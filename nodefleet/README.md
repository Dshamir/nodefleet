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
# Edit .env: set DEVICE_TOKEN_SECRET to match NEXTAUTH_SECRET
docker compose up -d
# Visit http://localhost:50080  (or https://nodefleet.ngrok.dev if ngrok is configured)
```

After the services are running:

1. Log in with the default credentials (see below) or register a new account.
2. **Create a device** in the dashboard -- enter a name, hardware model, and serial number. You will receive a 6-character pairing code valid for 24 hours.
3. **Flash the ESP32 firmware** -- see [firmware/esp32_agent/README.md](./firmware/esp32_agent/README.md). Set WiFi credentials, server host, and pairing code in `config.h`. Flash via PlatformIO or Arduino IDE.
4. The ESP32 pairs automatically on first boot, connects via WebSocket, and begins streaming heartbeat + GPS telemetry to the dashboard.

## Port Mappings

| Service        | Host Port | Container Port | Description              |
|----------------|-----------|----------------|--------------------------|
| Nginx          | 50080     | 80             | Main entry point (HTTP)  |
| Nginx          | 50443     | 443            | Main entry point (HTTPS) |
| Web (Next.js)  | 50300     | 3000           | Direct web access        |
| WebSocket      | 50081     | 8080           | Real-time device comms   |
| PostgreSQL     | 50432     | 5432           | Database                 |
| Redis          | 50379     | 6379           | Cache & pub/sub          |
| MinIO API      | 50900     | 9000           | Object storage           |
| MinIO Console  | 50901     | 9001           | Storage UI               |
| UDP Discovery  | 50555     | 5555 (UDP)     | Device auto-discovery    |
| ngrok          | 50040     | 4040           | Tunnel dashboard         |

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

## Verified Hardware

The firmware has been tested and verified with the **Waveshare ESP32-S3-SIM7670G-4G** board. See [HARDWARE_ALTERNATIVES.md](./HARDWARE_ALTERNATIVES.md) for compatible boards and alternatives.

| Feature | Status | Notes |
|---------|--------|-------|
| WiFi + WebSocket | Working | Auto-reconnect with exponential backoff |
| LTE Cat-1 (SIM7670G) | Working | GPIO17/18 UART, 5-retry init, AT+CEREG for LTE |
| GPS/GNSS | Working | AT+CGPSINFO, NMEA→decimal conversion, 60s updates |
| Heartbeat telemetry | Working | 30s interval → PostgreSQL via ws-server |
| Signal strength | Working | CSQ→dBm conversion (-113 + 2*rssi) |
| Remote commands | Working | REST API → Redis queue → ws-server → device → ack → DB |
| Camera (OV2640) | Init OK, capture fails | I2C/SCCB init succeeds but `esp_camera_fb_get()` returns NULL. DVP data path issue — DIP switch or ribbon cable data pins. See [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) |
| Photo upload pipeline | Coded + tested | Presigned URL upload to MinIO via `/api/devices/upload`. Works when camera captures succeed |
| Battery monitoring | Not working | GPIO0 invalid on ESP32-S3. Board has MAX17048 I2C fuel gauge (0x36) — not yet integrated |
| Audio recording | Not implemented | Requires external I2S MEMS microphone (INMP441) |
| OTA firmware update | Not implemented | Command handler stub exists, needs httpUpdate |

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) -- System architecture, data flows, and service descriptions
- [docs/API.md](./docs/API.md) -- REST and WebSocket API reference
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) -- Production deployment guide
- [docs/USER_GUIDE.md](./docs/USER_GUIDE.md) -- End-user documentation
- [docs/WEBSOCKET_PROTOCOL.md](./docs/WEBSOCKET_PROTOCOL.md) -- WebSocket message specification
- [docs/DEVICE_DISCOVERY.md](./docs/DEVICE_DISCOVERY.md) -- ESP32 auto-discovery protocols (UDP + mDNS)
- [firmware/esp32_agent/README.md](./firmware/esp32_agent/README.md) -- ESP32 firmware setup and flashing
- [HARDWARE_ALTERNATIVES.md](./HARDWARE_ALTERNATIVES.md) -- Compatible boards and buying guide
- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) -- Known issues, gaps, and recommendations

## License

This project is licensed under the [MIT License](./LICENSE).
