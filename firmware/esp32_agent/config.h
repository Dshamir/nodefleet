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
#define SERVER_HOST       "nodefleet.ngrok.dev"
#define SERVER_PORT       443  // HTTPS
#define SERVER_PORT_HTTP  80   // HTTP fallback
#define DEVICE_PAIR_URL   "/api/devices/pair"
#define DEVICE_WS_URL     "/device"  // WebSocket endpoint

// ============================================================================
// Pairing & Device Identity
// ============================================================================
#define PAIRING_CODE      "TZ56MW"  // Set during provisioning
#define DEVICE_MODEL      "ESP32-S3 SIM7670G"
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
#define MODEM_RX_PIN      17   // GPIO9 (RX from modem)
#define MODEM_TX_PIN      18   // GPIO8 (TX to modem)
#define MODEM_BAUD        115200
#define MODEM_POWER_PIN   33  // Power control (if available)
#define MODEM_RESET_PIN   -1  // Reset control (if available)

// Camera pins (ESP32-CAM / OV2640 compatible)
#define CAMERA_SIOD       15  // I2C SDA (if not standard)
#define CAMERA_SIOC       16  // I2C SCL (if not standard)
/*
#define CAMERA_D7         -1  // Data pins
#define CAMERA_D6         -1
#define CAMERA_D5         -1
#define CAMERA_D4         -1
#define CAMERA_D3         -1
#define CAMERA_D2         -1
#define CAMERA_D1         -1
#define CAMERA_D0         -1
*/
#define CAM_PIN_Y9        14
#define CAM_PIN_Y8        13
#define CAM_PIN_Y7        12
#define CAM_PIN_Y6        11
#define CAM_PIN_Y5        10
#define CAM_PIN_Y4         9
#define CAM_PIN_Y3         8
#define CAM_PIN_Y2         7
#define CAMERA_VSYNC      42  // VSYNC signal
#define CAMERA_HREF       41  // HREF signal
#define CAMERA_PCLK       46  // Pixel clock
#define CAMERA_XCLK       39  // Master clock
#define CAMERA_PWDN       -1  // Power down
#define CAMERA_RESET      -1  // Reset

// SD Card (SPI mode)
/*
#define SD_MOSI           4  // GPIO11
#define SD_MISO           6  // GPIO13
#define SD_CLK            5  // GPIO12
#define SD_CS             46  // GPIO10 (Chip Select)
*/
// SD Card pins (GPIO 46 freed for camera PCLK — card detect removed)
#define SDMMC_CLK   5
#define SDMMC_CMD   4
#define SDMMC_DATA  6
#define SD_CS       -1

// Status LED
#define STATUS_LED_PIN    7   // GPIO7 (or onboard LED)

// I2S Microphone (for audio recording)
#define I2S_BCK_PIN       -1  // Bit clock
#define I2S_WS_PIN        -1  // Word select
#define I2S_DIN_PIN       -1  // Data in

// ADC for battery voltage
#define BATTERY_ADC_PIN   0   // GPIO0 (ADC0)
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
#define ENABLE_CAMERA     1
#define ENABLE_AUDIO      0  // Requires I2S mic hardware
#define ENABLE_SD_CARD    1
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
  #define LOG_WARN(fmt, ...)  do { if(DEBUG_LEVEL >= 2) Serial.printf("[VERBOSE] " fmt "\n", ##__VA_ARGS__); } while(0)
  #define LOG_INFO(fmt, ...)  do { if(DEBUG_LEVEL >= 3) Serial.printf("[INFO] " fmt "\n", ##__VA_ARGS__); } while(0)
  #define LOG_VERBOSE(fmt, ...)  do { if(DEBUG_LEVEL >= 4) Serial.printf("[VERBOSE] " fmt "\n", ##__VA_ARGS__); } while(0)
#else
  #define LOG_ERROR(fmt, ...)
  #define LOG_WARN(fmt, ...)
  #define LOG_INFO(fmt, ...)
  #define LOG_VERBOSE(fmt, ...)
#endif

#endif // CONFIG_H
