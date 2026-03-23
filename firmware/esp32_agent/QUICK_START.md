# Quick Start Guide - NodeFleet ESP32 Agent

## 1. Prerequisites

- Waveshare ESP32-S3 SIM7670G board
- USB cable
- Arduino IDE (latest version)
- WiFi network details (SSID/password)
- NodeFleet server pairing code

## 2. Install Arduino IDE & Board Support

### A. Install Arduino IDE
Download from: https://www.arduino.cc/en/software

### B. Add ESP32 Board Support
1. Open Arduino IDE
2. Go to **File → Preferences**
3. Paste this URL in "Additional Board Manager URLs":
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Click **OK**
5. Go to **Tools → Board → Boards Manager**
6. Search for "esp32" and install the latest version by Espressif
7. Close Boards Manager

### C. Install Required Libraries
1. Go to **Sketch → Include Library → Manage Libraries**
2. Search and install:
   - **ArduinoJson** (latest)
   - **WebSocketsClient** (optional, for advanced features)

## 3. Download & Open Firmware

1. Extract the `esp32_agent` folder
2. Open `esp32_agent.ino` in Arduino IDE
3. All other files (`.h`, `.cpp`) will automatically be included as tabs

## 4. Configure for Your Environment

Edit **`config.h`** and update:

```cpp
// Your WiFi credentials
#define WIFI_SSID         "YOUR_NETWORK_NAME"
#define WIFI_PASSWORD     "YOUR_PASSWORD"

// Your NodeFleet server
#define SERVER_HOST       "your-server.com"
#define SERVER_PORT       443

// Your provisioning code from NodeFleet
#define PAIRING_CODE      "ABC123XYZ"
```

**Automatic Server Discovery**: If your server is on the same LAN, the device can find it automatically via UDP broadcast or mDNS (nodefleet.local). See [Device Discovery](../../docs/DEVICE_DISCOVERY.md) for setup.

## 5. Board Selection

In Arduino IDE:
1. **Tools → Board → ESP32 → ESP32S3 Dev Module**
2. **Tools → USB CDC on Boot → Enabled**
3. **Tools → Core Debug Level → Verbose** (for debugging)
4. Select your COM port under **Tools → Port**

## 6. Flash Firmware

1. Connect ESP32-S3 to computer via USB
2. Click **Upload** (or Ctrl+U)
3. Wait for "Leaving... Hard resetting via RTS pin"
4. Open **Tools → Serial Monitor** (115200 baud)
5. You should see boot messages

Example successful boot:
```
===============================================
NodeFleet ESP32 Agent Booting
Firmware Version: 1.0.0
Device Model: Waveshare-ESP32-S3-SIM7670G
===============================================
Initializing hardware
Initializing WiFi
Connecting to WiFi: YOUR_NETWORK_NAME
WiFi connected! IP: 192.168.1.100
Attempting device pairing with code: ABC123XYZ
Device paired successfully! Token: eyJhbGc...
Setup complete, entering main loop
```

## 7. Verify Connection

In Serial Monitor, you should see:
- ✅ **Initializing hardware** - GPIO pins set up
- ✅ **WiFi connected** - Internet connectivity established
- ✅ **Device paired successfully** - Server communication working
- ✅ **Heartbeat sent** - Regular telemetry being transmitted

## 8. Test Commands

Once paired, your NodeFleet server can send commands. Examples:

### Capture a photo
```json
{"command": "capture_photo", "id": "cmd_001"}
```
→ Device will take a photo and upload it

### Get device status
```json
{"command": "get_status", "id": "cmd_002"}
```
→ Device will report battery, signal, heap, uptime

### Reboot device
```json
{"command": "reboot", "id": "cmd_003"}
```
→ Device will restart immediately

### Update firmware
```json
{"command": "update_firmware", "url": "https://your-server.com/firmware.bin", "id": "cmd_004"}
```
→ Device will download and flash new firmware

## 9. Common Issues & Fixes

### Problem: Serial Monitor shows nothing
- **Solution**: Check USB cable, try different port, enable "USB CDC on Boot"

### Problem: "Modem not responding"
- **Solution**: Check TX/RX pins are connected correctly, verify baud rate (115200)

### Problem: "WiFi connection failed"
- **Solution**: Verify SSID/password in config.h, check 2.4GHz (ESP32 doesn't support 5GHz)

### Problem: "Device pairing failed"
- **Solution**: Check pairing code is correct, verify server is reachable, check HTTPS cert

### Problem: "No SD card detected" (optional)
- **Solution**: Verify card is inserted, check CS pin (GPIO10), format as FAT32

## 10. LED Status Indicators

- 🟢 **Solid green** - Device is connected and paired
- 🟡 **Slow blink** - Attempting to connect
- 🔴 **Fast blink** - Error or pairing failed

## 11. Next Steps

1. **Monitor device in NodeFleet server dashboard**
2. **Send commands to capture photos/video**
3. **Check GPS telemetry data**
4. **View battery voltage and signal strength**
5. **Configure automated tasks** (periodic photo capture, etc)

## 12. Optional: Enable Camera & GPS

If your board has camera or GPS hardware:

### Camera Setup
1. Connect camera module (OV2640 or OV5640)
2. In `config.h`, update camera GPIO pins
3. Set `#define ENABLE_CAMERA 1`
4. Re-upload firmware

### GPS Setup
- GPS is built into SIM7670G modem
- Set `#define ENABLE_GPS 1` in `config.h`
- Device will automatically request GPS fixes every 60 seconds

## 13. Enable SD Card Logging (Optional)

If you have a microSD card:
1. Insert microSD (formatted as FAT32)
2. Set `#define ENABLE_SD_CARD 1` in `config.h`
3. Re-upload firmware
4. Device will store photos, videos, and logs to SD card

## Debugging Serial Commands

Send these via Serial Monitor (set Line Ending to "Newline"):

```
AT              → Check modem is responding
AT+CPIN?        → Check SIM status
AT+CREG?        → Check network registration
AT+CSQ          → Get signal strength
AT+CGNSINF      → Get GPS coordinates
```

---

**Ready to go!** Your device should now be connected to NodeFleet. Monitor the Serial output and start sending commands from the server dashboard.

For more detailed information, see **README.md**.
