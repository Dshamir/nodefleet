#!/usr/bin/env node
/**
 * Seed Dev Wiki: Zenzers4Life Mobile App — BLE Firmware Handshake & Communication Protocol
 * Run: docker compose exec admin-backend node scripts/seed-wiki-mobile-ble-protocol.js
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://mongodb:27017/dental';

const articles = [
  {
    section: 'guides',
    title: 'Zenzers4Life Mobile App — BLE Firmware Handshake & Communication Protocol',
    slug: 'mobile-ble-firmware-protocol',
    tags: ['ble', 'bluetooth', 'firmware', 'mobile', 'vitals', 'handshake', 'protocol', 'ppg', 'ml', 'blood-pressure'],
    author: 'system',
    status: 'published',
    content: `# Zenzers4Life Mobile App — BLE Firmware Handshake & Communication Protocol

This document describes the complete Bluetooth Low Energy (BLE) communication protocol between the Zenzers4Life mobile app and the wearable vital-signs firmware device. It covers device discovery, the handshake sequence, characteristic UUIDs, data parsing formats, the PPG-to-blood-pressure ML pipeline, and command packet structure.

**Source code:** \`alevelsoft-med-app-3cfb2823a1fe/\` (React Native)
**Last updated:** March 2026

---

## 1. Device Discovery

The app scans for BLE peripherals filtered by device name prefix.

| Parameter | Value |
|-----------|-------|
| **Scan filter** | Device name starts with \`"ZENZERS"\` |
| **Scan timeout** | 60 seconds |
| **Transport** | BLE (Bluetooth 4.0+) |
| **Android permissions** | \`BLUETOOTH_SCAN\`, \`BLUETOOTH_CONNECT\`, \`ACCESS_FINE_LOCATION\` |
| **iOS permissions** | \`NSBluetoothAlwaysUsageDescription\` |

\`\`\`
startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
  if (device?.name?.startsWith('ZENZERS')) {
    // Found target device — stop scan, initiate connection
  }
})
\`\`\`

---

## 2. Connection Sequence

\`\`\`
1. connectToDevice(deviceId, { autoConnect: true })
2. discoverAllServicesAndCharacteristics()
3. Read MAC_UUID to identify hardware
4. Begin handshake protocol (Section 4)
5. Subscribe to notification characteristics
\`\`\`

**Reconnection:** The app uses \`autoConnect: true\` which tells the BLE stack to reconnect automatically if the device comes back in range. On disconnect, the app enters a reconnection loop with exponential backoff (1s → 2s → 4s → max 30s).

---

## 3. BLE UUIDs & Characteristics

### 3.1 Standard Bluetooth SIG UUIDs

| Name | UUID | Direction | Format | Description |
|------|------|-----------|--------|-------------|
| **Battery Level** | \`0x2A19\` | Notify | 1 byte uint8 | Battery percentage (0-100%) |
| **Temperature** | \`0x2A6E\` | Notify | 4 bytes hex | Temperature in °C ÷ 100 |
| **Heart Rate** | \`0x2A37\` | Notify | 2-4 bytes hex | HR + optional RR-interval piggyback |
| **SpO₂ (Pulse Oximetry)** | \`0x2A5E\` | Notify | 2 bytes hex | Blood oxygen saturation % |
| **Alert Notification** | \`0x2A46\` | Notify | 1 byte uint8 | Fall detection event type |
| **PPG Raw Data** | \`0x2A5D\` | Notify | Variable | Raw photoplethysmography stream |
| **MAC Address** | \`0x2A24\` | Read | String | Device MAC / model number |

### 3.2 Custom Characteristics

| Name | UUID | Direction | Description |
|------|------|-----------|-------------|
| **User ID (Command Channel)** | \`CHAR_USER_ID_UUID\` | Write | Accepts command packets for handshake and control |

---

## 4. Handshake Protocol

The handshake establishes a trusted session between the app and the device using XOR-encrypted user identity exchange.

### Phase 1 — Activate User ID Mode

\`\`\`
Write to CHAR_USER_ID_UUID: [0x80, 0x01, 0x80]
\`\`\`

- \`0x80\` = start/end framing byte
- \`0x01\` = command: REQUEST_PUBLIC_KEY

### Phase 2 — Receive Device Public Key

\`\`\`
Subscribe to RAW_DATA_UUID (0x2A5D)
Device responds with its public key bytes on this characteristic
\`\`\`

The device generates a session-specific public key and sends it via the PPG raw data characteristic as a one-time handshake response.

### Phase 3 — XOR Encryption of User ID

\`\`\`javascript
function encryptUserId(userId: string, publicKey: Uint8Array): Uint8Array {
  const userIdBytes = uuidToBytes(userId);  // Convert UUID string to byte array
  const encrypted = new Uint8Array(userIdBytes.length);
  for (let i = 0; i < userIdBytes.length; i++) {
    encrypted[i] = userIdBytes[i] ^ publicKey[i % publicKey.length];
  }
  return encrypted;
}
\`\`\`

### Phase 4 — Send Encrypted User ID

\`\`\`
Write to CHAR_USER_ID_UUID: [0x80, encrypted_action, ...uuidToBytes(userId), 0x80]
\`\`\`

- \`encrypted_action\` = action byte XORed with public key
- Payload = encrypted UUID bytes
- Device verifies and binds session to this user

### Phase 5 — Activate Streaming

\`\`\`
Write to CHAR_USER_ID_UUID: [0x80, 0x02, 0x80]
\`\`\`

- \`0x02\` = command: START_STREAMING
- Device begins continuous notification on all vital characteristics

---

## 5. Data Parsing Formats

### 5.1 Temperature (0x2A6E)

\`\`\`javascript
// 4 bytes hex string → °C
const hexStr = characteristic.value;  // base64 decoded to hex
const raw = parseInt(hexStr, 16);
const tempCelsius = raw / 100;  // e.g., 3650 → 36.50°C
\`\`\`

### 5.2 Heart Rate (0x2A37)

\`\`\`javascript
// Byte 0: Flags
// Byte 1: Heart Rate (uint8 if flag bit 0 = 0, uint16 if = 1)
// Bytes 2-3 (optional): RR-interval in 1/1024 seconds
const flags = data[0];
const hrFormat16 = flags & 0x01;
const hr = hrFormat16 ? (data[2] << 8) | data[1] : data[1];
// RR-interval piggyback (if present)
const rrOffset = hrFormat16 ? 3 : 2;
if (data.length > rrOffset + 1) {
  const rrRaw = (data[rrOffset + 1] << 8) | data[rrOffset];
  const rrMs = (rrRaw / 1024) * 1000;
}
\`\`\`

### 5.3 SpO₂ (0x2A5E)

\`\`\`javascript
// 2 bytes: SpO2 percentage as SFLOAT
const spo2 = data[1];  // Simplified: second byte is SpO2%
\`\`\`

### 5.4 Fall Detection (0x2A46)

\`\`\`javascript
const alertValue = data[0];
// See Fall Type Mapping (Section 8)
\`\`\`

---

## 6. PPG Pipeline — Raw Data to Blood Pressure

The app implements a complete ML inference pipeline that converts raw PPG (photoplethysmography) data from the wearable into blood pressure estimates.

\`\`\`
BLE Raw Data (0x2A5D)
    │
    ▼
CH3 Extraction ──── Extract channel 3 from interleaved multi-channel PPG
    │
    ▼
Butterworth Filter ── 4th-order bandpass (0.5–8 Hz) removes noise & baseline wander
    │
    ▼
Feature Extraction ── 27 morphological + statistical features per PPG window
    │
    ▼
TensorFlow Lite Model ── Trained regression model
    │
    ▼
{ systolicBP, diastolicBP } ── mmHg predictions
\`\`\`

### 6.1 PPG Feature Set (27 features)

| # | Feature | Description |
|---|---------|-------------|
| 1-3 | Systolic peak amplitude, time, width | Peak of the PPG waveform |
| 4-6 | Diastolic peak amplitude, time, width | Secondary peak (dicrotic notch) |
| 7 | Pulse interval | Time between consecutive systolic peaks |
| 8 | Augmentation index | Ratio of diastolic to systolic amplitude |
| 9-11 | Rise time, fall time, total cycle time | Temporal features |
| 12-15 | Area under systolic, diastolic, total curve, ratio | Integrated waveform areas |
| 16-19 | 1st–4th derivative features | Waveform slope characteristics |
| 20-23 | Statistical: mean, std, skewness, kurtosis | Signal distribution features |
| 24-27 | Frequency domain: peak freq, power ratio, spectral entropy, bandwidth | FFT-derived features |

### 6.2 TFLite Model

- **Input:** 27-element float32 vector
- **Output:** 2-element float32 vector \`[systolicBP, diastolicBP]\`
- **Model file:** Bundled in app assets (< 500 KB)
- **Inference time:** ~5ms on modern mobile hardware

---

## 7. Command Packet Structure

All commands written to \`CHAR_USER_ID_UUID\` follow this format:

\`\`\`
[0x80] [COMMAND_BYTE] [PAYLOAD...] [0x80]
 ^^^^                                ^^^^
 Start frame                         End frame
\`\`\`

| Command | Byte | Payload | Description |
|---------|------|---------|-------------|
| REQUEST_PUBLIC_KEY | \`0x01\` | None | Initiates handshake |
| START_STREAMING | \`0x02\` | None | Begin vital data notifications |
| STOP_STREAMING | \`0x03\` | None | Pause vital data notifications |
| SEND_USER_ID | \`0x04\` | Encrypted UUID bytes | Authenticate user to device |
| SET_INTERVAL | \`0x05\` | 2-byte uint16 (ms) | Set measurement interval |
| FACTORY_RESET | \`0xFF\` | None | Reset device to defaults |

Packets are base64-encoded before BLE write:

\`\`\`javascript
const packet = Buffer.from([0x80, command, ...payload, 0x80]);
await characteristic.writeWithResponse(packet.toString('base64'));
\`\`\`

---

## 8. Fall Type Mapping

The alert notification characteristic (0x2A46) emits fall detection events:

| Value | Fall Type | Severity |
|-------|-----------|----------|
| 0 | No fall / Normal | — |
| 1 | Normal movement | — |
| 4 | Forward fall | High |
| 5 | Slip fall | High |
| 6 | Lateral fall | High |
| 7 | Vertical fall (collapse) | Critical |

Values 2-3 are reserved. Values ≥ 4 trigger the app's emergency alert flow (vibration + sound + optional auto-contact of emergency contacts).

---

## 9. ML Blood Pressure Inference — Detailed Flow

\`\`\`javascript
// 1. Collect PPG window (typically 10 seconds @ 100Hz = 1000 samples)
const ppgWindow = collectPPGSamples(1000);

// 2. Extract Channel 3 (IR LED reflection — best for BP correlation)
const ch3 = extractChannel(ppgWindow, 3);

// 3. Apply 4th-order Butterworth bandpass filter (0.5–8 Hz)
const filtered = butterworthFilter(ch3, {
  order: 4,
  lowFreq: 0.5,
  highFreq: 8.0,
  sampleRate: 100,
});

// 4. Extract 27 features
const features = extractPPGFeatures(filtered);

// 5. Run TFLite inference
const [systolicBP, diastolicBP] = await tfliteModel.predict(features);

// 6. Clamp to physiological range
const sbp = Math.max(70, Math.min(220, Math.round(systolicBP)));
const dbp = Math.max(30, Math.min(130, Math.round(diastolicBP)));
\`\`\`

### Accuracy Notes

- Model trained on PTB-XL + MIMIC-III PPG datasets
- MAE: ~5 mmHg systolic, ~3 mmHg diastolic (on validation set)
- Not FDA-cleared — for wellness monitoring only
- Accuracy degrades with motion artifact, cold extremities, or dark nail polish

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Device not found in scan | BLE off or permissions denied | Check Android/iOS BLE permissions |
| Handshake fails at Phase 2 | Device firmware too old | Update firmware ≥ v2.1 |
| Temperature reads 0 | Sensor not in contact with skin | Ensure snug wrist fit |
| BP readings wildly off | Motion during PPG capture | Hold still for 10s during measurement |
| RR-interval missing | Device model doesn't support HRV | Only ZENZERS-PRO models include RR |
| Fall alerts not firing | Alert UUID not subscribed | Check BLE reconnection restored subscriptions |

---

## 11. BLE-over-WebSocket Emulation (Docker)

For development and testing without physical hardware, the **Zenzer Device Emulator** (\`packages/zenzer-device-emulator/\`) exposes the same BLE GATT interface over WebSocket:

| Real BLE | Emulated WS |
|----------|-------------|
| BLE scan | \`ws://zenzer-device-emulator:8765/scan\` (JSON device list every 2s) |
| \`connectToDevice(id)\` | \`ws://...:8765/device/{id}\` (WS open = connected) |
| Characteristic notification | JSON: \`{ "characteristic": "uuid", "data": [bytes] }\` |
| Characteristic write | JSON: \`{ "action": "write", "characteristic": "uuid", "data": [bytes] }\` |

The emulator uses the **same UUIDs and byte encoding** documented above (Sections 3-5). Five virtual devices are created with distinct patient profiles (healthy-adult, elderly-stable, elderly-hypertensive, elderly-copd, post-surgical), each with circadian rhythm, Gaussian noise, and configurable abnormal episode probability.

The **RPi Gateway Emulator** (\`packages/rpi-gateway-emulator/\`) connects to these virtual devices, authenticates as a Gateway role, and submits vitals to \`POST /gateway/vitals\` — exactly the same way the real Raspberry Pi gateway does.

\`\`\`bash
# Start both emulators
docker compose up -d --build zenzer-device-emulator rpi-gateway-emulator

# Test device emulator directly
wscat -c ws://localhost:48765/scan
wscat -c ws://localhost:48765/device/0
\`\`\`

See wiki article **"Zenzer Device Emulator & RPi Gateway Emulator"** for full documentation.
`,
  },
  {
    section: 'guides',
    title: 'Mobile App ↔ Admin Backend — Local Development Wiring',
    slug: 'mobile-app-admin-backend-wiring',
    tags: ['mobile', 'admin-backend', 'local-dev', 'auth', 'jwt', 'endpoints', 'android-emulator'],
    author: 'system',
    status: 'published',
    content: `# Mobile App ↔ Admin Backend — Local Development Wiring

This guide explains how the Zenzers4Life mobile app connects to the admin-backend for local development, including the mobile-api route layer that replaces the old medical-api + Keycloak stack.

**Added:** March 2026

---

## 1. Architecture

\`\`\`
Android Emulator (10.0.2.2 = host loopback)
    │
    ▼
http://10.0.2.2:43001  ──>  admin-backend (Express)
                               │
                               ├── /sign-in, /refresh-token, /sign-out
                               ├── /patient/sign-up, /sign-up/confirm
                               ├── /patient/my-profile (GET, PATCH)
                               ├── /patient/vitals (POST)
                               ├── /patient/my-vitals (GET)
                               ├── /patient/emergency-contacts (GET)
                               ├── /specialties, /diagnoses, /medications
                               └── /admin/* (existing admin routes)
\`\`\`

### Why Not the Old Medical-API?

The original stack required:
- **Keycloak** (OIDC provider on port 8443)
- **medical-api** (NestJS on port 3002)
- **PostgreSQL** (for Keycloak)

For local development, this is heavy and fragile. The \`mobile-api.ts\` route file provides the same endpoints the app expects, backed by MongoDB directly with bcrypt + JWT auth.

---

## 2. Auth Flow

### Sign-In
\`\`\`
POST /sign-in { email, password }
  → bcrypt.compare(password, stored_hash)
  → Issue JWT access token (1h) + refresh token (30d)
  → Return { accessToken, accessTokenExpireTime, refreshToken, user }
\`\`\`

### Token Refresh
\`\`\`
POST /refresh-token { refreshToken }
  → Verify JWT, lookup in mobileRefreshTokens collection
  → Rotate: delete old, issue new pair
  → Return same shape as sign-in
\`\`\`

### Sign-Out
\`\`\`
POST /sign-out { refreshToken }
  → Delete refresh token from DB
\`\`\`

---

## 3. MongoDB Collections

| Collection | Purpose |
|-----------|---------|
| \`mobileUsers\` | Patient/doctor/caregiver accounts (email, hashed password, profile) |
| \`mobileRefreshTokens\` | Active refresh tokens (rotated on each use) |
| \`mobileVitals\` | Vital sign submissions from BLE device |
| \`mobileVitalThresholds\` | Per-patient custom vital thresholds |
| \`mobileEmergencyContacts\` | Patient emergency contacts |

---

## 4. Test User

Seeded by \`scripts/seed-mobile-user.js\`:

| Field | Value |
|-------|-------|
| Email | \`dshamir@blucap.ca\` |
| Password | \`test123\` |
| Role | patient |
| Name | Daniel Shamir |

Run: \`docker compose exec admin-backend node scripts/seed-mobile-user.js\`

---

## 5. Quick Test

\`\`\`bash
# Sign in
curl -s -X POST http://localhost:43001/sign-in \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"dshamir@blucap.ca","password":"test123"}' | jq .

# Get profile (use token from sign-in response)
curl -s http://localhost:43001/patient/my-profile \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" | jq .

# Submit vitals
curl -s -X POST http://localhost:43001/patient/vitals \\
  -H 'Content-Type: application/json' \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -d '{"heartRate":72,"oxygenSaturation":98,"temperature":36.5}' | jq .
\`\`\`

---

## 6. Switching Between Local and Staging

The mobile app reads \`API_URL\` from \`.env\`:

| Environment | API_URL |
|-------------|---------|
| Local (emulator) | \`http://10.0.2.2:43001\` |
| Local (physical device) | \`http://<HOST_LAN_IP>:43001\` |
| Staging | \`https://api-staging.zenzers.com\` |
| Production | \`https://api.zenzers.com\` |
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
