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
// Server Configuration
// ============================================================================
#define SERVER_HOST       "192.168.0.19"
#define SERVER_PORT       50081  // WS server port (local)
#define SERVER_PORT_HTTP  50300  // Web server port (local)
#define DEVICE_PAIR_URL   "/api/devices/pair"
#define DEVICE_WS_URL     "/device"  // WebSocket endpoint
#define USE_SSL           0  // 0 = plain HTTP/WS (local), 1 = HTTPS/WSS (ngrok)

// ============================================================================
// Pairing & Device Identity
// ============================================================================
#define PAIRING_CODE      "TZ56MW"  // Set during provisioning
#define DEVICE_MODEL      "Waveshare-ESP32-S3-SIM7670G"
#define FIRMWARE_VERSION  "1.0.0"

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

// SD Card (SPI mode)
#define SD_MOSI           11  // GPIO11
#define SD_MISO           13  // GPIO13
#define SD_CLK            12  // GPIO12
#define SD_CS             10  // GPIO10 (Chip Select)

// Status LED (GPIO7 used by camera D0, use GPIO38 or -1)
#define STATUS_LED_PIN    -1  // Disabled - GPIO7 used by camera

// I2S Microphone (for audio recording)
#define I2S_BCK_PIN       -1  // Bit clock
#define I2S_WS_PIN        -1  // Word select
#define I2S_DIN_PIN       -1  // Data in

// ADC for battery voltage
// Waveshare ESP32-S3-SIM7670G battery ADC on GPIO1 (ADC1_CH0)
#define BATTERY_ADC_PIN   1   // GPIO1
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
#define ENABLE_CAMERA     0  // Disabled until camera ribbon cable is verified
#define ENABLE_AUDIO      0  // Requires I2S mic hardware
#define ENABLE_SD_CARD    0  // Disabled - pins conflict with camera (GPIO10-13)
#define ENABLE_NVS        1
#define ENABLE_WATCHDOG   1
#define WATCHDOG_TIMEOUT_MS 120000  // 2 minutes

// ============================================================================
// Debug & Logging
// ============================================================================
#define DEBUG_SERIAL      1
#define DEBUG_LEVEL       2  // 0=none, 1=error, 2=info, 3=verbose

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
