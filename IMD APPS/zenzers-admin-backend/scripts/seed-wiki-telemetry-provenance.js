#!/usr/bin/env node
/**
 * Seed Dev Wiki: Telemetry Provenance — Device Identity, Pairing & Chain of Custody
 * Run: docker compose exec admin-backend node scripts/seed-wiki-telemetry-provenance.js
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://mongodb:27017/dental';

const articles = [
  {
    section: 'guides',
    title: 'Telemetry Provenance — Device Identity, Pairing & Chain of Custody',
    slug: 'telemetry-provenance',
    tags: ['provenance', 'device', 'pairing', 'chain-of-custody', 'vitals', 'ble', 'gateway', 'medical', 'emulator'],
    author: 'system',
    status: 'published',
    content: `# Telemetry Provenance — Device Identity, Pairing & Chain of Custody

Every vital sign reading now carries full provenance: **which device** captured it, **which relay** (phone or gateway) forwarded it, and **which user** it's bound to. This establishes an auditable chain of custody from sensor to database.

**Added:** March 26, 2026
**Commit:** \`ec3d588\`

---

## 1. Architecture Overview

\`\`\`
Device (ZENZERS-V1)          Relay                    Server
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ Serial:      │     │ Phone (BLE)     │     │ Medical API      │
│ ZNZ-2026-A001│────▶│ relayType=phone │────▶│ vital table:     │
│ MAC: AA:BB:  │     │ relayId=UUID    │     │  device_serial   │
│   CC:DD:EE:00│     └─────────────────┘     │  relay_type      │
│ Model:       │     ┌─────────────────┐     │  relay_id        │
│ ZENZERS-V1   │────▶│ Gateway (RPi)   │────▶│                  │
│ FW: 1.0.0    │     │ relayType=gw    │     │ device_binding   │
└──────────────┘     │ relayId=userId  │     │  table           │
                     └─────────────────┘     └──────────────────┘
\`\`\`

---

## 2. Device Identity (Emulator)

Each emulated device has a unique identity assigned at creation:

| Field | Format | Example |
|-------|--------|---------|
| Serial Number | \`{prefix}-{suffix}\` | \`ZNZ-2026-A001\` |
| MAC Address | \`AA:BB:CC:DD:EE:{id}\` | \`AA:BB:CC:DD:EE:00\` |
| Model Number | Fixed | \`ZENZERS-V1\` |
| Firmware | SemVer | \`1.0.0\` |

### GATT Device Information Service (0x180A)

| Characteristic | UUID | Value |
|---------------|------|-------|
| Model Number | \`0x2A24\` | \`ZENZERS-V1\` |
| Serial Number | \`0x2A25\` | \`ZNZ-2026-A001\` |
| Firmware Rev | \`0x2A26\` | \`1.0.0\` |
| Hardware Rev | \`0x2A27\` | \`1.0\` |
| Manufacturer | \`0x2A29\` | \`ZENZERS Medical\` |

### WebSocket Protocol

On device connection (\`ws://emulator:8765/device/{id}\`), the **first message** is always:

\`\`\`json
{
  "type": "device-info",
  "serialNumber": "ZNZ-2026-A001",
  "macAddress": "AA:BB:CC:DD:EE:00",
  "firmwareVersion": "1.0.0",
  "modelNumber": "ZENZERS-V1"
}
\`\`\`

### Device State Machine

\`\`\`
ADVERTISING ──connect()──▶ CONNECTED ──pair(userId)──▶ PAIRED
     ▲                         │                          │
     └────disconnect()─────────┘◄────────unpair()─────────┘
\`\`\`

---

## 3. Database Schema

### Provenance columns on \`vital\` table

\`\`\`sql
ALTER TABLE vital ADD COLUMN device_serial VARCHAR(20) NULL;
ALTER TABLE vital ADD COLUMN relay_type VARCHAR(10) NULL;   -- 'phone' | 'gateway'
ALTER TABLE vital ADD COLUMN relay_id VARCHAR(255) NULL;    -- phone UUID or gateway userId
\`\`\`

All **nullable** for backward compatibility — existing vitals get NULL (unknown provenance).

### \`device_binding\` table

\`\`\`sql
CREATE TABLE device_binding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_serial VARCHAR(20) NOT NULL,
  user_id UUID NOT NULL REFERENCES "user"(id),
  relay_type VARCHAR(10) NOT NULL,
  relay_id VARCHAR(255) NOT NULL,
  bound_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unbound_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_active_binding UNIQUE (device_serial, unbound_at)
);
\`\`\`

The unique constraint ensures only **one active binding** per device serial (where \`unbound_at IS NULL\`).

---

## 4. Device Binding API

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | \`/device-binding\` | JWT (any role) | Bind device to authenticated user |
| DELETE | \`/device-binding/:serial\` | JWT (any role) | Unbind device (sets \`unbound_at\`) |
| GET | \`/device-binding\` | JWT (any role) | List user's active bindings |
| GET | \`/device-binding/:serial\` | JWT or Internal | Check binding status |

### Bind Request

\`\`\`json
{
  "deviceSerial": "ZNZ-2026-A001",
  "relayType": "gateway",
  "relayId": "gateway@zenzers-emulator.local"
}
\`\`\`

Validation: rejects if device is already bound to a **different** user. Idempotent if already bound to the same user.

---

## 5. Gateway Provenance Flow

1. Gateway connects to device emulator → receives \`device-info\` message
2. Stores serial per device: \`deviceSerials.set(deviceId, serialNumber)\`
3. Sends \`{action: 'pair', userId}\` → receives \`{type: 'pair-ack'}\`
4. Calls \`POST /device-binding\` to register binding server-side
5. Every vitals batch includes:
   - Per-vital: \`deviceSerial\`
   - Per-user: \`relayType: 'gateway'\`, \`relayId: gatewayUserId\`

---

## 6. Mobile App Provenance Flow

1. **Simulation mode:** Parses \`device-info\` WS message → dispatches \`setDeviceSerial\` to Redux
2. **Real BLE:** Reads Device Info Service (0x180A) Serial Number characteristic (0x2A25) → Redux
3. Every 30s vitals POST includes: \`deviceSerial\`, \`relayType: 'phone'\`

---

## 7. Admin Console Display

### Vitals Monitor Cards (\`/admin/vitals-monitor\`)

Each patient card shows provenance badges below the vitals grid:
- **Blue badge**: device serial (e.g., \`ZNZ-2026-A001\`)
- **Purple badge**: relay type with icon (server for gateway, phone for mobile)
- **Grey italic**: "Unknown provenance" for legacy vitals with NULL device_serial

### Telemetry Log (\`/admin/vitals-monitor/:patientId\`)

Two new columns at the end of the DataTable:
- **Device**: serial number in blue monospace badge
- **Relay**: type with icon

### Device Bindings Page (\`/admin/device-bindings\`)

Dedicated management page showing:
- Active device-to-patient bindings
- Relay type and ID
- Bound timestamp
- Force-unbind action button

---

## 8. Uploadable Biometric Datasets

The device emulator supports custom biometric data playback:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| \`/device/{id}/dataset\` | POST | Upload JSON array of VitalReading |
| \`/device/{id}/dataset\` | DELETE | Revert to synthetic generation |
| \`/device/{id}/dataset/status\` | GET | Check mode (synthetic vs playback) |

When a dataset is loaded, the device plays readings sequentially, cycling when exhausted. Each reading gets a fresh timestamp but retains the uploaded vital values.

---

## 9. Verification Queries

\`\`\`sql
-- Check provenance on recent vitals
SELECT device_serial, relay_type, relay_id, timestamp
FROM vital WHERE device_serial IS NOT NULL
ORDER BY timestamp DESC LIMIT 10;

-- Check active device bindings
SELECT device_serial, user_id, relay_type, relay_id, bound_at
FROM device_binding WHERE unbound_at IS NULL;

-- Count vitals with vs without provenance
SELECT
  COUNT(*) FILTER (WHERE device_serial IS NOT NULL) AS with_provenance,
  COUNT(*) FILTER (WHERE device_serial IS NULL) AS legacy
FROM vital;
\`\`\`

---

## 10. Files Modified

| Layer | Files |
|-------|-------|
| **Device Emulator** | types.ts, config.ts, ble-protocol.ts, device.ts, device-manager.ts, ws-server.ts |
| **Gateway Emulator** | types.ts, device-connector.ts, patient-mapper.ts, vitals-collector.ts, websocket-publisher.ts, index.ts |
| **Medical API** | 2 migrations, vital entity/model/DTOs/mappers/views, new device-binding module (13 files) |
| **Mobile App** | connect-device.slice.ts, post-patient-vitals-request.types.ts, Vitals.tsx, connect-device.ts, ws-device-simulator.ts |
| **Admin Backend** | medical.ts (proxy routes + provenance fields) |
| **Admin Console** | types.ts, PatientVitalCard.tsx, PatientDetailPage.tsx, App.tsx, DeviceBindingsPage.tsx |
`
  }
];

async function seed() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const col = db.collection('wikiArticles');

    for (const article of articles) {
      const now = new Date();
      await col.updateOne(
        { slug: article.slug },
        { $set: { ...article, updatedAt: now }, $setOnInsert: { createdAt: now } },
        { upsert: true },
      );
      console.log(`✓ Upserted wiki article: ${article.title}`);
    }
  } finally {
    await client.close();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
