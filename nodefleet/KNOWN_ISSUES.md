# NodeFleet - Known Issues, Gaps & Recommendations

Last updated: 2026-03-27

---

## Critical Issues

### 1. Camera Init Crashes ESP32 (WDT Reset)

**Status:** Unresolved (hardware verification needed)

`esp_camera_init()` causes a watchdog timer reset (`TG1WDT_SYS_RST`) when called, even with the correct pin mapping from the working `branch-to-merge` (VSYNC=42, HREF=41, PCLK=46, XCLK=39). PSRAM is detected. The crash occurs inside the camera driver before any error code is returned.

**Root cause candidates:**
- Camera ribbon cable not properly seated (FPC latch not closed)
- DIP switch on the back of the board not set to CAM position
- Camera module defective or incompatible (OV5640 shipped instead of OV2640)
- Camera FPC connector on the wrong port (some boards have display + camera connectors)

**Workaround:** Camera is disabled (`ENABLE_CAMERA 0`). The firmware boots cleanly and all other features work. To re-enable, set `ENABLE_CAMERA 1` in `config.h` after physically verifying the camera connection.

**Recommendation:** Physically inspect the board. Check: (1) DIP switch CAM position, (2) ribbon cable orientation (gold contacts facing board), (3) FPC latch fully closed.

### 2. SIM Card Detection Intermittent

**Status:** Intermittent

`AT+CPIN?` sometimes returns ERROR instead of `+CPIN: READY`. The SIM is physically present and works when the host machine talks to the modem directly via USB (`/dev/ttyACM0`).

**Root cause:** The modem UART (GPIO17/18) initialization timing is tight. The modem needs 3+ seconds after power-on before it responds to AT commands reliably. The 5-retry loop with 2-second delays usually catches it on attempt 2.

**Recommendation:** If SIM detection fails consistently, add a longer delay before the first AT probe, or toggle MODEM_POWER_PIN (GPIO33) to power-cycle the modem.

---

## Major Gaps

### 1. Telemetry Not Written to Database via WebSocket (Fixed)

**Status:** Fixed in this commit

The ws-server received heartbeat and GPS data via WebSocket but only published to Redis -- nothing wrote to the PostgreSQL `telemetry_records` or `gps_records` tables. The dashboard showed empty telemetry.

**Fix:** Added `pg` dependency to ws-server. Heartbeat and GPS handlers now INSERT directly into the database.

### 2. Command Pipeline Incomplete

**Status:** Partially fixed

- Commands created via REST API are stored in a Redis list (`device:{id}:commands`).
- The ws-server drains this queue when a device connects.
- Command acks from the device update the database via the ws-server.
- **Gap:** The Redis queue drain on connect is not reliably triggering. Commands sent while the device is connected work via the dashboard WebSocket `send_command` path, but queued commands may not be delivered.

**Recommendation:** Add a periodic command queue poll (every 30s) in the ws-server's heartbeat handler, or switch to Redis pub/sub for immediate command delivery.

### 3. Photo Upload Pipeline Not End-to-End Tested

**Status:** Coded but untested

The full pipeline exists:
1. Device captures JPEG via `esp_camera_fb_get()`
2. Device requests presigned upload URL from `/api/devices/upload`
3. Device PUTs the JPEG to MinIO via the presigned URL
4. Device sends `media_ready` WebSocket message

**Gap:** Cannot test because camera init crashes. Once camera hardware works, the pipeline should work but may need debugging (presigned URL expiry, MinIO CORS, large file handling on ESP32).

### 4. Battery ADC Pin Not Verified

**Status:** Unknown

GPIO1 is configured as the battery ADC pin but reads near-zero voltage. The correct battery voltage divider pin for this board is not documented in the Waveshare schematic.

**Recommendation:** Check the Waveshare schematic for the battery monitoring circuit. Common pins: GPIO1, GPIO2, GPIO4. Some boards route battery through the SIM7670G's built-in fuel gauge (accessible via AT commands: `AT+CBC`).

### 5. OTA Firmware Update Not Implemented

**Status:** TODO

The `update_firmware` command handler exists but the actual OTA implementation is a stub. No `httpUpdate` or ESP-IDF OTA logic.

**Recommendation:** Use `esp_https_ota()` or the Arduino `HTTPUpdate` library. Store firmware binaries in MinIO and generate presigned download URLs.

### 6. Audio Recording Not Implemented

**Status:** TODO

The `record_audio` command handler exists but returns "Audio not enabled". No I2S microphone hardware is connected, and no I2S recording code exists.

**Recommendation:** Connect an INMP441 I2S MEMS microphone. The ESP32-S3 supports PDM and I2S audio input natively.

### 7. No Telemetry History Retention Policy

**Status:** Gap

Telemetry records accumulate indefinitely in PostgreSQL. No archival, aggregation, or TTL policy.

**Recommendation:** Add a cron job or PostgreSQL partition-based TTL to archive or delete records older than 90 days. Consider TimescaleDB for time-series optimization.

### 8. Device Token Rotation

**Status:** Gap

Device JWT tokens are issued for 365 days and never rotated. If a token is compromised, it remains valid for a year.

**Recommendation:** Implement token refresh on heartbeat (issue new token every 30 days, revoke old one).

---

## Server-Side Fixes Applied

| Issue | Fix |
|-------|-----|
| JWT secret mismatch (pairing signs with NEXTAUTH_SECRET, ws-server verifies with DEVICE_TOKEN_SECRET) | Added `DEVICE_TOKEN_SECRET` to `.env` matching `NEXTAUTH_SECRET` |
| Nginx WebSocket path mismatch (`/ws` vs `/device`) | Added dedicated `/device` and `/dashboard` location blocks |
| `jwt.verify is not a function` in ws-server (ESM import) | Changed `import * as jwt` to `import jwt` |
| WebSocketServer `handleUpgrade` called twice | Changed to `noServer: true` mode |
| Telemetry/GPS not persisted to database | Added PostgreSQL writes in ws-server heartbeat/GPS handlers |
| Stale pending commands | Marked old commands as "failed", added command ack DB updates |
| ModemManager grabbing modem serial ports | Stopped and disabled ModemManager systemd service |

---

## Firmware Fixes Applied

| Issue | Fix |
|-------|-----|
| WebSocket client was 100% stub (no actual TCP connection) | Replaced with real `WebSocketsClient` library implementation |
| GPS returned hardcoded San Francisco coordinates | Replaced with SIM7670G `AT+CGPSINFO` parser (NMEA ddmm.mmmm to decimal) |
| Modem didn't respond (wrong UART pins GPIO8/9) | Changed to GPIO17/18, added 5-retry init loop |
| LTE registration failed (used `AT+CREG` for 2G/3G) | Added `AT+CEREG?` check for LTE registration |
| GPS AT commands wrong (`AT+CGNSINF`) | Changed to SIM7670G-specific `AT+CGPSINFO` |
| Heartbeat field names mismatched server expectations | Renamed `battery_voltage` -> `battery`, `signal_strength` -> `signal`, etc. |
| Pairing response field wrong (`device_token` vs `token`) | Fixed to read `token` field |
| SSL connection failed to ngrok | Switched to local HTTP for development (`USE_SSL 0`) |
| ADC spam from GPIO0 (not valid ADC on ESP32-S3) | Changed to GPIO1 |
| Signal strength reported as raw CSQ (0-31) | Added dBm conversion (`-113 + 2*rssi`) |
