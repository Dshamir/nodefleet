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
├── firmware/esp32_agent/    # ESP32-S3 SIM7670G firmware (C++)
│   ├── esp32_agent.ino      # Main sketch (12 commands, OTA, power profiles)
│   ├── config.h             # Pin mapping, WiFi, server config
│   ├── modem.cpp/h          # SIM7670G LTE + GPS driver
│   ├── camera.cpp/h         # OV2640 DVP camera driver
│   ├── battery.cpp/h        # MAX17048 I2C fuel gauge
│   ├── storage.cpp/h        # NVS + SD card storage
│   ├── websocket_client.cpp/h # WebSocket with auto-reconnect
│   └── platformio.ini       # PlatformIO build config
├── web/                     # Next.js 14 dashboard + API (38 routes)
│   └── src/
│       ├── app/(dashboard)/ # 8 pages: devices, audit, content, map, schedules, settings
│       ├── app/api/         # REST API (devices, fleets, audit, webhooks, mqtt, etc.)
│       ├── components/      # UI components (charts, toggles, diagnostics)
│       └── lib/             # Auth, DB schema (21 tables), audit, webhooks, S3
├── ws-server/               # WebSocket server (Node.js/TypeScript)
│   └── src/index.ts         # Device/dashboard connections, Redis pub/sub, PostgreSQL writes
├── nginx/                   # Reverse proxy (HTTP/WSS routing)
├── mqtt/                    # Mosquitto MQTT broker config
├── tools/                   # Device simulator
├── .github/workflows/       # CI pipeline (typecheck + firmware compile)
├── docker-compose.yml       # 8 services (postgres, redis, minio, mqtt, web, ws, nginx, ngrok)
├── nodefleet.sh             # Orchestration script (15 commands)
├── recommendation-report.md # 15-dimension gap analysis scorecard
└── KNOWN_ISSUES.md          # Issues, fixes, and Monday pending items
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
| WiFi + WebSocket | Working | Auto-reconnect, exponential backoff, JWT token rotation (30-day) |
| LTE Cat-1 (SIM7670G) | Working | GPIO17/18 UART, 5-retry init, AT+CEREG for LTE |
| GPS/GNSS | Working | AT+CGPSINFO, NMEA→decimal, 60s updates, idle mode disables |
| Heartbeat telemetry | Working | 30s interval → PostgreSQL, recharts visualization |
| Signal strength | Working | CSQ→dBm conversion (-113 + 2*rssi) |
| Battery (MAX17048) | Working | I2C fuel gauge (0x36), SOC% in heartbeat |
| Remote commands | Working | 12 commands, fleet broadcast, 5-min timeout, audit trail |
| OTA firmware update | Working | HTTPUpdate + presigned MinIO URLs |
| MQTT broker | Running | Mosquitto 2 in docker-compose (port 51883 + WS 59001) |
| Webhooks | Working | HMAC-SHA256 signed, 5 event types, CRUD API |
| Audit trail | Working | Immutable log, 19 event types, filterable viewer |
| Device diagnostics | Working | Health scoring (0-100), gauges, error log, recommendations |
| Feature toggles | Working | Camera/audio/GPS/LTE/MQTT on/off per device |
| Power management | Working | Active/idle/sleep/deep_sleep modes |
| Telemetry aggregation | Working | date_trunc + GROUP BY, configurable range/interval |
| Camera (OV2640) | Pending Monday | I2C init OK, DVP data path needs DIP switch check |
| Audio (INMP441) | Pending Monday | Firmware coded, hardware arriving Monday |
| PSRAM (8MB OPI) | Pending Monday | Need Arduino IDE sdkconfig extraction |

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
- [recommendation-report.md](./recommendation-report.md) -- 15-dimension gap analysis scorecard

## API Endpoints (38 routes)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/devices` | GET/POST | Device list + create |
| `/api/devices/pair` | POST | Device pairing (rate limited: 10/hr/IP) |
| `/api/devices/upload` | POST | Device media upload (presigned URL) |
| `/api/devices/heartbeat` | POST | HTTP heartbeat fallback |
| `/api/devices/[id]` | GET/PUT/DELETE | Device CRUD + soft decommission |
| `/api/devices/[id]/command` | GET/POST | Command dispatch + history |
| `/api/devices/[id]/telemetry` | GET | Telemetry with range filter (1h/6h/24h/7d/30d) |
| `/api/devices/[id]/telemetry/aggregate` | GET | Time-bucketed min/max/avg aggregation |
| `/api/devices/[id]/gps` | GET | GPS history |
| `/api/devices/[id]/settings` | GET/PUT | Feature toggles + push to device |
| `/api/devices/[id]/health` | GET | Health score (0-100, 5 weighted factors) |
| `/api/fleets` | GET/POST | Fleet management |
| `/api/fleets/[id]` | GET/PUT/DELETE | Fleet CRUD |
| `/api/fleets/[id]/command` | POST | Fleet-wide command broadcast |
| `/api/audit` | GET | Immutable audit trail (filter by range/action/device) |
| `/api/webhooks` | GET/POST | Webhook CRUD (HMAC-SHA256 signed) |
| `/api/webhooks/stripe` | POST | Stripe webhook handler |
| `/api/mqtt/status` | GET | MQTT broker status + config |
| `/api/schedules` | GET/POST | Schedule management |
| `/api/schedules/[id]` | GET/PUT/DELETE | Schedule CRUD |
| `/api/content` | GET | Media library |
| `/api/content/[id]` | GET/DELETE | Media file operations |
| `/api/content/upload` | POST | Upload presigned URL |
| `/api/dashboard/stats` | GET | Dashboard statistics |
| `/api/discovery` | GET | UDP/mDNS discovery info |
| `/api/org` | GET/PUT | Organization settings |
| `/api/keys` | GET/POST | API key management |
| `/api/keys/[id]` | DELETE | Revoke API key |
| `/api/register` | POST | User registration |
| `/api/auth/[...nextauth]` | ALL | Authentication (NextAuth v5) |
| `/api/auth/profile` | GET/PUT | User profile |
| `/api/auth/change-password` | POST | Password change |
| `/api/auth/delete-account` | POST | Account deletion |
| `/api/health` | GET | Health check |

## Orchestration

All services managed via `./nodefleet.sh`:

```bash
./nodefleet.sh                  # Full build + start + 9-stage health check
./nodefleet.sh --status         # Show all 8 services + URLs
./nodefleet.sh health           # Probe all endpoints
./nodefleet.sh rebuild web      # Hot-rebuild specific service
./nodefleet.sh migrate          # Create/verify all DB tables (idempotent)
./nodefleet.sh simulate --pair CODE  # Device simulator (no hardware)
./nodefleet.sh compile          # Compile firmware only
./nodefleet.sh flash            # Compile + flash ESP32
./nodefleet.sh mqtt             # MQTT broker status + test
./nodefleet.sh db "SQL"         # Run SQL query
./nodefleet.sh logs ws-server   # Tail service logs
./nodefleet.sh down             # Stop all (volumes preserved)
```

## License

This project is licensed under the [MIT License](./LICENSE).
