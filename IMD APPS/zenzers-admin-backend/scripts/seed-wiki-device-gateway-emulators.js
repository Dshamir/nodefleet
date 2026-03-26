#!/usr/bin/env node
/**
 * Seed Dev Wiki: Zenzer Device Emulator & RPi Gateway Emulator
 * Run: docker compose exec admin-backend node scripts/seed-wiki-device-gateway-emulators.js
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://mongodb:27017/dental';

const articles = [
  {
    section: 'guides',
    title: 'Zenzer Device Emulator & RPi Gateway Emulator — Continuous Vitals Simulation',
    slug: 'device-gateway-emulators',
    tags: ['emulator', 'device', 'gateway', 'ble', 'vitals', 'docker', 'websocket', 'rpi', 'simulation', 'biometrics', 'wearable'],
    author: 'system',
    status: 'published',
    content: `# Zenzer Device Emulator & RPi Gateway Emulator — Continuous Vitals Simulation

Two Docker containers that emulate the full biometric pipeline — from wearable wristband to backend storage — without physical hardware. Simulates a senior home with N residents wearing Zenzer biometric wristbands, collected by an RPi gateway.

**Added:** 2026-03-25
**Packages:** \`packages/zenzer-device-emulator/\`, \`packages/rpi-gateway-emulator/\`

---

## 1. Architecture

\`\`\`
┌─────────────────────┐     WebSocket      ┌─────────────────────┐
│  Zenzer Device       │◄──────────────────►│  RPi Gateway         │
│  Emulator            │  ws://...:8765     │  Emulator            │
│                      │                    │                      │
│  5 virtual devices   │                    │  Auth → JWT          │
│  BLE GATT over WS    │                    │  POST /gateway/vitals│
│  Vitals generation   │                    │  WS /ws/current-vitals│
│  Patient profiles    │                    │  Heartbeat           │
└─────────────────────┘                    └──────┬──────────────┘
                                                   │ HTTP + WS
                                           ┌───────▼───────────┐
                                           │  Medical API :3002 │
                                           │  Admin Backend:3001│
                                           └───────────────────┘
\`\`\`

**Data flow:** Device emulator generates realistic vitals → gateway emulator collects via WebSocket → gateway authenticates as \`Gateway\` role via Keycloak JWT → batches and POSTs to \`POST /gateway/vitals\` every 10s → also emits real-time via socket.io \`/ws/current-vitals\`.

---

## 2. Zenzer Device Emulator

**Location:** \`packages/zenzer-device-emulator/\`
**Port:** 8765 (mapped to 48765 on host)

### Purpose

Simulates N virtual Zenzer biometric wristbands, each producing realistic vital signs. Exposes a WebSocket server mimicking the BLE GATT interface, so the gateway emulator connects over WS instead of real BLE.

### WebSocket Endpoints

| Endpoint | Purpose |
|----------|---------|
| \`ws://...:8765/scan\` | Discovery — returns JSON array of advertising devices every 2s |
| \`ws://...:8765/device/{id}\` | Connect to device — streams vitals as BLE characteristic notifications + decoded JSON |
| \`http://...:8765/health\` | Docker health check |

### BLE Characteristic UUIDs

Real Zenzer device UUIDs used in the emulation:

| UUID | Vital | Encoding |
|------|-------|----------|
| \`00002a19-...\` | Battery | 1 byte: percent |
| \`00002a37-...\` | Heart Rate | 1-2 bytes: HR + optional RR |
| \`00002a1c-...\` | Temperature | 4 bytes: big-endian raw int / 100 = °C |
| \`00002a5f-...\` | SpO2 | 1 byte: percent |
| \`00002a46-...\` | Fall Alert | 1 byte: 0=none, 4=forward, 5=slip, 6=lateral, 7=vertical |
| \`00002a26-...\` | Firmware | String: "1.0.0" (read-only) |

### Patient Profiles

Each virtual device is assigned a patient profile with different baselines and abnormal probability:

| Profile | HR | SpO2 | Temp | RR | SBP/DBP | Abnormal% |
|---------|-----|------|------|----|---------|-----------|
| healthy-adult | 72 | 98 | 36.6 | 16 | 120/80 | 5% |
| elderly-stable | 68 | 96 | 36.4 | 18 | 135/85 | 10% |
| elderly-hypertensive | 78 | 95 | 36.5 | 19 | 155/95 | 15% |
| elderly-copd | 82 | 92 | 36.7 | 22 | 130/82 | 20% |
| post-surgical | 85 | 94 | 37.2 | 20 | 110/70 | 15% |

### Vitals Generation Algorithm

- **Circadian rhythm:** HR baseline shifts by time of day (night -10, morning +5, day 0, evening -5)
- **Gaussian noise:** HR sigma 3, SpO2 sigma 0.5, Temp sigma 0.1, RR sigma 1
- **Abnormal episodes:** Tachycardia (HR 120-150), Hypoxemia (SpO2 85-92), Fever (38.5-40.0), Tachypnea (RR 25-35)
- **Battery drain:** ~0.1%/minute with random jitter
- **Fall events:** 0.5% probability per reading cycle, types: Forward(4), Backward(5), Lateral(6), Vertical(7)

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| \`DEVICE_COUNT\` | 5 | Number of virtual devices |
| \`DEVICE_PREFIX\` | ZENZERS | Device name prefix |
| \`WS_PORT\` | 8765 | WebSocket server port |
| \`READING_INTERVAL_MS\` | 5000 | Vitals generation interval |

### File Structure

\`\`\`
packages/zenzer-device-emulator/
├── Dockerfile
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                # Entry — starts WS server + device manager
    ├── config.ts               # Environment variable parsing
    ├── types.ts                # Shared TypeScript interfaces
    ├── ws-server.ts            # WebSocket server: /scan, /device/:id, /health
    ├── device-manager.ts       # Creates N Device instances, assigns profiles
    ├── device.ts               # Single device: state machine, emits vitals on interval
    ├── vitals-generator.ts     # Realistic biometric generation with circadian rhythm
    ├── patient-profiles.ts     # 5 built-in profiles
    └── ble-protocol.ts         # BLE characteristic UUIDs + byte encoding
\`\`\`

---

## 3. RPi Gateway Emulator

**Location:** \`packages/rpi-gateway-emulator/\`

### Purpose

Emulates a Raspberry Pi gateway device in a senior home facility. On startup it provisions users (gateway + patients) in Keycloak and the Medical DB, authenticates as a Gateway role, connects to virtual devices, and continuously submits vitals to the backend.

### Startup Sequence

\`\`\`
1. Wait for medical-api + admin-backend + device-emulator (retry loop)
2. Seed:
   a. Ensure Keycloak realm roles exist (Gateway, Patient)
   b. Create gateway user + N patient users in Keycloak
   c. Assign realm roles to each user (required for JWT realm_access.roles)
   d. Create users in Medical DB via POST /admin/users (X-Internal-Auth, keycloakUserId as PK)
   e. Store password hashes in MongoDB (mobile auth)
3. Auth: Sign in as gateway user → JWT token (auto-refresh)
4. Connect: WS client to each device in the device emulator
5. Loop:
   a. Collect vitals from device WS connections (values rounded to integers)
   b. Batch and POST /gateway/vitals every 10s
   c. Emit real-time via socket.io /ws/current-vitals
   d. Send heartbeat every 60s
\`\`\`

### Seed Users (Auto-Created)

| User | Email | Role | Password |
|------|-------|------|----------|
| Gateway | \`gateway@zenzers-emulator.local\` | Gateway | \`GatewayEmul8!\` |
| Patient 0 | \`patient0@zenzers-emulator.local\` | Patient | \`Patient0Emul8!\` |
| Patient 1 | \`patient1@zenzers-emulator.local\` | Patient | \`Patient1Emul8!\` |
| Patient 2 | \`patient2@zenzers-emulator.local\` | Patient | \`Patient2Emul8!\` |
| Patient 3 | \`patient3@zenzers-emulator.local\` | Patient | \`Patient3Emul8!\` |
| Patient 4 | \`patient4@zenzers-emulator.local\` | Patient | \`Patient4Emul8!\` |

All created in **triple store:** Keycloak (SSO + realm roles), Medical DB (PostgreSQL via Medical API admin endpoint with keycloakUserId as PK), MongoDB (mobile password hash).

> **Important:** Users are created in the Medical API directly (\`POST /admin/users\` with \`X-Internal-Auth\`), NOT via the admin-backend. The \`keycloakUserId\` is passed so the Medical DB user ID matches the Keycloak \`sub\` JWT claim — this is required for \`AuthedUserService\` user lookup. Realm roles (not just attributes) must be assigned in Keycloak for JWT \`realm_access.roles\` to include the role.

### Gateway Vitals Submission Format

Matches the real \`POST /gateway/vitals\` endpoint exactly (\`PostVitalsByGatewayView\`):

\`\`\`json
{
  "vitals": [
    {
      "userId": "<patient-keycloak-uuid>",
      "vitals": [
        {
          "timestamp": 1711375200,
          "hr": 75,
          "spo2": 98,
          "temp": 36.8,
          "rr": 16,
          "sbp": 120,
          "dbp": 80,
          "fall": false,
          "fallType": null
        }
      ]
    }
  ]
}
\`\`\`

### WebSocket Real-Time Publishing

Emits to Medical API namespace \`/ws/current-vitals\`, event \`messageToServer\`:

\`\`\`json
{ "patientUserId": "<uuid>", "hr": 75, "temp": 36.8, "spo2": 98, ... }
\`\`\`

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| \`DEVICE_EMULATOR_URL\` | \`ws://zenzer-device-emulator:8765\` | Device emulator WS URL |
| \`MEDICAL_API_URL\` | \`http://medical-api:3002\` | Medical API base URL |
| \`ADMIN_BACKEND_URL\` | \`http://admin-backend:3001\` | Admin backend base URL |
| \`INTERNAL_PASSKEY\` | — | Internal services passkey |
| \`GATEWAY_EMAIL\` | \`gateway@zenzers-emulator.local\` | Gateway user email |
| \`GATEWAY_PASSWORD\` | \`GatewayEmul8!\` | Gateway user password |
| \`PATIENT_COUNT\` | 5 | Number of patients to emulate |
| \`SUBMIT_INTERVAL_MS\` | 10000 | Vitals batch submission interval |
| \`HEARTBEAT_INTERVAL_MS\` | 60000 | Gateway heartbeat interval |
| \`MONGO_URL\` | — | MongoDB connection string |
| \`KEYCLOAK_URL\` | \`http://keycloak:8080/auth\` | Keycloak base URL |

### File Structure

\`\`\`
packages/rpi-gateway-emulator/
├── Dockerfile
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                # Entry — orchestrates startup + main loop
    ├── config.ts               # Environment variable parsing
    ├── types.ts                # Shared TypeScript interfaces
    ├── seed.ts                 # Creates gateway + patient users (Keycloak + DB + Mongo)
    ├── auth.ts                 # JWT authentication with auto-refresh
    ├── device-connector.ts     # WS client to zenzer-device-emulator
    ├── vitals-collector.ts     # Buffers incoming vitals from device connections
    ├── patient-mapper.ts       # Maps device index → patient UUID
    ├── vitals-submitter.ts     # Batches and POSTs to /gateway/vitals
    ├── websocket-publisher.ts  # socket.io client to /ws/current-vitals
    └── heartbeat.ts            # Periodic heartbeat POST
\`\`\`

---

## 4. Docker Compose Integration

Both services are defined in the root \`docker-compose.yml\`:

\`\`\`yaml
zenzer-device-emulator:
  build: ./packages/zenzer-device-emulator
  ports: ["48765:8765"]
  healthcheck: wget -qO- http://localhost:8765/health

rpi-gateway-emulator:
  build: ./packages/rpi-gateway-emulator
  depends_on:
    zenzer-device-emulator: { condition: service_healthy }
    medical-api: { condition: service_started }
    mongodb: { condition: service_healthy }
\`\`\`

### Starting the Emulators

\`\`\`bash
# Build and start emulators only
docker compose up -d --build zenzer-device-emulator rpi-gateway-emulator

# Or start everything
docker compose up -d --build
\`\`\`

### Data Volume

5 devices × 1 reading/5s = 60 vitals/min → 3,600/hour → 86,400/day.
Gateway batches every 10s = 6 POSTs/min with ~10 vitals each.

---

## 5. Verification

| Check | Command | Expected |
|-------|---------|----------|
| Device emulator WS | \`wscat -c ws://localhost:48765/scan\` | JSON array of 5 devices |
| Device vitals stream | \`wscat -c ws://localhost:48765/device/0\` | Periodic vital notifications |
| Gateway seed logs | \`docker compose logs rpi-gateway-emulator\` | "Created gateway user", "Created 5 patients" |
| Vitals in PostgreSQL | SQL: \`SELECT count(*) FROM vital WHERE timestamp > extract(epoch from now()) - 60\` | Growing count |
| Admin console | Browser → Vitals Monitor | 5+ patient cards with live vitals |
| Health check | \`curl http://localhost:48765/health\` | \`{"status":"ok","devices":5}\` |

---

## 6. Relationship to Existing Components

| Component | Interaction |
|-----------|-------------|
| **Medical API** | Gateway submits vitals via \`POST /gateway/vitals\` (same as real RPi gateway) |
| **Medical API WS** | Gateway publishes real-time via \`/ws/current-vitals\` \`messageToServer\` event |
| **Keycloak** | Gateway + patients created in realm \`zenzers\` with realm roles (Gateway, Patient) assigned via Admin REST API |
| **Admin Console** | Vitals Monitor page shows emulated patients with live-updating vitals |
| **BLE Protocol** | Device emulator uses real Zenzer BLE characteristic UUIDs and byte encoding |
| **Mobile App** | Chart.tsx merges realtime WebSocket points with history data; poll interval reduced to 10s |
| **Mobile App Hook** | \`use-realtime-chart-data.ts\` subscribes to \`messageToClient\` for live chart updates |

---

*Last updated: 2026-03-26*
`,
  },
  {
    section: 'infrastructure',
    title: 'BLE-over-WebSocket Protocol — Device Emulator Communication',
    slug: 'ble-over-websocket-protocol',
    tags: ['ble', 'websocket', 'emulator', 'protocol', 'docker', 'device', 'gateway'],
    author: 'system',
    status: 'published',
    content: `# BLE-over-WebSocket Protocol — Device Emulator Communication

Since real Bluetooth Low Energy is impossible inside Docker containers, the Zenzer Device Emulator exposes a WebSocket server that mirrors the BLE GATT interface. The RPi Gateway Emulator connects as a WS client instead of using a BLE adapter.

**Added:** 2026-03-25

---

## 1. Protocol Mapping

| Real BLE Operation | Emulated WS Equivalent |
|-------------------|----------------------|
| BLE scan for peripherals | \`ws://...:8765/scan\` — server pushes device list every 2s |
| \`connectToDevice(id)\` | \`ws://...:8765/device/{id}\` — WS connection triggers CONNECTED state |
| BLE disconnect | WS close event triggers ADVERTISING state |
| Characteristic notification | Server pushes JSON: \`{ characteristic, data }\` |
| Characteristic write | Client sends JSON: \`{ action: "write", characteristic, data }\` |

## 2. Discovery Protocol

**Endpoint:** \`GET ws://zenzer-device-emulator:8765/scan\`

On connection, server pushes updated device list every 2 seconds:

\`\`\`json
[
  { "id": 0, "name": "ZENZERS-000", "rssi": -55 },
  { "id": 1, "name": "ZENZERS-001", "rssi": -67 },
  { "id": 2, "name": "ZENZERS-002", "rssi": -72 }
]
\`\`\`

RSSI is randomized between -50 and -80 dBm per scan cycle.

## 3. Device Connection Protocol

**Endpoint:** \`GET ws://zenzer-device-emulator:8765/device/{deviceId}\`

On connection:
1. Device transitions to CONNECTED state
2. Server starts pushing two types of messages per reading interval:
   - **BLE notification** (mimics real BLE): \`{ characteristic: "uuid", data: [bytes] }\`
   - **Decoded vitals** (convenience): \`{ type: "vitals", hr, spo2, temp, rr, sbp, dbp, battery, fall, fallType, timestamp }\`

The gateway emulator uses the decoded vitals event for simplicity, but the BLE notifications are available for testing mobile handshake logic.

## 4. Write Commands

Client can send write commands (for mobile handshake emulation):

\`\`\`json
{ "action": "write", "characteristic": "00002a26-...", "data": [0x80, 0x01, 0x80] }
\`\`\`

The device emulator acknowledges but does not require the handshake — the gateway connects directly without encryption.

---

*Last updated: 2026-03-26*
`,
  },
];

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const col = db.collection('devWikiPages');

    for (const article of articles) {
      const now = new Date();
      const result = await col.updateOne(
        { slug: article.slug },
        {
          $set: {
            ...article,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true },
      );

      if (result.upsertedCount) {
        console.log(`✓ Created: "${article.title}"`);
      } else {
        console.log(`✓ Updated: "${article.title}"`);
      }
    }

    console.log(`\nDone — ${articles.length} wiki articles seeded.`);
  } catch (err) {
    console.error('✗ Seed failed:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
