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
- **Waveshare ESP32-S3** with SIM7670G modem integration
- **ESP32-S3** microcontroller (dual-core, 2.4GHz WiFi)
- **SIM7670G** 4G/LTE modem with GNSS

### Optional
- **OV2640/OV5640** camera module (for photo/video capture)
- **I2S MEMS microphone** (for audio recording)
- **microSD card** (for offline data storage, 4GB+ recommended)
- **LiPo battery** with fuel gauge (recommended: 3000-5000mAh)

## Software Requirements

### Arduino IDE Setup

1. **Install Board Support**
   - Add to `Preferences → Additional Board Manager URLs`:
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Install: **esp32 by Espressif (v2.0.8 or later)**

2. **Select Board**
   - `Tools → Board → ESP32 → ESP32S3 Dev Module`

3. **Board Configuration**
   - USB CDC on Boot: **Enabled** (for Serial output)
   - Core Debug Level: **Verbose** (for debugging)
   - Partition Scheme: **Default 4MB with spiffs**
   - Flash Mode: **QIO**
   - Flash Frequency: **80MHz**

### Required Libraries

Install via `Sketch → Include Library → Manage Libraries`:

| Library | Version | Purpose |
|---------|---------|---------|
| **ArduinoJson** | 6.19.x+ | JSON parsing/serialization |
| **WebSocketsClient** | 2.3.0+ | WebSocket client (optional for advanced features) |
| **HTTPClient** | (built-in) | HTTP requests |
| **WiFi** | (built-in) | WiFi connectivity |
| **SD** | (built-in) | SD card access |
| **SPIFFS** | (built-in) | Flash filesystem |
| **esp_camera** | (with ESP32 core) | Camera driver |

## Pin Definitions

### UART - SIM7670G Modem
| Signal | GPIO | Pin Config |
|--------|------|-----------|
| TX (to modem) | 8 | MODEM_TX_PIN |
| RX (from modem) | 9 | MODEM_RX_PIN |
| Power Control | (none) | MODEM_POWER_PIN |
| Reset Control | (none) | MODEM_RESET_PIN |

### SPI - SD Card
| Signal | GPIO | Pin Config |
|--------|------|-----------|
| MOSI | 11 | SD_MOSI |
| MISO | 13 | SD_MISO |
| CLK | 12 | SD_CLK |
| CS | 10 | SD_CS |

### GPIO - Status & Control
| Function | GPIO | Pin Config |
|----------|------|-----------|
| Status LED | 7 | STATUS_LED_PIN |
| Battery ADC | 0 | BATTERY_ADC_PIN |

### Camera (if enabled)
> **Note**: Camera pin definitions are placeholders. Actual pins depend on your camera module and PCB design. Consult Waveshare documentation.

| Signal | GPIO | Pin Config |
|--------|------|-----------|
| D0-D7 | varies | CAMERA_D0-D7 |
| VSYNC | varies | CAMERA_VSYNC |
| HREF | varies | CAMERA_HREF |
| PCLK | varies | CAMERA_PCLK |
| XCLK | varies | CAMERA_XCLK |
| SDA (I2C) | varies | CAMERA_SIOD |
| SCL (I2C) | varies | CAMERA_SIOC |

### I2S Microphone (if enabled)
| Signal | GPIO | Pin Config |
|--------|------|-----------|
| BCLK | varies | I2S_BCK_PIN |
| WS (LRCLK) | varies | I2S_WS_PIN |
| DIN | varies | I2S_DIN_PIN |

## Configuration

Edit `config.h` to customize:

```cpp
// Network Configuration
#define WIFI_SSID         "YourSSID"
#define WIFI_PASSWORD     "YourPassword"
#define USE_WIFI          1  // Enable WiFi
#define USE_4G            1  // Enable 4G modem

// Server Configuration
#define SERVER_HOST       "nodefleet.example.com"
#define SERVER_PORT       443
#define DEVICE_PAIR_URL   "/api/devices/pair"
#define DEVICE_WS_URL     "/device"

// Pairing
#define PAIRING_CODE      "PROVISIONED_CODE"

// Intervals
#define HEARTBEAT_INTERVAL_MS    30000   // 30 seconds
#define GPS_UPDATE_INTERVAL_MS   60000   // 60 seconds

// Features
#define ENABLE_GPS        1
#define ENABLE_CAMERA     1
#define ENABLE_AUDIO      0
#define ENABLE_SD_CARD    1
#define ENABLE_WATCHDOG   1

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
  "pairing_code": "ABC123",
  "device_model": "Waveshare-ESP32-S3-SIM7670G",
  "firmware_version": "1.0.0"
}
```

**Response:**
```json
{
  "device_token": "eyJhbGc...",
  "device_id": "dev_12345",
  "ws_url": "wss://server.com/device"
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
