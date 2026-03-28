# NodeFleet - Known Issues, Gaps & Recommendations

Last updated: 2026-03-28

---

## Resolved Issues

### 1. Camera Init Crashed ESP32 (WDT Reset) — RESOLVED

**Status:** Fixed (2026-03-28)

**Root cause:** `board_build.arduino.memory_type = qio_opi` in `platformio.ini` caused the PSRAM to be misconfigured. The `esp_camera_init()` function tried to allocate frame buffers in PSRAM that was incorrectly initialized, causing a watchdog timer reset (`TG1WDT_SYS_RST`). This was NOT a hardware issue — the camera ribbon cable and DIP switch were fine.

**Fix:** Remove the `board_build.arduino.memory_type` setting entirely from `platformio.ini`. The board defaults work correctly. Camera now initializes in DRAM mode (SVGA resolution, 1 frame buffer) without PSRAM. For PSRAM-enabled mode (VGA, 2 frame buffers), the correct memory type for this board still needs to be determined.

**Verified camera pins (from branch-to-merge):** VSYNC=42, HREF=41, PCLK=46, XCLK=39, SIOD=15, SIOC=16, Y2-Y9=7-14.

---

## Open Issues

### 1. SIM Card Detection Intermittent

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

### 3. Photo Upload Pipeline Needs End-to-End Testing

**Status:** Camera working, upload pipeline coded

The full pipeline exists and camera init is verified working:
1. Device captures JPEG via `esp_camera_fb_get()` (SVGA in DRAM mode)
2. Device requests presigned upload URL from `/api/devices/upload`
3. Device PUTs the JPEG to MinIO via the presigned URL
4. Device sends `media_ready` WebSocket message

**Potential issues:** Presigned URL expiry, MinIO CORS config, large JPEG uploads from ESP32 (SVGA ~30-80KB), HTTP client memory pressure on ESP32 during upload.

### 4. Battery Monitoring Not Working

**Status:** Disabled

GPIO0 is not a valid ADC pin on ESP32-S3 (strapping pin). Battery ADC pin is set to -1 (disabled). The Waveshare board has a **MAX17048G fuel gauge IC** on I2C (address 0x36) that provides battery voltage and percentage — this is the correct way to read battery on this board.

**Recommendation:** Use the MAX17048 I2C fuel gauge instead of raw ADC. I2C pins are GPIO15/16 (shared with camera SCCB, but accessible when camera is idle). Alternatively, use modem AT command `AT+CBC` for battery level.

### 5. PSRAM Not Detected

**Status:** Known limitation

The board has 8MB OPI PSRAM but `psramFound()` returns false with the current PlatformIO config. The `board_build.arduino.memory_type = qio_opi` setting crashes the board. Camera operates in DRAM mode (SVGA, 1 frame buffer) instead of PSRAM mode (VGA, 2 frame buffers).

**Impact:** Lower camera resolution and single frame buffer. Photo capture still works but at SVGA instead of VGA.

**Recommendation:** Investigate the correct `memory_type` for this board variant (ESP32-S3R8). Options to try: `opi_opi`, `qio_qspi`, or compile via Arduino IDE with "PSRAM: OPI PSRAM" to capture the correct sdkconfig.

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
| ADC spam from GPIO0 (not valid ADC on ESP32-S3) | Disabled battery ADC (set to -1) |
| Signal strength reported as raw CSQ (0-31) | Added dBm conversion (`-113 + 2*rssi`) |
| Camera crash (WDT reset) on `esp_camera_init()` | Root cause: `qio_opi` memory type in platformio.ini. Fix: remove the setting, use board defaults |
| Camera pins wrong (GPIO34/35/36/37) | Corrected to VSYNC=42, HREF=41, PCLK=46, XCLK=39 (from branch-to-merge) |
