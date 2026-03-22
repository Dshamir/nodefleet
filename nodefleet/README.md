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
- **Task scheduling** -- Create recurring or one-time schedules with cron expressions, assign them to devices, and automate command execution.
- **Multi-tenant organizations** -- Organizations with role-based access control (owner, admin, member, viewer) and tiered plans (free, pro, team, enterprise).
- **Stripe billing** -- Subscription management with per-organization device and storage limits.
- **JWT device authentication** -- Devices authenticate via a pairing code flow that issues JWT tokens for persistent, secure WebSocket connections.
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
