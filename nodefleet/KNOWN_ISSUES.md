# NodeFleet - Known Issues, Gaps & Recommendations

Last updated: 2026-03-30

---

## Resolved Issues

### 0. Network Discovery Showed "No Devices Found" Despite Online Device — RESOLVED

**Status:** Fixed (2026-03-29)

**Root cause:** The network scanner only used UDP broadcast on port 5556. Connected devices communicate via WebSocket, not UDP — they were invisible to the scanner even when online and sending heartbeats.

**Fix:** Implemented 3-protocol redundant discovery:
1. **WebSocket** — Added `/devices` HTTP endpoint to ws-server returning connected devices from in-memory Map
2. **UDP Broadcast** — Existing LAN scan on port 5556 for unpaired ESP32 devices
3. **Database** — Fallback query for devices with `status='online'` in PostgreSQL

Results are deduplicated by deviceId. Scanner UI now shows protocol badges (WebSocket=green, UDP=blue, Database=yellow) with per-protocol count breakdown. Also fixed `ipAddress` → `lastIp` column reference and Redis `lazyConnect` during Next.js build.

**Verified:** `kimera` device (`6a9da513`) discovered via WebSocket protocol with live heartbeat.

---

### 1. Camera Init Crashed ESP32 (WDT Reset) — RESOLVED

**Status:** Fixed (2026-03-28)

**Root cause:** `board_build.arduino.memory_type = qio_opi` in `platformio.ini` caused the PSRAM to be misconfigured. The `esp_camera_init()` function tried to allocate frame buffers in PSRAM that was incorrectly initialized, causing a watchdog timer reset (`TG1WDT_SYS_RST`). This was NOT a hardware issue — the camera ribbon cable and DIP switch were fine.

**Fix:** Remove the `board_build.arduino.memory_type` setting entirely from `platformio.ini`. The board defaults work correctly. Camera now initializes in DRAM mode (SVGA resolution, 1 frame buffer) without PSRAM. For PSRAM-enabled mode (VGA, 2 frame buffers), the correct memory type for this board still needs to be determined.

**Verified camera pins (from branch-to-merge):** VSYNC=42, HREF=41, PCLK=46, XCLK=39, SIOD=15, SIOC=16, Y2-Y9=7-14.

---

## Critical Open Issues

### 1. Camera Captures Fail — `esp_camera_fb_get()` Returns NULL

**Status:** Open (2026-03-28)

Camera I2C/SCCB initialization succeeds (sensor detected, `esp_camera_init()` returns `ESP_OK`), but `esp_camera_fb_get()` returns NULL when attempting to capture a JPEG frame. This happens at both VGA and QVGA resolution in DRAM mode.

**What works:** Camera sensor responds on I2C. `esp_camera_init()` completes without error. Command pipeline delivers `capture_photo` to the device. Device attempts capture and sends ack.

**What fails:** No pixel data is produced by the camera. The DVP data path (XCLK → camera → PCLK/VSYNC/HREF/D0-D7 → ESP32) is not active.

**Root cause candidates:**
- DIP switch on the back of the board not fully configured (CAM switch ON, but HUB or other switches may need specific positions)
- Camera ribbon cable data pins not making contact (I2C uses only 2 pins; DVP uses 14 pins — partial contact possible)
- XCLK signal not reaching the camera (GPIO39 may need specific mux configuration)
- PSRAM not available — camera may require PSRAM for frame buffer allocation even at QVGA

**Recommendation:**
1. Check ALL DIP switch positions on the back of the board
2. Reseat the camera ribbon cable firmly
3. Try compiling with Arduino IDE (which produced working builds on branch-to-merge) instead of PlatformIO to rule out build config differences
4. Investigate PSRAM: the board has 8MB OPI PSRAM but `psramFound()` returns false. Finding the correct PlatformIO memory_type config (NOT `qio_opi`) may fix both PSRAM and camera capture

### 2. SIM Card Detection Intermittent — MITIGATED

**Status:** Mitigated (2026-03-28)

`AT+CPIN?` returns `+CME ERROR` via UART but works via USB (`/dev/ttyACM0`). The SIM is physically present.

**Fix applied:** SIM check failure is now non-fatal. Modem init continues, GPS and signal monitoring work without SIM. Only cellular data requires SIM. Signal now shows -67 dBm correctly.

**Remaining:** SIM detection still fails via UART — cellular data (as opposed to WiFi) is unavailable until SIM check succeeds.

### 3. GPS GNSS Module Not Responding — RESOLVED

**Status:** Fixed (2026-03-30). Root cause: SIM7670G-MNGV variant requires `AT+CGNSSPWR=1` (not `AT+CGPS=1`) to enable GNSS. After modem crash, both commands failed. Fix: `AT+CRESET` (full modem hardware reset) restored GNSS. Firmware now tries both command variants and auto-restarts GNSS after 3 consecutive failures.

`AT+CGPSINFO` and `AT+CGPS=1` return ERROR on both UART and USB ports. This started after an `AT+CFUN=1,1` modem reset disconnected the USB. The modem's GNSS subsystem needs a physical power cycle (unplug/replug USB) to recover.

**GPS data in database is from 3/27** when GNSS was working. New GPS records will resume after power cycle.

**Fix timeline:**
- 2026-03-30 AM: USB replug restored SIM/LTE (TELUS, CEREG 0,1, -79 dBm)
- 2026-03-30 PM: `AT+CRESET` restored GNSS subsystem. `AT+CGNSSPWR=1` → OK. Firmware updated with dual-command fallback and auto-recovery.

---

## Major Gaps

### 1. Telemetry Not Written to Database via WebSocket (Fixed)

**Status:** Fixed in this commit

The ws-server received heartbeat and GPS data via WebSocket but only published to Redis -- nothing wrote to the PostgreSQL `telemetry_records` or `gps_records` tables. The dashboard showed empty telemetry.

**Fix:** Added `pg` dependency to ws-server. Heartbeat and GPS handlers now INSERT directly into the database.

### 2. Command Pipeline — FIXED

**Status:** Fixed (2026-03-28)

- Commands created via REST API → Redis list → ws-server drains on every heartbeat (30s) → sends to device via WebSocket → device acks → ws-server updates DB status
- Status mapping: device `success` → DB `completed`, device `error` → DB `failed`
- **Fix applied:** Queue drain now runs on every heartbeat (not just device connect), and the `readyState` check that was blocking drain for connected devices was removed

### 3. Photo Upload Pipeline — Partially Working

**Status:** Upload endpoint and presigned URLs work. Camera capture fails (see Critical Issue #1).

The full pipeline is coded and partially tested:
1. Dashboard sends `capture_photo` command → delivered to device via Redis queue drain
2. Device calls `esp_camera_fb_get()` — **currently returns NULL** (camera DVP data path issue)
3. Device requests presigned upload URL from `POST /api/devices/upload` (device-token authenticated)
4. Presigned URL is rewritten from internal `http://minio:9000` to public `http://192.168.0.19:50900` via `S3_PUBLIC_ENDPOINT` env var
5. Device PUTs JPEG to MinIO via presigned URL
6. Device sends `media_ready` WebSocket notification
7. Media file record created in `media_files` table

**What has been verified working:** Steps 1, 3, 4, 7 (command delivery, upload URL generation, DB record creation). Steps 2, 5, 6 blocked by camera capture failure.

**MinIO bucket:** `nodefleet-media` was missing and has been manually created. The `minio-init` container should create it automatically on fresh deployments.

### 4. Battery Monitoring Not Working

**Status:** Disabled

GPIO0 is not a valid ADC pin on ESP32-S3 (strapping pin). Battery ADC pin is set to -1 (disabled). The Waveshare board has a **MAX17048G fuel gauge IC** on I2C (address 0x36) that provides battery voltage and percentage — this is the correct way to read battery on this board.

**Recommendation:** Use the MAX17048 I2C fuel gauge instead of raw ADC. I2C pins are GPIO15/16 (shared with camera SCCB, but accessible when camera is idle). Alternatively, use modem AT command `AT+CBC` for battery level.

### 5. PSRAM Not Detected

**Status:** Known limitation

The board has 8MB OPI PSRAM but `psramFound()` returns false with the current PlatformIO config. The `board_build.arduino.memory_type = qio_opi` setting crashes the board. Camera operates in DRAM mode (SVGA, 1 frame buffer) instead of PSRAM mode (VGA, 2 frame buffers).

**Impact:** Lower camera resolution and single frame buffer. Photo capture still works but at SVGA instead of VGA.

**Recommendation:** Investigate the correct `memory_type` for this board variant (ESP32-S3R8). Options to try: `opi_opi`, `qio_qspi`, or compile via Arduino IDE with "PSRAM: OPI PSRAM" to capture the correct sdkconfig.

### 5. OTA Firmware Update — RESOLVED

**Status:** Implemented (2026-03-28)

**Fix:** `HTTPUpdate` library integrated in `updateFirmware()`. Device downloads `.bin` from presigned MinIO URL and applies OTA. GitHub Actions CI pipeline compiles firmware on every push.

### 6. Audio Recording — Hardware Pending

**Status:** Firmware coded, hardware arriving (INMP441 mic)

I2S DMA recording at 16kHz/16-bit mono, WAV header creation, presigned URL upload to MinIO. INMP441 MEMS microphone pins configured (BCK=GPIO2, WS=GPIO3, DIN=GPIO1). Set `ENABLE_AUDIO 1` after connecting mic.

### 7. Telemetry Retention — RESOLVED

**Status:** Implemented (2026-03-28)

**Fix:** 90-day auto-cleanup on ws-server startup. Aggregation endpoint added (`/api/devices/[id]/telemetry/aggregate`) with PostgreSQL `date_trunc + GROUP BY`.

### 8. Device Token Rotation — RESOLVED

**Status:** Implemented (2026-03-28)

**Fix:** ws-server checks token age on every heartbeat. Tokens older than 30 days are automatically rotated: new JWT issued, sent to device via `token_refresh` WebSocket message, device saves to NVS. Audit trail logs rotation events.

### 9. Rate Limiting — RESOLVED

**Status:** Implemented (2026-03-28)

**Fix:** In-memory rate limiter on `/api/devices/pair` endpoint. 10 attempts per IP per hour. Returns 429 when exceeded.

### 10. Webhook System — RESOLVED

**Status:** Implemented (2026-03-28)

**Fix:** `webhooks` table with HMAC-SHA256 signed payloads. CRUD API at `/api/webhooks`. Events: device_online/offline, command_completed, alert_triggered, low_battery.

### 11. Device Lifecycle — RESOLVED

**Status:** Implemented (2026-03-28)

**Fix:** Decommission API (DELETE `/api/devices/[id]` → status='disabled', revoke tokens, audit log). Health scoring API (GET `/api/devices/[id]/health` → 0-100 weighted score). Fleet-wide command broadcast (POST `/api/fleets/[id]/command`).

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
| Command queue not draining for connected devices | Added drain on every heartbeat + removed readyState block |
| Command ack status `success` rejected by DB enum | Added mapping: `success`→`completed`, `error`→`failed` |
| MinIO presigned URL unreachable from ESP32 (internal Docker hostname) | Added `S3_PUBLIC_ENDPOINT` env var, URL rewrite in `/api/devices/upload` |
| MinIO bucket `nodefleet-media` missing | Manually created; `minio-init` container should auto-create |
| ModemManager grabbing modem serial ports | Stopped and disabled ModemManager systemd service |
| No telemetry retention | 90-day auto-cleanup on ws-server startup |
| No telemetry aggregation | PostgreSQL date_trunc + GROUP BY endpoint |
| No token rotation | 30-day auto-refresh via WebSocket `token_refresh` message |
| No rate limiting on pairing | In-memory rate limiter (10/hr/IP) with 429 response |
| No webhook system | webhooks table + HMAC-SHA256 signed HTTP POST delivery |
| No fleet-wide commands | POST `/api/fleets/[id]/command` broadcasts to all devices |
| No device health scoring | GET `/api/devices/[id]/health` with 5-factor weighted score |
| No device decommission | DELETE soft-disables + revokes tokens + audit log |
| No audit trail | `audit_logs` table with 19 event types, filterable viewer at /audit |
| No MQTT broker | Eclipse Mosquitto 2 added to docker-compose (port 51883) |
| No MQTT firmware client | PubSubClient added — publishes telemetry + GPS to broker (dual-protocol with WebSocket) |
| No WiFi provisioning | AP captive portal ("NodeFleet-Setup") when WiFi fails — dark UI configures WiFi, server, MQTT, pairing code |
| No OTA config | OTA_CHECK_URL, OTA_CHECK_INTERVAL, ENABLE_AUTO_OTA added to config.h |
| No CI pipeline | GitHub Actions: web typecheck + ws-server typecheck + firmware compile |
| Content Library images not rendering | Presigned download URLs used internal minio:9000. Fixed: rewrite to S3_PUBLIC_ENDPOINT in s3.ts |
| No protocol routing settings | protocol_settings table + API: per-org data-type → protocol mapping (WS/MQTT/HTTP) |

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
| No battery monitoring (GPIO0 invalid) | MAX17048 I2C fuel gauge driver (addr 0x36, SOC% in heartbeat) |
| OTA update stub | HTTPUpdate library implemented in `updateFirmware()` |
| No power management | Active/idle/sleep/deep_sleep modes with dynamic flags |
| Audio recording stub | Full I2S DMA → WAV → presigned URL upload pipeline (INMP441 pins configured) |
| 7 commands only | 12 commands: added read_config, factory_reset, set_heartbeat_interval, power_mode, get_network_info |
| No firmware version tracking | `firmware_version` sent in heartbeat, ws-server updates DB |
| No token refresh handling | Firmware handles `token_refresh` WebSocket message, saves new JWT to NVS |
| GPS AT commands wrong for MNGV variant | enableGNSS/getGPSFix now try AT+CGPS* first, fall back to AT+CGNSSPWR/AT+CGNSSINFO |
| GPS silently fails with no recovery | Auto-restart GNSS after 3 consecutive failures (5-min cooldown) |
| GPS tab had no status indicator | Added visual badge (active/stale/no data), calibrate button, help section |
| MinIO unreachable from LTE | Binary upload proxy: POST binary to `/api/devices/upload`, server streams to MinIO |
| No remote/LTE connectivity | Dual-mode: auto-detect local WiFi vs remote ngrok/LTE with runtime SSL |
| MQTT local-only | MQTT-over-WebSocket via `wss://nodefleet.ngrok.dev/mqtt` (nginx → Mosquitto 9001) |
| No remote provisioning fields | Captive portal now configures ngrok domain, connection mode, API key |
| S3 credentials not reading .env | s3.ts now reads S3_ACCESS_KEY/S3_SECRET_KEY alongside AWS_* vars |

---

## Remote Access Architecture (2026-03-30)

**Domain:** `nodefleet.ngrok.dev` (single domain, all devices)

| Endpoint | Protocol | Purpose |
|----------|----------|---------|
| `wss://nodefleet.ngrok.dev/device` | WebSocket | Device real-time connection (heartbeat, GPS, commands) |
| `https://nodefleet.ngrok.dev/api/devices/*` | HTTPS | Device pairing, binary media upload, HTTP heartbeat |
| `wss://nodefleet.ngrok.dev/mqtt` | MQTT-over-WS | Mosquitto broker (external subscribers: Grafana, HA, n8n) |
| `wss://nodefleet.ngrok.dev/dashboard` | WebSocket | Dashboard real-time updates |

**Connection modes (firmware config.h `CONNECTION_MODE`):**
- `"auto"` — Try local server first (TCP probe), fall back to ngrok/LTE
- `"local"` — Always use `SERVER_HOST:SERVER_PORT` (WiFi only)
- `"remote"` — Always use `NGROK_DOMAIN:443` with SSL

**Protocol strategy:**
- WebSocket: heartbeat, GPS, commands, messaging (all real-time small payloads)
- HTTP: binary media upload (photos, audio, video recordings) via server proxy to MinIO
- MQTT: local TCP for device (PubSubClient), WebSocket for external subscribers (through ngrok)

### Verification Results (2026-03-30)

All 12 tests passed, 0 failures, 0 fixes required.

| Test | Path | Result |
|------|------|--------|
| Upload Mode 1 (JSON presigned URL) | local | PASS |
| Upload Mode 2 (binary proxy) | local | PASS |
| File verified in MinIO | local | PASS |
| Auth rejection (no token) | local | PASS |
| Empty body rejection | local | PASS |
| Binary upload | ngrok | PASS |
| Presigned URL | ngrok | PASS |
| MQTT-WS connect/pub/sub | local | PASS |
| MQTT-WSS connect/pub/sub | ngrok | PASS |
| Firmware compilation | PlatformIO | PASS (RAM 16%, Flash 32.4%) |
| WebSocket /device + heartbeat | ngrok | PASS |
| Pairing endpoint | ngrok | PASS |
