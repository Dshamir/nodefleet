#ifndef CONFIG_H
#define CONFIG_H

// ============================================================================
// Network Configuration
// ============================================================================
#define WIFI_SSID         "ASUS"
#define WIFI_PASSWORD     "adminadmin"
#define USE_WIFI          1  // 1 = try WiFi first, 0 = skip WiFi
#define USE_4G            1  // 1 = try 4G modem, 0 = skip 4G

// ============================================================================
// Server Configuration — Local (WiFi direct)
// ============================================================================
#define SERVER_HOST       "192.168.0.19"
#define SERVER_PORT       50081  // WS server port (local)
#define SERVER_PORT_HTTP  50300  // Web server port (local)
#define DEVICE_PAIR_URL   "/api/devices/pair"
#define DEVICE_WS_URL     "/device"  // WebSocket endpoint
#define USE_SSL           0  // 0 = plain HTTP/WS (local), 1 = HTTPS/WSS (ngrok)

// ============================================================================
// Server Configuration — Remote (ngrok/LTE)
// ============================================================================
#define NGROK_DOMAIN      "nodefleet.ngrok.dev"
#define NGROK_PORT        443   // HTTPS/WSS through ngrok
// Connection mode: "auto" = try local first, fall back to remote
//                  "local" = always use SERVER_HOST (WiFi only)
//                  "remote" = always use NGROK_DOMAIN (LTE/remote)
#define CONNECTION_MODE   "auto"

// ============================================================================
// MQTT Configuration
// ============================================================================
#define MQTT_BROKER_HOST  "192.168.0.19"
#define MQTT_BROKER_PORT  51883
#define MQTT_TOPIC_PREFIX "nodefleet/"
#define MQTT_PUBLISH_INTERVAL_MS 30000  // Same as heartbeat
#define USE_MQTT          1  // 1 = publish telemetry to MQTT broker

// ============================================================================
// WiFi Provisioning (AP mode for first-time setup)
// ============================================================================
#define AP_SSID           "NodeFleet-Setup"
#define AP_PASSWORD       "nodefleet"
#define AP_PORTAL_PORT    80
#define ENABLE_WIFI_PROVISION 1  // 1 = start AP if WiFi fails

// ============================================================================
// OTA Configuration
// ============================================================================
#define OTA_CHECK_URL     ""  // Server URL to check for firmware updates (set via set_config)
#define OTA_CHECK_INTERVAL_MS 3600000  // Check every 1 hour
#define ENABLE_AUTO_OTA   0  // 1 = auto-check for updates, 0 = manual only

// ============================================================================
// Pairing & Device Identity
// ============================================================================
#define PAIRING_CODE      "9KA7BZ"  // Set during provisioning
#define DEVICE_MODEL      "Waveshare-ESP32-S3-SIM7670G"
#define FIRMWARE_VERSION  "1.1.0"

// ============================================================================
// Heartbeat & Telemetry Intervals (milliseconds)
// ============================================================================
#define HEARTBEAT_INTERVAL_MS    30000    // 30 seconds
#define GPS_UPDATE_INTERVAL_MS   60000    // 60 seconds
#define STATUS_REPORT_INTERVAL_MS 300000  // 5 minutes

// ============================================================================
// Pin Definitions - Waveshare ESP32-S3 SIM7670G
// ============================================================================

// UART for SIM7670G Modem (Serial1)
// Waveshare ESP32-S3-SIM7670G uses GPIO17(RX)/GPIO18(TX)
#define MODEM_RX_PIN      17  // GPIO17 (RX from modem)
#define MODEM_TX_PIN      18  // GPIO18 (TX to modem)
#define MODEM_BAUD        115200
#define MODEM_POWER_PIN   33  // Power control
#define MODEM_RESET_PIN   -1  // Reset control (if available)

// Camera pins - Waveshare ESP32-S3-SIM7670G-4G (OV2640/OV5640 DVP)
#define CAMERA_SIOD       15  // I2C SDA
#define CAMERA_SIOC       16  // I2C SCL
#define CAM_PIN_Y9        14  // D7
#define CAM_PIN_Y8        13  // D6
#define CAM_PIN_Y7        12  // D5
#define CAM_PIN_Y6        11  // D4
#define CAM_PIN_Y5        10  // D3
#define CAM_PIN_Y4         9  // D2
#define CAM_PIN_Y3         8  // D1
#define CAM_PIN_Y2         7  // D0
#define CAMERA_VSYNC      42  // VSYNC
#define CAMERA_HREF       41  // HREF
#define CAMERA_PCLK       46  // PCLK
#define CAMERA_XCLK       39  // XCLK
#define CAMERA_PWDN       -1  // Not used
#define CAMERA_RESET      -1  // Not used

// SD Card (SPI mode - disabled, pins conflict with camera when enabled)
#define SD_MOSI           11  // GPIO11
#define SD_MISO           13  // GPIO13
#define SD_CLK            12  // GPIO12
#define SD_CS             10  // GPIO10

// Status LED
#define STATUS_LED_PIN    7   // GPIO7

// I2S Microphone — INMP441 MEMS (arriving Monday)
// Connect: VDD→3.3V, GND→GND, SD→DIN, SCK→BCK, WS→WS, L/R→GND(left channel)
#define I2S_BCK_PIN       2   // Bit clock (GPIO2)
#define I2S_WS_PIN        3   // Word select / LRCLK (GPIO3)
#define I2S_DIN_PIN       1   // Data in / SD (GPIO1)
#define I2S_SAMPLE_RATE   16000
#define I2S_BITS          16
#define I2S_CHANNELS      1   // Mono
#define AUDIO_DURATION_S  5   // Default recording duration

// ADC for battery voltage
// GPIO0 is not valid ADC on ESP32-S3. Use AT+CBC via modem or MAX17048 I2C fuel gauge.
#define BATTERY_ADC_PIN   -1  // Disabled - use modem AT+CBC for battery level
#define BATTERY_ADC_CHANNEL ADC1_CHANNEL_0

// ============================================================================
// Buffer Sizes & Limits
// ============================================================================
#define MAX_PAYLOAD_SIZE  4096
#define GPS_BUFFER_SIZE   256
#define COMMAND_BUFFER_SIZE 512
#define PHOTO_BUFFER_SIZE 65536  // 64KB for JPEG frame
#define AUDIO_BUFFER_SIZE 32768  // 32KB for audio chunk
#define OFFLINE_QUEUE_MAX_FILES 20

// ============================================================================
// Features
// ============================================================================
#define ENABLE_GPS        1
#define ENABLE_CAMERA     1  // OV2640 DVP - pins from branch-to-merge
#define ENABLE_AUDIO      0  // Requires I2S mic hardware
#define ENABLE_SD_CARD    0  // Disabled - SDMMC crashes without card inserted
#define ENABLE_NVS        1
#define ENABLE_WATCHDOG   1
#define WATCHDOG_TIMEOUT_MS 120000  // 2 minutes

// ============================================================================
// Debug & Logging
// ============================================================================
#define DEBUG_SERIAL      1
#define DEBUG_LEVEL       4  // 0=none, 1=error, 2=warn, 3=info, 4=verbose

#if DEBUG_SERIAL
  #define LOG_ERROR(fmt, ...) do { if(DEBUG_LEVEL >= 1) Serial.printf("[ERROR] " fmt "\n", ##__VA_ARGS__); } while(0)
  #define LOG_WARN(fmt, ...)  do { if(DEBUG_LEVEL >= 1) Serial.printf("[WARN] " fmt "\n", ##__VA_ARGS__); } while(0)
  #define LOG_INFO(fmt, ...)  do { if(DEBUG_LEVEL >= 2) Serial.printf("[INFO] " fmt "\n", ##__VA_ARGS__); } while(0)
  #define LOG_VERBOSE(fmt, ...)  do { if(DEBUG_LEVEL >= 3) Serial.printf("[VERBOSE] " fmt "\n", ##__VA_ARGS__); } while(0)
#else
  #define LOG_ERROR(fmt, ...)
  #define LOG_WARN(fmt, ...)
  #define LOG_INFO(fmt, ...)
  #define LOG_VERBOSE(fmt, ...)
#endif

#endif // CONFIG_H
