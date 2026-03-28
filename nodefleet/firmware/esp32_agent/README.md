# NodeFleet ESP32 Agent Firmware

Complete IoT device firmware for the Waveshare ESP32-S3 SIM7670G board, designed to connect to NodeFleet server over WiFi or 4G LTE.

## Features

- **Dual Connectivity**: WiFi + 4G (SIM7670G) with automatic fallback
- **Device Pairing**: Secure server pairing with token-based authentication
- **WebSocket Connection**: Real-time bidirectional communication with server
- **Media Capture**: Photos (JPEG), video (MJPEG), audio (WAV) recording and upload
- **GPS Telemetry**: GNSS tracking from SIM7670G modem
- **Remote Commands**: Reboot, firmware update, photo capture, status queries
- **Offline Resilience**: SD card queuing for offline data persistence
- **Telemetry**: Battery voltage, signal strength, heap usage, uptime monitoring
- **Watchdog Timer**: Auto-reboot on hang/crash detection
- **Status Indicator**: LED feedback (connection, error states)

## Hardware Requirements

### Board
- **Waveshare ESP32-S3-SIM7670G-4G** (verified, recommended)
- **ESP32-S3** microcontroller (dual-core 240MHz, 2MB PSRAM, 16MB Flash)
- **SIM7670G** 4G/LTE Cat-1 modem with GNSS
- **OV2640** camera module (included in package, requires ribbon cable connection and DIP switch)
- Nano SIM card slot (LTE data plan required for cellular/GPS)

### Optional
- **I2S MEMS microphone** (INMP441 or similar, for audio recording)
- **microSD card** (for offline data storage -- pins conflict with camera on this board)
- **LiPo battery** (3.7V, connects to battery terminal on board)

## Software Requirements

### Option A: PlatformIO (Recommended)

A `platformio.ini` is included. Install PlatformIO and build:

```bash
pip3 install platformio
cd firmware/esp32_agent
pio run                    # Compile
pio run --target upload    # Flash to /dev/ttyACM4
```

### Option B: Arduino IDE

1. **Install Board Support**
   - Add to `Preferences > Additional Board Manager URLs`:
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Install: **esp32 by Espressif (v2.0.8 or later)**
2. **Board Settings**: ESP32S3 Dev Module, Flash 16MB, DIO, 80MHz, USB CDC on Boot: Disabled
   > **Warning:** Do NOT set PSRAM to "OPI PSRAM" in PlatformIO (`qio_opi` memory type). This crashes the board. Use default PSRAM settings. Camera works in DRAM mode.
3. **Install Libraries**: ArduinoJson 6.x, WebSockets 2.x, esp32-camera

### Required Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| **ArduinoJson** | ^6.21.0 | JSON parsing/serialization |
| **WebSockets** (links2004) | ^2.4.1 | Real WebSocket client with TLS |
| **esp32-camera** (espressif) | ^2.0.0 | Camera DVP driver |
| **HTTPClient** | (built-in) | HTTP requests for pairing/upload |
| **WiFiClientSecure** | (built-in) | HTTPS support |

## Pin Definitions (Waveshare ESP32-S3-SIM7670G-4G)

> These pin assignments are **verified and tested** on the Waveshare ESP32-S3-SIM7670G-4G board.

### UART - SIM7670G Modem
| Signal | GPIO | Notes |
|--------|------|-------|
| TX (to modem) | **18** | MODEM_TX_PIN |
| RX (from modem) | **17** | MODEM_RX_PIN |
| Power Control | **33** | MODEM_POWER_PIN |
| Baud Rate | 115200 | 5 retry attempts on boot |

### Camera - OV2640 DVP Interface (Verified Working)
| Signal | GPIO | Notes |
|--------|------|-------|
| XCLK | **39** | Master clock (20MHz) |
| PCLK | **46** | Pixel clock |
| VSYNC | **42** | Vertical sync |
| HREF | **41** | Horizontal reference |
| SIOD (SDA) | **15** | I2C data (SCCB) |
| SIOC (SCL) | **16** | I2C clock (SCCB) |
| Y2-Y9 (D0-D7) | **7,8,9,10,11,12,13,14** | 8-bit parallel data |

> **Important**: Camera pins GPIO10-13 overlap with SD card SPI pins. Use SDMMC mode (pins 4/5/6) for SD card to avoid conflict.

> **DIP Switch**: The CAM switch on the back of the board must be ON.

> **PSRAM Warning**: Do NOT set `board_build.arduino.memory_type = qio_opi` in PlatformIO. This crashes `esp_camera_init()`. Use default memory settings — camera works in DRAM mode (SVGA, ~30-80KB JPEG).

### GPIO - Status & Control
| Function | GPIO | Notes |
|----------|------|-------|
| Battery ADC | **1** | GPIO1 (ADC1_CH0) |
| Status LED | -1 | Disabled (GPIO7 used by camera D0) |

## Configuration

Edit `config.h` to customize:

```cpp
// Network
#define WIFI_SSID         "YourSSID"
#define WIFI_PASSWORD     "YourPassword"

// Server (local development -- for ngrok/production, use SSL mode)
#define SERVER_HOST       "192.168.x.x"   // Your host machine LAN IP
#define SERVER_PORT       50081            // WS server port
#define SERVER_PORT_HTTP  50300            // Web API port
#define USE_SSL           0               // 0=local HTTP/WS, 1=ngrok HTTPS/WSS

// Pairing -- get this from the dashboard after creating a device
#define PAIRING_CODE      "XXXXXX"

// Features
#define ENABLE_CAMERA     1   // OV2640 verified working (DIP switch CAM must be ON)
#define ENABLE_GPS        1
#define ENABLE_SD_CARD    0   // Pins conflict with camera
#define ENABLE_WATCHDOG   1
```

### Local vs Production

For **local development** (device on same LAN as server):
- `SERVER_HOST` = your workstation IP (e.g., `192.168.0.19`)
- `SERVER_PORT` = `50081`, `SERVER_PORT_HTTP` = `50300`
- `USE_SSL` = `0`

For **production** (through ngrok or public server):
- `SERVER_HOST` = `nodefleet.ngrok.dev` (or your domain)
- `SERVER_PORT` = `443`
- `USE_SSL` = `1`

// Debug
#define DEBUG_SERIAL      1
#define DEBUG_LEVEL       2  // 0=off, 1=error, 2=info, 3=verbose
```

### Server Auto-Discovery

The NodeFleet server supports automatic discovery on the local network. Instead of hardcoding the server IP, the firmware can discover it automatically:

1. **mDNS**: Resolve `nodefleet.local` using `ESPmDNS.h`
2. **UDP Broadcast**: Send `NODEFLEET_DISCOVER` to `255.255.255.255:5555` and parse the JSON response
3. **Fallback**: Use the hardcoded `WS_SERVER_URL` from `config.h`

See the [Device Discovery documentation](../../docs/DEVICE_DISCOVERY.md) for complete implementation code and protocol details.

## Network Scan Responder

The NodeFleet dashboard can scan the local network to discover ESP32 devices before they are paired. To support this, the firmware should listen on UDP port 5556 for a `NODEFLEET_ESP32_SCAN` message and respond with device information.

### Implementation

Add the scan responder to your firmware:

1. **Initialize in `setup()`** -- Call `scanUdp.begin(5556)` after WiFi is connected.
2. **Poll in `loop()`** -- Check for incoming UDP packets on port 5556 each loop iteration.
3. **Respond with JSON** -- When a packet containing `NODEFLEET_ESP32_SCAN` arrives, reply with:

```json
{
  "serialNumber": "SN-ESP32-001",
  "hwModel": "ESP32-S3",
  "firmware": "1.0.0",
  "status": "ready",
  "ip": "192.168.1.50"
}
```

| Field | Type | Description |
|-------|------|-------------|
| serialNumber | string | Device serial number (from `config.h` or NVS) |
| hwModel | string | Hardware model (e.g., `"ESP32-S3"`) |
| firmware | string | Current firmware version string |
| status | string | `"ready"` if unpaired, `"paired"` if already paired |
| ip | string | Device's current WiFi IP address |

### Example Code

```cpp
#include <WiFiUdp.h>
#include <ArduinoJson.h>

#define SCAN_PORT 5556
#define SCAN_MAGIC "NODEFLEET_ESP32_SCAN"

WiFiUDP scanUdp;

void setupScanResponder() {
  scanUdp.begin(SCAN_PORT);
}

void handleScanRequests() {
  int packetSize = scanUdp.parsePacket();
  if (packetSize <= 0) return;

  char buf[64];
  int len = scanUdp.read(buf, sizeof(buf) - 1);
  buf[len] = '\0';
  if (strcmp(buf, SCAN_MAGIC) != 0) return;

  StaticJsonDocument<256> doc;
  doc["serialNumber"] = DEVICE_SERIAL;
  doc["hwModel"]      = DEVICE_HW_MODEL;
  doc["firmware"]     = FIRMWARE_VERSION;
  doc["status"]       = isPaired ? "paired" : "ready";
  doc["ip"]           = WiFi.localIP().toString();

  char resp[256];
  serializeJson(doc, resp, sizeof(resp));

  scanUdp.beginPacket(scanUdp.remoteIP(), scanUdp.remotePort());
  scanUdp.print(resp);
  scanUdp.endPacket();
}
```

Call `setupScanResponder()` in `setup()` after WiFi connects, and `handleScanRequests()` at the top of `loop()`. See the [Device Discovery documentation](../../docs/DEVICE_DISCOVERY.md) for the full protocol specification.

---

## First Boot & Provisioning

### Step 1: Flash Firmware
1. Connect ESP32-S3 to computer via USB
2. Open `esp32_agent.ino` in Arduino IDE
3. Select correct board and COM port
4. Click **Upload**
5. Open Serial Monitor (115200 baud) to see boot messages

### Step 2: Generate Pairing Code
On your NodeFleet server, generate a device pairing code.

### Step 3: Set Pairing Code
Option A: Update firmware config
- Edit `#define PAIRING_CODE "YOUR_CODE"` in `config.h`
- Re-upload firmware

Option B: Send via serial command
- Open Serial Monitor, send: `AT+PAIR=YOUR_CODE`
- Code is stored in NVS and persists across reboots

### Step 4: Connect WiFi
1. Board automatically connects to configured WiFi SSID
2. Check Serial Monitor for `WiFi connected!` message
3. Device will attempt pairing when connection established

### Step 5: Verify Pairing
1. Check server dashboard for new device
2. Serial output will show: `Device paired successfully! Token: xxx...`
3. LED indicator will change to steady (connected)

## Communication Protocol

### Device Pairing (One-time)

**Request:**
```json
POST /api/devices/pair
{
  "pairingCode": "ABC123"
}
```

The pairing code is the 6-character code returned when the device was created in the dashboard. It expires 24 hours after creation.

**Response:**
```json
{
  "token": "eyJhbGc...",
  "deviceId": "clx...",
  "orgId": "clx...",
  "deviceName": "Lobby Display",
  "wsUrl": "ws://server.com:8081"
}
```

### WebSocket Connection
```
wss://server.com/device?token=eyJhbGc...
```

### Message Format - Heartbeat
```json
{
  "type": "heartbeat",
  "token": "eyJhbGc...",
  "battery_voltage": 4.15,
  "signal_strength": -95,
  "free_heap": 65536,
  "uptime_ms": 3600000,
  "timestamp": 1234567890
}
```

### Message Format - GPS
```json
{
  "type": "gps",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "altitude": 52.5,
  "accuracy": 10.0,
  "timestamp": 1234567890
}
```

### Incoming Command - Photo Capture
```json
{
  "type": "command",
  "id": "cmd_001",
  "command": "capture_photo"
}
```

**Response:**
```json
{
  "type": "command_ack",
  "command_id": "cmd_001",
  "success": true,
  "message": "Photo captured and uploaded"
}
```

## Remote Commands

### `capture_photo`
Capture a single JPEG photo and upload to server.
```json
{"command": "capture_photo"}
```

### `capture_video`
Record 1-second MJPEG video and upload.
```json
{"command": "capture_video"}
```

### `record_audio`
Record 5 seconds of audio (requires I2S microphone).
```json
{"command": "record_audio"}
```

### `reboot`
Immediately restart device.
```json
{"command": "reboot"}
```

### `update_firmware`
OTA firmware update from URL.
```json
{"command": "update_firmware", "url": "https://server.com/firmware.bin"}
```

### `get_status`
Request full status report.
```json
{"command": "get_status"}
```

### `set_config`
Update device configuration in NVS.
```json
{"command": "set_config", "key": "config_name", "value": "new_value"}
```

## LED Status Patterns

| State | Pattern | Meaning |
|-------|---------|---------|
| Off | LED off | Device powered off or not initialized |
| Steady | LED on | Connected to server, paired |
| Slow blink (1Hz) | Blink every 500ms | Connecting to WiFi/4G |
| Fast blink (2Hz) | Blink every 250ms | Error/pairing failed |

## Troubleshooting

### Serial Output Shows "Modem not responding"
- Check TX/RX pins are correct
- Verify modem is powered (check MODEM_POWER_PIN)
- Check baud rate (115200)
- Inspect solder connections on UART pins

### WiFi Fails to Connect
- Verify SSID and password in `config.h`
- Check WiFi signal strength
- Ensure 2.4GHz band (ESP32-S3 doesn't support 5GHz)
- Check if WiFi requires MAC filtering

### No GPS Fix
- Ensure GPS is enabled: `#define ENABLE_GPS 1`
- Wait 30-60 seconds for initial lock
- Move to open sky (GPS needs clear view)
- Check antenna connection

### SD Card Not Found
- Verify card is inserted and contacts are clean
- Check CS pin wiring (default GPIO10)
- Format card to FAT32 (max 32GB)
- Test with separate microcontroller if possible

### Device Not Pairing
- Verify pairing code is correct
- Check server endpoint is reachable: `ping SERVER_HOST`
- Ensure server cert is valid (HTTPS)
- Check logs: `Serial.println()` statements

### High Power Consumption
- Disable unused features in `config.h`:
  ```cpp
  #define ENABLE_CAMERA 0
  #define ENABLE_GPS    0
  #define ENABLE_AUDIO  0
  ```
- Reduce heartbeat interval
- Enable WiFi sleep mode between transmissions

## OTA Firmware Updates

### Server Endpoint Format
```
GET /firmware/latest.bin
```

The device will:
1. Request firmware URL from server
2. Download binary in chunks
3. Verify firmware integrity (CRC)
4. Flash to OTA partition
5. Reboot into new firmware
6. Fallback to previous version if boot fails

## Security Considerations

- **Device Token**: Stored in NVS, never log it
- **HTTPS/WSS**: Always use encrypted connections
- **Pairing Code**: Change default codes in production
- **Firmware Updates**: Verify signatures before installation
- **Offline Data**: Encrypt sensitive data on SD card

## Performance Specifications

| Metric | Value |
|--------|-------|
| Heartbeat Interval | 30 seconds |
| GPS Update Interval | 60 seconds |
| Max Photo Size | ~500KB (JPEG, VGA) |
| Max Video Duration | ~5 seconds (1FPS) |
| Offline Queue Capacity | 20 files |
| Watchdog Timeout | 120 seconds |

## File Structure

```
esp32_agent/
├── esp32_agent.ino          # Main sketch
├── config.h                 # Configuration header
├── modem.h / modem.cpp      # SIM7670G driver
├── camera.h / camera.cpp    # Camera interface
├── storage.h / storage.cpp  # SD/NVS storage
├── websocket_client.h / websocket_client.cpp  # WebSocket client
└── README.md               # This file
```

## Library License Notes

- **ArduinoJson**: MIT License
- **WebSocketsClient**: LGPL 2.1
- **Espressif ESP32 Core**: Apache 2.0

## Support & Issues

For issues or feature requests:
1. Check Serial Monitor for error messages
2. Review `config.h` settings
3. Verify hardware connections
4. Check GitHub issues at: `github.com/nodefleet/esp32-agent`

## Version History

- **v1.0.0** - Initial release
  - WiFi + 4G connectivity
  - Device pairing
  - WebSocket client
  - Photo/video/audio capture
  - GPS telemetry
  - SD card offline queue
  - Watchdog timer
  - Remote commands

---

**Last Updated**: 2026-03-21
**Firmware Version**: 1.0.0
**Compatible Boards**: Waveshare ESP32-S3 SIM7670G
