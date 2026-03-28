# NodeFleet - Compatible Hardware & Alternatives

Last updated: 2026-03-27

This document lists ESP32-based development boards with camera, GPS, and cellular capabilities compatible with the NodeFleet firmware, with availability on Amazon.ca.

---

## Currently Verified Board

### Waveshare ESP32-S3-SIM7670G-4G

| Spec | Value |
|------|-------|
| **Price** | ~CAD $75-85 |
| **Amazon.ca** | [B0CVVX749F](https://www.amazon.ca/dp/B0CVVX749F) |
| **Processor** | ESP32-S3R2 (Xtensa LX7 dual-core, 240MHz) |
| **Memory** | 512KB SRAM, 2MB PSRAM (OPI), 16MB Flash |
| **Camera** | OV2640 included (1600x1200 @ 15fps) |
| **Cellular** | SIM7670G (LTE Cat-1, global bands) |
| **GPS/GNSS** | Built-in via SIM7670G (ceramic antenna included) |
| **WiFi** | 2.4GHz 802.11 b/g/n |
| **Bluetooth** | BLE 5.0 |
| **Audio** | Basic onboard mic + speaker (AT command telephony only) |
| **Battery** | 18650 holder + solar charging interface |
| **USB** | Type-C (programming + modem access via CH343/CH334 hub) |

**Package contents:** Board, acrylic case, GNSS ceramic antenna, OV2640 camera, FPC antenna, pin headers, USB cable, screwdriver, double-sided tape.

**Verified firmware features:** WiFi, WebSocket, LTE registration, GPS (AT+CGPSINFO), heartbeat telemetry (→ PostgreSQL), remote commands (REST → Redis → WebSocket → device → ack → DB), NVS token persistence.

**Camera status:** I2C/SCCB init succeeds, but `esp_camera_fb_get()` returns NULL. DVP data path not producing frames. Upload pipeline is coded and the presigned URL flow works — blocked only by capture.

**Known issues on this board:**
- `board_build.arduino.memory_type = qio_opi` in PlatformIO crashes the board — must use default memory config
- PSRAM not detected with default config (`psramFound()` returns false). Camera runs in DRAM/QVGA mode
- Camera frame capture fails even though init succeeds — likely DIP switch configuration or ribbon cable data pin contact issue
- Modem UART pins are GPIO17 (RX) / GPIO18 (TX), NOT GPIO8/9 as commonly documented
- Modem power pin is GPIO33
- Camera and SPI SD card pins conflict (GPIO10-13) -- use SDMMC mode (pins 4/5/6) for SD
- SIM card detection intermittent on first AT probe (retry loop needed, usually works on attempt 2)
- No VoLTE support on SIM7670G -- microphone/speaker limited to basic AT telephony
- Battery monitoring via GPIO ADC doesn't work (GPIO0 invalid on ESP32-S3) -- use MAX17048 I2C fuel gauge (0x36) or AT+CBC

---

## Alternative Boards (Amazon.ca Available)

### 1. LILYGO T-SIM7670G-S3

| Spec | Value |
|------|-------|
| **Price** | ~CAD $50-65 |
| **Amazon.ca** | [B0D6K75W57](https://www.amazon.ca/dp/B0D6K75W57) |
| **Processor** | ESP32-S3 (240MHz dual-core) |
| **Memory** | 16MB Flash + 8MB PSRAM |
| **Camera** | OV series compatible (camera interface, module sold separately) |
| **Cellular** | SIM7670G (LTE Cat-1) |
| **GPS/GNSS** | GPS + Beidou |
| **Audio** | **No built-in mic** (requires external microphone soldering) |
| **Battery** | Not specified |

**Pros:** Cheapest option, 8MB PSRAM (vs 2MB on Waveshare), more documentation/community support.
**Cons:** No built-in microphone, camera module not included, battery support unclear.
**Firmware compatibility:** Pin mapping changes required (MODEM_TX=4, MODEM_RX=5, PWRKEY=46, DTR=7). Camera pins will differ.

### 2. Waveshare ESP32-S3-A7670E-4G

| Spec | Value |
|------|-------|
| **Price** | ~CAD $65-80 |
| **Amazon.ca** | Search "ESP32-S3 A7670E 4G" |
| **Processor** | ESP32-S3R8 (8MB PSRAM) |
| **Camera** | Onboard camera interface |
| **Cellular** | A7670E-FASE (LTE Cat-1 + 2G GSM fallback) |
| **GPS/GNSS** | Yes |
| **Audio** | Onboard speaker + microphone |
| **Battery** | Supported |

**Pros:** Has speaker + mic for voice calls/SMS, 2G fallback for better rural coverage, 8MB PSRAM.
**Cons:** A7670E has fewer LTE bands than SIM7670G, less global coverage. Firmware AT commands may differ from SIM7670G.
**Firmware compatibility:** Moderate changes needed -- different modem AT command set for A7670E.

### 3. Raspberry Pi 4 + SIM7600 HAT + Pi Camera

| Spec | Value |
|------|-------|
| **Price** | ~CAD $150-200 total |
| **Amazon.ca** | [SIM7600A-H HAT](https://www.amazon.ca/dp/B07PLTP3M6) + Pi 4 + Pi Camera v2 |
| **Processor** | ARM Cortex-A72 quad-core 1.5GHz |
| **Camera** | Pi Camera v2 (8MP) or v3 (12MP) |
| **Cellular** | SIM7600A-H (LTE Cat-4, up to 150Mbps) |
| **GPS/GNSS** | Yes |
| **Audio** | USB microphone or audio codec |

**Pros:** Much more powerful (runs Linux), Cat-4 LTE (10x faster than Cat-1), excellent camera quality, mature ecosystem.
**Cons:** Higher power consumption (5W vs 0.5W), more expensive, overkill for basic IoT telemetry, not an MCU (different firmware architecture entirely).
**Firmware compatibility:** Not compatible -- would need a completely different agent written in Python or Node.js.

### 4. Quectel BG95-M3 Zero Board

| Spec | Value |
|------|-------|
| **Price** | ~CAD $80-100 |
| **Amazon.ca** | [B0D41TNPP2](https://www.amazon.ca/dp/B0D41TNPP2) |
| **Cellular** | LTE Cat-M1 / Cat-NB2 / EGPRS |
| **GPS/GNSS** | Yes |
| **Camera** | Custom SPI interface (up to 30MP) |

**Pros:** Ultra-low power, designed for IoT, nano SIM.
**Cons:** Cat-M/NB-IoT (very slow data), no WiFi, complex camera setup, small ecosystem, not ESP32.
**Firmware compatibility:** Not compatible -- completely different MCU platform (Quectel).

---

## Feature Comparison Matrix

| Feature | Waveshare SIM7670G | LILYGO T-SIM7670G | A7670E | RPi4 + SIM7600 | BG95-M3 |
|---------|--------------------|--------------------|--------|----------------|---------|
| **Price (CAD)** | $75-85 | $50-65 | $65-80 | $150-200 | $80-100 |
| **Camera** | OV2640 included | Interface only | Interface | Pi Cam 8/12MP | Custom SPI |
| **LTE Speed** | Cat-1 (10Mbps) | Cat-1 (10Mbps) | Cat-1 (10Mbps) | Cat-4 (150Mbps) | Cat-M (~0.3Mbps) |
| **GPS** | Yes | Yes | Yes | Yes | Yes |
| **Audio/Mic** | Basic AT | No (solder) | Speaker+Mic | USB mic | Limited |
| **WiFi** | Yes | Yes | Yes | Yes | No |
| **PSRAM** | 2MB | 8MB | 8MB | N/A (4GB RAM) | N/A |
| **Battery** | 18650 + solar | Unknown | Yes | External | Yes |
| **Power Draw** | ~0.5W | ~0.5W | ~0.5W | ~5W | ~0.1W |
| **Firmware Compat** | Verified | Pin changes | AT changes | Rewrite | Incompatible |

---

## Recommendations

### Best Overall Value
**Waveshare ESP32-S3-SIM7670G-4G** -- The current board. Everything is in the package (camera, antennas, case). Firmware is verified and working. Only issue is camera ribbon cable connection.

### Best for Prototyping on Budget
**LILYGO T-SIM7670G-S3** -- Cheaper, more PSRAM, good community support. But you'll need to buy camera module separately and solder a microphone.

### Best for Audio/Voice Applications
**Waveshare ESP32-S3-A7670E-4G** -- Only board with built-in speaker + microphone. Supports voice calls and SMS. Best for security/intercom use cases.

### Best for High-Quality Imaging
**Raspberry Pi 4 + Pi Camera v3** -- 12MP camera with autofocus, runs full Linux. Overkill for basic IoT but ideal for surveillance, AI vision, or high-res photo capture.

### Best for Battery-Powered Remote Deployment
**Quectel BG95-M3 Zero** -- Ultra-low power (can run for months on battery with solar). But very limited throughput and no ESP32 compatibility.

---

## Adding a New Board

To add support for a new board:

1. Identify the GPIO pin mapping (modem UART, camera DVP, LED, battery ADC)
2. Update `config.h` with the correct pins
3. Verify the modem AT command set (SIM7670G vs A7670E vs SIM7600 differ)
4. Verify the camera connector type and ribbon cable orientation
5. Test with `ENABLE_CAMERA 0` first to verify modem + WiFi + WebSocket
6. Enable camera after verifying I2C communication (camera should respond on address 0x30 or 0x3C)
