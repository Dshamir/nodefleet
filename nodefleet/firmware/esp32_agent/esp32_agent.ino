/*
 * NodeFleet ESP32 Agent Firmware
 * Waveshare ESP32-S3 SIM7670G Board
 *
 * This firmware implements a complete IoT device agent that:
 * - Connects to NodeFleet server over WiFi or 4G (SIM7670G modem)
 * - Maintains persistent connection via WebSocket or HTTP heartbeat
 * - Captures photos, videos, and audio
 * - Records GPS telemetry
 * - Implements offline resilience with SD card queue
 * - Handles remote commands (reboot, firmware update, etc)
 * - Provides real-time status monitoring
 */

#include "config.h"
#include "modem.h"
#include "camera.h"
#include "storage.h"
#include "websocket_client.h"
#include "battery.h"
#if USE_MQTT
#include "mqtt_client.h"
#endif
#if ENABLE_WIFI_PROVISION
#include "wifi_provision.h"
#endif
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>

// ============================================================================
// Global Objects
// ============================================================================

SIM7670GModem modem(MODEM_RX_PIN, MODEM_TX_PIN, MODEM_BAUD);
CameraModule camera;
StorageManager storage;
WebSocketClient ws_client(SERVER_HOST, SERVER_PORT, DEVICE_WS_URL);
BatteryGauge battery_gauge(CAMERA_SIOD, CAMERA_SIOC);  // Shared I2C bus (GPIO15/16)
#if USE_MQTT
NodeFleetMQTT mqtt_client;
#endif
#if ENABLE_WIFI_PROVISION
WiFiProvisioner wifi_provisioner;
bool provisioning_mode = false;
#endif

// OTA auto-check timing
uint32_t last_ota_check_ms = 0;

// ============================================================================
// Global State
// ============================================================================

typedef struct {
    bool is_paired;
    String device_token;
    String pairing_code;
    bool wifi_connected;
    bool modem_connected;
    bool has_gps_fix;
    float battery_voltage;
    int signal_strength;
    uint32_t uptime_ms;
    uint32_t frame_count;
} DeviceState;

DeviceState device_state = {
    .is_paired = false,
    .device_token = "",
    .pairing_code = PAIRING_CODE,
    .wifi_connected = false,
    .modem_connected = false,
    .has_gps_fix = false,
    .battery_voltage = 0.0,
    .signal_strength = 0,
    .uptime_ms = 0,
    .frame_count = 0
};

// ============================================================================
// Resolved Server Configuration (local vs remote)
// ============================================================================
typedef struct {
    String host;
    uint16_t ws_port;
    uint16_t http_port;
    bool use_ssl;
    bool use_mqtt;
    String mqtt_host;
    uint16_t mqtt_port;
    String mode;  // "local" or "remote"
} ServerConfig;

ServerConfig server_cfg;

// Dynamic power profile flags
bool gps_active = true;
bool camera_active = true;
uint32_t current_heartbeat_interval = HEARTBEAT_INTERVAL_MS;

// Timing
uint32_t last_heartbeat_ms = 0;
uint32_t last_gps_update_ms = 0;
uint32_t last_status_report_ms = 0;
uint32_t boot_time_ms = 0;

#if ENABLE_WATCHDOG
hw_timer_t* watchdog_timer = NULL;
#endif

// ============================================================================
// Function Declarations
// ============================================================================

void setup();
void loop();
void initializeHardware();
void initializeWiFi();
void initialize4G();
void resolveServerConfig();
void pairDevice();
void handleIncomingCommand(const JsonDocument& cmd);
void captureAndUploadPhoto();
void captureAndUploadVideo();
void recordAndUploadAudio();
void updateFirmware(const String& url);
void sendHeartbeat();
void updateGPS();
void updateStatus();
void setLEDStatus(int pattern);
void updateBatteryVoltage();
void handleWiFiEvent(WiFiEvent_t event);
void IRAM_ATTR watchdogISR();

// ============================================================================
// Setup
// ============================================================================

void setup() {
    // Initialize Serial for debugging
    Serial.begin(115200);
    // Wait for USB CDC serial to enumerate (ESP32-S3)
    uint32_t serial_wait = millis();
    while (!Serial && millis() - serial_wait < 3000) {
        delay(10);
    }
    delay(500);

    LOG_INFO("\n\n===============================================");
    LOG_INFO("NodeFleet ESP32 Agent Booting");
    LOG_INFO("Firmware Version: %s", FIRMWARE_VERSION);
    LOG_INFO("Device Model: %s", DEVICE_MODEL);
    LOG_INFO("===============================================");

    boot_time_ms = millis();

    // Initialize hardware
    initializeHardware();

    // Initialize NVS storage
    storage.nvs_begin("nodefleet");

    // Load or use pairing code
    if (!storage.nvs_loadPairingCode(device_state.pairing_code)) {
        device_state.pairing_code = PAIRING_CODE;
        storage.nvs_savePairingCode(device_state.pairing_code);
        LOG_INFO("Using default pairing code: %s", device_state.pairing_code.c_str());
    } else {
        LOG_INFO("Loaded pairing code from NVS: %s", device_state.pairing_code.c_str());
    }

    // Try to load existing device token
    if (storage.nvs_loadDeviceToken(device_state.device_token)) {
        device_state.is_paired = true;
        LOG_INFO("Loaded device token from NVS");
    } else {
        LOG_INFO("No device token found, will pair on first connection");
    }

    // Initialize SD card
    if (ENABLE_SD_CARD) {
        if (storage.sd_begin(SD_CS)) {
            LOG_INFO("SD card initialized");
        } else {
            LOG_WARN("SD card initialization failed");
        }
    }

    // Initialize camera
    if (ENABLE_CAMERA) {
        LOG_INFO("Initializing camera...");
        if (camera.begin()) {
            LOG_INFO("Camera initialized successfully");
        } else {
            LOG_WARN("Camera initialization failed - check ribbon cable and DIP switch");
        }
    }

    // Initialize battery fuel gauge (MAX17048 on shared I2C bus)
    if (battery_gauge.begin()) {
        float voltage = battery_gauge.readVoltage();
        float soc = battery_gauge.readSOC();
        LOG_INFO("Battery: %.2fV, %.1f%%", voltage, soc);
    }

    // Initialize WiFi
    if (USE_WIFI) {
        initializeWiFi();
    }

    // Initialize 4G modem
    if (USE_4G) {
        initialize4G();
    }

    // Initialize WebSocket with callback
    ws_client.setMessageCallback(handleIncomingCommand);

    // Resolve connection mode (local WiFi vs remote ngrok/LTE)
    if (device_state.wifi_connected || device_state.modem_connected) {
        resolveServerConfig();

        if (!device_state.is_paired) {
            pairDevice();
        } else {
            // Connect WebSocket using resolved config
            ws_client.connect(device_state.device_token, server_cfg.use_ssl,
                              server_cfg.host, server_cfg.ws_port);
        }
    }

    // Initialize MQTT client (local mode only — raw TCP to Mosquitto 1883)
    // Remote devices send telemetry via WebSocket; external subscribers
    // reach MQTT via wss://nodefleet.ngrok.dev/mqtt (nginx → Mosquitto WS)
#if USE_MQTT
    if (server_cfg.mode == "local") {
        String mqtt_broker = MQTT_BROKER_HOST;
        uint16_t mqtt_port = MQTT_BROKER_PORT;

        // Check NVS for custom MQTT settings (from provisioning portal)
        String nvs_broker, nvs_port_str;
        if (storage.nvs_loadConfig("mqtt_broker", nvs_broker) && nvs_broker.length() > 0) {
            mqtt_broker = nvs_broker;
        }
        if (storage.nvs_loadConfig("mqtt_port", nvs_port_str) && nvs_port_str.length() > 0) {
            mqtt_port = nvs_port_str.toInt();
        }

        mqtt_client.begin(mqtt_broker.c_str(), mqtt_port,
                          device_state.is_paired ? device_state.device_token.substring(device_state.device_token.length() - 8).c_str() : "unregistered");
    } else {
        LOG_INFO("MQTT skipped in remote mode — telemetry via WebSocket");
    }
#endif

    // Setup watchdog timer
#if ENABLE_WATCHDOG
    watchdog_timer = timerBegin(0, 80, true);
    timerAttachInterrupt(watchdog_timer, &watchdogISR, true);
    timerAlarmWrite(watchdog_timer, WATCHDOG_TIMEOUT_MS * 1000, false);
    timerAlarmEnable(watchdog_timer);
    LOG_INFO("Watchdog timer enabled (%dms timeout)", WATCHDOG_TIMEOUT_MS);
#endif

    setLEDStatus(1);  // Connected/paired LED pattern

    LOG_INFO("Setup complete, entering main loop");
}

// ============================================================================
// Main Loop
// ============================================================================

void loop() {
    // Reset watchdog
#if ENABLE_WATCHDOG
    timerWrite(watchdog_timer, 0);
#endif

    device_state.uptime_ms = millis() - boot_time_ms;

    // Update connection states
    device_state.wifi_connected = WiFi.status() == WL_CONNECTED;

    // Update battery (MAX17048 fuel gauge or ADC fallback)
    if (battery_gauge.isConnected()) {
        device_state.battery_voltage = battery_gauge.readSOC();  // 0-100%
    } else {
        updateBatteryVoltage();  // ADC fallback
    }

    // Update signal strength (convert CSQ to dBm: dBm = -113 + 2*rssi)
    if (device_state.modem_connected) {
        int rssi_raw = 0, ber = 0;
        if (modem.getSignalStrength(rssi_raw, ber)) {
            device_state.signal_strength = (rssi_raw < 99) ? (-113 + 2 * rssi_raw) : 0;
        }
    }

    // WebSocket keep-alive and message handling
    ws_client.update();

#if USE_MQTT
    // MQTT loop (reconnect + message pump)
    mqtt_client.loop();
#endif

    // Send heartbeat at interval
    uint32_t now = millis();
    if (now - last_heartbeat_ms >= current_heartbeat_interval) {
        last_heartbeat_ms = now;
        sendHeartbeat();

#if USE_MQTT
        // Also publish to MQTT
        mqtt_client.publishHeartbeat(
            device_state.battery_voltage, device_state.signal_strength,
            temperatureRead(), esp_get_free_heap_size(), device_state.uptime_ms / 1000);
#endif
    }

    // Update GPS at interval
    if (ENABLE_GPS && gps_active && now - last_gps_update_ms >= GPS_UPDATE_INTERVAL_MS) {
        last_gps_update_ms = now;
        updateGPS();
    }

    // Send full status report at interval
    if (now - last_status_report_ms >= STATUS_REPORT_INTERVAL_MS) {
        last_status_report_ms = now;
        updateStatus();
    }

    // Check for queued files to sync
    if (device_state.is_paired && device_state.wifi_connected) {
        size_t queue_count = storage.queue_getCount();
        if (queue_count > 0) {
            LOG_INFO("Syncing %d queued files", queue_count);
            std::vector<QueuedFile> files = storage.queue_getFiles();
            for (const auto& file : files) {
                // Upload file
                LOG_INFO("Uploading queued file: %s", file.file_path.c_str());
                // TODO: Implement file upload
                storage.queue_removeFile(file.file_path);
            }
        }
    }

    // Small delay to prevent watchdog timeout
    delay(100);
}

// ============================================================================
// Hardware Initialization
// ============================================================================

void initializeHardware() {
    LOG_INFO("Initializing hardware");

    // LED
    if (STATUS_LED_PIN != -1) {
        pinMode(STATUS_LED_PIN, OUTPUT);
        digitalWrite(STATUS_LED_PIN, LOW);
    }

    // Modem control pins
    if (MODEM_POWER_PIN != -1) {
        pinMode(MODEM_POWER_PIN, OUTPUT);
        digitalWrite(MODEM_POWER_PIN, HIGH);
    }

    if (MODEM_RESET_PIN != -1) {
        pinMode(MODEM_RESET_PIN, OUTPUT);
        digitalWrite(MODEM_RESET_PIN, HIGH);
    }

    // ADC for battery
    if (BATTERY_ADC_PIN != -1) {
        analogReadResolution(12);  // 12-bit resolution (0-4095)
    }
}

// ============================================================================
// WiFi Initialization
// ============================================================================

void initializeWiFi() {
    LOG_INFO("Initializing WiFi");

    WiFi.mode(WIFI_STA);
    WiFi.onEvent(handleWiFiEvent);

    LOG_INFO("Connecting to WiFi: %s", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    // Wait for connection (max 20 seconds)
    uint32_t start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
        delay(500);
        Serial.print(".");
    }

    if (WiFi.status() == WL_CONNECTED) {
        LOG_INFO("WiFi connected! IP: %s", WiFi.localIP().toString().c_str());
        device_state.wifi_connected = true;
    } else {
        LOG_WARN("WiFi connection failed");
#if ENABLE_WIFI_PROVISION
        // Start captive portal for WiFi configuration
        LOG_INFO("Starting WiFi provisioning portal...");
        provisioning_mode = true;
        wifi_provisioner.startAP(AP_SSID, AP_PASSWORD);

        // Block until provisioned or timeout (5 minutes)
        uint32_t provision_start = millis();
        while (!wifi_provisioner.isProvisioned() && millis() - provision_start < 300000) {
            wifi_provisioner.handleClient();
            delay(10);
        }

        if (wifi_provisioner.isProvisioned()) {
            wifi_provisioner.stopAP();
            provisioning_mode = false;

            // Save new credentials to NVS
            storage.nvs_saveConfig("wifi_ssid", wifi_provisioner.getSSID());
            storage.nvs_saveConfig("wifi_pass", wifi_provisioner.getPassword());
            storage.nvs_saveConfig("server_host", wifi_provisioner.getServerHost());
            storage.nvs_saveConfig("server_port", wifi_provisioner.getServerPort());
            storage.nvs_saveConfig("mqtt_broker", wifi_provisioner.getMQTTBroker());
            storage.nvs_saveConfig("mqtt_port", wifi_provisioner.getMQTTPort());
            if (wifi_provisioner.getPairingCode().length() > 0) {
                storage.nvs_savePairingCode(wifi_provisioner.getPairingCode());
            }
            // Save remote access settings
            if (wifi_provisioner.getNgrokDomain().length() > 0) {
                storage.nvs_saveConfig("ngrok_domain", wifi_provisioner.getNgrokDomain());
            }
            if (wifi_provisioner.getConnectionMode().length() > 0) {
                storage.nvs_saveConfig("conn_mode", wifi_provisioner.getConnectionMode());
            }
            if (wifi_provisioner.getApiKey().length() > 0) {
                storage.nvs_saveConfig("api_key", wifi_provisioner.getApiKey());
            }

            LOG_INFO("Provisioning complete. Rebooting to apply...");
            delay(1000);
            ESP.restart();
        } else {
            LOG_WARN("Provisioning timeout — continuing without WiFi");
            wifi_provisioner.stopAP();
            provisioning_mode = false;
        }
#endif
    }
}

// ============================================================================
// 4G Modem Initialization
// ============================================================================

void initialize4G() {
    LOG_INFO("Initializing 4G modem");

    if (!modem.begin()) {
        LOG_ERROR("Modem initialization failed — no AT response");
        return;
    }

    // Modem is alive (AT responds) — enable GPS/signal even if SIM fails
    device_state.modem_connected = true;
    LOG_INFO("Modem ready — GPS and signal monitoring active");

    if (modem.isConnected()) {
        LOG_INFO("4G cellular data available");
    } else {
        LOG_WARN("4G data not available (SIM or registration issue) — GPS still works");
    }

    // Enable GPS
    if (ENABLE_GPS) {
        modem.enableGNSS();
    }
}

// ============================================================================
// Connection Mode Resolver
// ============================================================================

void resolveServerConfig() {
    String mode = CONNECTION_MODE;

    // Check NVS for provisioned connection mode override
    String nvs_mode;
    if (storage.nvs_loadConfig("conn_mode", nvs_mode) && nvs_mode.length() > 0) {
        mode = nvs_mode;
    }

    // Check NVS for provisioned ngrok domain override
    String ngrok_domain = NGROK_DOMAIN;
    String nvs_domain;
    if (storage.nvs_loadConfig("ngrok_domain", nvs_domain) && nvs_domain.length() > 0) {
        ngrok_domain = nvs_domain;
    }

    bool use_local = false;

    if (mode == "local") {
        use_local = true;
    } else if (mode == "remote") {
        use_local = false;
    } else {
        // "auto" mode: use local if WiFi is connected and server is reachable
        if (device_state.wifi_connected) {
            // Quick TCP probe to local server
            WiFiClient probe;
            if (probe.connect(SERVER_HOST, SERVER_PORT, 3000)) {
                probe.stop();
                use_local = true;
                LOG_INFO("Auto-mode: local server reachable, using local connection");
            } else {
                LOG_INFO("Auto-mode: local server unreachable, using remote connection");
            }
        } else {
            LOG_INFO("Auto-mode: no WiFi, using remote connection via LTE");
        }
    }

    if (use_local) {
        server_cfg.host = SERVER_HOST;
        server_cfg.ws_port = SERVER_PORT;
        server_cfg.http_port = SERVER_PORT_HTTP;
        server_cfg.use_ssl = false;
        server_cfg.use_mqtt = true;
        server_cfg.mqtt_host = MQTT_BROKER_HOST;
        server_cfg.mqtt_port = MQTT_BROKER_PORT;
        server_cfg.mode = "local";
    } else {
        server_cfg.host = ngrok_domain;
        server_cfg.ws_port = NGROK_PORT;
        server_cfg.http_port = NGROK_PORT;
        server_cfg.use_ssl = true;
        server_cfg.use_mqtt = true;  // MQTT over WebSocket through ngrok
        server_cfg.mqtt_host = ngrok_domain;
        server_cfg.mqtt_port = NGROK_PORT;
        server_cfg.mode = "remote";
    }

    LOG_INFO("Server config resolved: mode=%s host=%s ws_port=%d ssl=%s",
             server_cfg.mode.c_str(), server_cfg.host.c_str(),
             server_cfg.ws_port, server_cfg.use_ssl ? "yes" : "no");
}

// ============================================================================
// Device Pairing
// ============================================================================

void pairDevice() {
    LOG_INFO("Attempting device pairing with code: %s", device_state.pairing_code.c_str());

    if (!device_state.wifi_connected && !device_state.modem_connected) {
        LOG_ERROR("No network connection for pairing");
        setLEDStatus(3);  // Error LED pattern
        return;
    }

    // Build pairing request
    StaticJsonDocument<256> doc;
    doc["pairingCode"] = device_state.pairing_code;

    String payload;
    serializeJson(doc, payload);

    LOG_VERBOSE("Pairing request: %s", payload.c_str());

    // Make HTTP POST request to pairing endpoint using resolved config
    HTTPClient http;
    String protocol = server_cfg.use_ssl ? "https" : "http";
    String url = protocol + "://" + server_cfg.host + ":" + String(server_cfg.http_port) + DEVICE_PAIR_URL;
    LOG_INFO("Pairing URL: %s", url.c_str());

    if (server_cfg.use_ssl) {
        WiFiClientSecure* client = new WiFiClientSecure();
        client->setInsecure();  // Skip cert verification for ngrok
        http.begin(*client, url);
    } else {
        http.begin(url);
    }
    http.addHeader("Content-Type", "application/json");

    int http_code = http.POST(payload);

    if (http_code == 200) {
        String response = http.getString();

        StaticJsonDocument<1024> resp_doc;
        DeserializationError error = deserializeJson(resp_doc, response);
        if (!error && resp_doc.containsKey("token")) {
            device_state.device_token = resp_doc["token"].as<String>();
            device_state.is_paired = true;

            // Save token to NVS
            storage.nvs_saveDeviceToken(device_state.device_token);

            LOG_INFO("Device paired successfully! Token: %s", device_state.device_token.c_str());

            // Connect WebSocket using resolved config
            ws_client.connect(device_state.device_token, server_cfg.use_ssl,
                              server_cfg.host, server_cfg.ws_port);

            setLEDStatus(1);  // Connected LED pattern
        } else {
            LOG_ERROR("Invalid pairing response");
            setLEDStatus(3);  // Error LED pattern
        }
    } else {
        LOG_ERROR("Pairing failed with HTTP code: %d", http_code);
        setLEDStatus(3);  // Error LED pattern
    }

    http.end();
}

// ============================================================================
// Command Handler
// ============================================================================

void handleIncomingCommand(const JsonDocument& cmd) {
    // Handle token refresh (server rotates JWT every 30 days)
    if (cmd.containsKey("type") && cmd["type"].as<String>() == "token_refresh") {
        if (cmd.containsKey("token")) {
            String new_token = cmd["token"].as<String>();
            device_state.device_token = new_token;
            storage.nvs_saveDeviceToken(new_token);
            LOG_INFO("Token rotated and saved to NVS");
        }
        return;
    }

    if (!cmd.containsKey("command")) {
        LOG_ERROR("Invalid command format");
        return;
    }

    String command = cmd["command"].as<String>();
    String command_id = cmd.containsKey("commandId") ? cmd["commandId"].as<String>() : "";

    LOG_INFO("Received command: %s (id: %s)", command.c_str(), command_id.c_str());

    bool success = false;
    String message = "";

    if (command == "capture_photo") {
        LOG_INFO("Executing: capture_photo");
        if (ENABLE_CAMERA && camera_active && camera.isReady()) {
            captureAndUploadPhoto();
            success = true;
            message = "Photo captured";
        } else {
            message = camera_active ? "No camera module on this board" : "Camera disabled (idle/deep_sleep mode)";
            success = false;
        }
    }
    else if (command == "capture_video") {
        LOG_INFO("Executing: capture_video");
        if (ENABLE_CAMERA && camera_active && camera.isReady()) {
            captureAndUploadVideo();
            success = true;
            message = "Video captured";
        } else {
            message = camera_active ? "No camera module on this board" : "Camera disabled (idle/deep_sleep mode)";
            success = false;
        }
    }
    else if (command == "record_audio") {
        LOG_INFO("Executing: record_audio");
        if (ENABLE_AUDIO) {
            recordAndUploadAudio();
            success = true;
        } else {
            message = "Audio not enabled on this board";
            success = false;
        }
    }
    else if (command == "reboot") {
        LOG_INFO("Executing: reboot");
        message = "Rebooting...";
        success = true;
        // Send ack before rebooting
        ws_client.sendCommandAck(command_id, success, message);
        delay(1000);
        ESP.restart();
    }
    else if (command == "update_firmware") {
        if (cmd.containsKey("url")) {
            String fw_url = cmd["url"].as<String>();
            LOG_INFO("Executing: update_firmware from %s", fw_url.c_str());
            updateFirmware(fw_url);
            success = true;
        } else {
            message = "No firmware URL provided";
            success = false;
        }
    }
    else if (command == "get_status") {
        LOG_INFO("Executing: get_status");
        updateStatus();
        success = true;
    }
    else if (command == "set_config") {
        if (cmd.containsKey("key") && cmd.containsKey("value")) {
            String key = cmd["key"].as<String>();
            String value = cmd["value"].as<String>();
            storage.nvs_saveConfig(key, value);
            success = true;
            message = "Config saved: " + key + "=" + value;
        } else {
            message = "Invalid config parameters";
            success = false;
        }
    }
    else if (command == "read_config") {
        if (cmd.containsKey("key")) {
            String key = cmd["key"].as<String>();
            String value;
            if (storage.nvs_loadConfig(key, value)) {
                success = true;
                message = key + "=" + value;
            } else {
                success = false;
                message = "Key not found: " + key;
            }
        } else {
            message = "Missing key parameter";
            success = false;
        }
    }
    else if (command == "factory_reset") {
        LOG_INFO("Executing: factory_reset");
        message = "Factory reset initiated...";
        success = true;
        ws_client.sendCommandAck(command_id, success, message);
        delay(500);
        storage.nvs_clear();
        delay(500);
        ESP.restart();
    }
    else if (command == "set_heartbeat_interval") {
        if (cmd.containsKey("interval_ms")) {
            uint32_t interval = cmd["interval_ms"].as<uint32_t>();
            if (interval >= 5000 && interval <= 300000) {
                storage.nvs_saveConfig("hb_interval", String(interval));
                success = true;
                message = "Heartbeat interval set to " + String(interval) + "ms (effective after reboot)";
            } else {
                success = false;
                message = "Interval must be 5000-300000ms";
            }
        } else {
            success = false;
            message = "Missing interval_ms parameter";
        }
    }
    else if (command == "power_mode") {
        if (cmd.containsKey("mode")) {
            String mode = cmd["mode"].as<String>();
            if (mode == "active") {
                gps_active = true;
                camera_active = true;
                current_heartbeat_interval = HEARTBEAT_INTERVAL_MS;
                success = true;
                message = "Power mode: active (all systems on)";
            } else if (mode == "idle") {
                gps_active = false;
                camera_active = false;
                current_heartbeat_interval = 300000; // 5 minutes
                success = true;
                message = "Power mode: idle (GPS/camera off, heartbeat 5min)";
            } else if (mode == "deep_sleep") {
                uint32_t sleep_seconds = 300; // default 5 min
                if (cmd.containsKey("duration_s")) {
                    sleep_seconds = cmd["duration_s"].as<uint32_t>();
                }
                message = "Entering deep sleep for " + String(sleep_seconds) + "s...";
                success = true;
                ws_client.sendCommandAck(command_id, success, message);
                delay(500);
                esp_sleep_enable_timer_wakeup((uint64_t)sleep_seconds * 1000000ULL);
                esp_deep_sleep_start();
                return; // Will not reach here - device reboots on wake
            } else if (mode == "sleep") {
                message = "Entering light sleep...";
                success = true;
                ws_client.sendCommandAck(command_id, success, message);
                delay(500);
                esp_sleep_enable_timer_wakeup(60 * 1000000ULL); // 60s
                esp_light_sleep_start();
                return; // Resume after wakeup
            } else {
                success = false;
                message = "Unknown mode. Use: active, idle, sleep, deep_sleep";
            }
        } else {
            success = false;
            message = "Missing mode parameter";
        }
    }
    else if (command == "get_network_info") {
        if (device_state.modem_connected) {
            String op_name, rat;
            modem.getNetworkInfo(op_name, rat);
            success = true;
            message = "Operator: " + op_name + ", RAT: " + rat;
        } else {
            success = false;
            message = "Modem not connected";
        }
    }
    else {
        message = "Unknown command: " + command;
        success = false;
    }

    // Send command acknowledgment
    ws_client.sendCommandAck(command_id, success, message);
}

// ============================================================================
// Media Capture Functions
// ============================================================================

void captureAndUploadPhoto() {
    LOG_INFO("Capturing photo...");

    if (!ENABLE_CAMERA || !camera.isReady()) {
        LOG_ERROR("Camera not available");
        return;
    }

    FrameBuffer fb;
    if (!camera.captureJPEG(fb)) {
        LOG_ERROR("Failed to capture JPEG");
        return;
    }

    LOG_INFO("Photo captured: %d bytes", fb.length);

    // Step 1: Request presigned upload URL from server
    String filename = "photo_" + String(millis()) + ".jpg";

    StaticJsonDocument<256> reqDoc;
    reqDoc["filename"] = filename;
    reqDoc["contentType"] = "image/jpeg";
    reqDoc["size"] = fb.length;

    String reqPayload;
    serializeJson(reqDoc, reqPayload);

    HTTPClient http;
    String url = String("http://") + SERVER_HOST + ":" + String(SERVER_PORT_HTTP) + "/api/devices/upload";

    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + device_state.device_token);

    int httpCode = http.POST(reqPayload);

    if (httpCode != 200) {
        LOG_ERROR("Failed to get upload URL: HTTP %d", httpCode);
        camera.releaseFrameBuffer(fb);
        http.end();
        return;
    }

    String response = http.getString();
    http.end();

    StaticJsonDocument<512> respDoc;
    if (deserializeJson(respDoc, response) || !respDoc.containsKey("uploadUrl")) {
        LOG_ERROR("Invalid upload URL response");
        camera.releaseFrameBuffer(fb);
        return;
    }

    String uploadUrl = respDoc["uploadUrl"].as<String>();
    String fileId = respDoc["fileId"].as<String>();

    LOG_INFO("Got upload URL, uploading %d bytes...", fb.length);

    // Step 2: Upload JPEG directly to MinIO via presigned URL
    HTTPClient uploadHttp;
    uploadHttp.begin(uploadUrl);
    uploadHttp.addHeader("Content-Type", "image/jpeg");

    int uploadCode = uploadHttp.PUT(fb.buffer, fb.length);

    if (uploadCode >= 200 && uploadCode < 300) {
        LOG_INFO("Photo uploaded successfully! fileId: %s", fileId.c_str());

        // Notify server via WebSocket that media is ready
        StaticJsonDocument<256> mediaMsg;
        mediaMsg["type"] = "media_ready";
        mediaMsg["fileType"] = "image";
        mediaMsg["filename"] = filename;
        mediaMsg["size"] = fb.length;
        ws_client.sendCustomMessage(mediaMsg);
    } else {
        LOG_ERROR("Photo upload failed: HTTP %d", uploadCode);
    }

    uploadHttp.end();
    camera.releaseFrameBuffer(fb);
}

void captureAndUploadVideo() {
    LOG_INFO("Capturing video...");

    // Simple video: capture 3 JPEG frames for MJPEG
    if (!ENABLE_CAMERA || !camera.isReady()) {
        LOG_ERROR("Camera not available");
        return;
    }

    String video_filename = "/videos/video_" + String(millis()) + ".mjpeg";

    if (ENABLE_SD_CARD && storage.sd_isReady()) {
        // Capture 30 frames (about 1 second at 30fps)
        for (int i = 0; i < 30; i++) {
            FrameBuffer fb;
            if (camera.captureJPEG(fb)) {
                // Append JPEG frame to MJPEG file
                storage.sd_appendFile(video_filename, fb.buffer, fb.length);
                camera.releaseFrameBuffer(fb);
            }
            delay(33);  // ~30fps
        }

        LOG_INFO("Video saved: %s", video_filename.c_str());
    }

    // Queue for upload if offline
    if (!device_state.wifi_connected && !device_state.modem_connected) {
        if (ENABLE_SD_CARD) {
            storage.queue_addFile(video_filename, "video");
        }
    }
}

void recordAndUploadAudio() {
    LOG_INFO("Recording audio (%ds @ %dHz)...", AUDIO_DURATION_S, I2S_SAMPLE_RATE);

#if ENABLE_AUDIO && I2S_BCK_PIN >= 0
    #include <driver/i2s.h>

    // Configure I2S
    i2s_config_t i2s_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
        .sample_rate = I2S_SAMPLE_RATE,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 8,
        .dma_buf_len = 1024,
        .use_apll = false,
    };

    i2s_pin_config_t pin_config = {
        .bck_io_num = I2S_BCK_PIN,
        .ws_io_num = I2S_WS_PIN,
        .data_out_num = I2S_PIN_NO_CHANGE,
        .data_in_num = I2S_DIN_PIN,
    };

    if (i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL) != ESP_OK) {
        LOG_ERROR("I2S driver install failed");
        return;
    }
    if (i2s_set_pin(I2S_NUM_0, &pin_config) != ESP_OK) {
        LOG_ERROR("I2S pin config failed");
        i2s_driver_uninstall(I2S_NUM_0);
        return;
    }

    // Calculate buffer size: sample_rate * bytes_per_sample * duration
    size_t total_bytes = I2S_SAMPLE_RATE * 2 * AUDIO_DURATION_S;  // 16-bit = 2 bytes
    size_t wav_size = total_bytes + 44;  // WAV header is 44 bytes

    uint8_t* audio_buf = (uint8_t*)malloc(wav_size);
    if (!audio_buf) {
        LOG_ERROR("Audio buffer allocation failed (%d bytes)", wav_size);
        i2s_driver_uninstall(I2S_NUM_0);
        return;
    }

    // Write WAV header
    uint8_t* h = audio_buf;
    memcpy(h, "RIFF", 4); h += 4;
    uint32_t chunk_size = wav_size - 8;
    memcpy(h, &chunk_size, 4); h += 4;
    memcpy(h, "WAVE", 4); h += 4;
    memcpy(h, "fmt ", 4); h += 4;
    uint32_t subchunk1_size = 16;
    memcpy(h, &subchunk1_size, 4); h += 4;
    uint16_t audio_format = 1;  // PCM
    memcpy(h, &audio_format, 2); h += 2;
    uint16_t num_channels = I2S_CHANNELS;
    memcpy(h, &num_channels, 2); h += 2;
    uint32_t sample_rate = I2S_SAMPLE_RATE;
    memcpy(h, &sample_rate, 4); h += 4;
    uint32_t byte_rate = I2S_SAMPLE_RATE * I2S_CHANNELS * 2;
    memcpy(h, &byte_rate, 4); h += 4;
    uint16_t block_align = I2S_CHANNELS * 2;
    memcpy(h, &block_align, 2); h += 2;
    uint16_t bits_per_sample = 16;
    memcpy(h, &bits_per_sample, 2); h += 2;
    memcpy(h, "data", 4); h += 4;
    memcpy(h, &total_bytes, 4); h += 4;

    // Record audio via DMA
    LOG_INFO("Recording...");
    size_t bytes_read = 0;
    size_t offset = 44;  // After WAV header
    while (offset < wav_size) {
        size_t chunk = 0;
        i2s_read(I2S_NUM_0, audio_buf + offset, min((size_t)2048, wav_size - offset), &chunk, portMAX_DELAY);
        offset += chunk;
    }

    i2s_driver_uninstall(I2S_NUM_0);
    LOG_INFO("Recording complete: %d bytes", wav_size);

    // Upload via presigned URL
    String filename = "audio_" + String(millis()) + ".wav";

    StaticJsonDocument<256> reqDoc;
    reqDoc["filename"] = filename;
    reqDoc["contentType"] = "audio/wav";
    reqDoc["size"] = wav_size;

    String reqPayload;
    serializeJson(reqDoc, reqPayload);

    HTTPClient http;
    String url = String("http://") + SERVER_HOST + ":" + String(SERVER_PORT_HTTP) + "/api/devices/upload";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + device_state.device_token);

    int httpCode = http.POST(reqPayload);
    if (httpCode == 200) {
        String response = http.getString();
        http.end();

        StaticJsonDocument<512> respDoc;
        if (!deserializeJson(respDoc, response) && respDoc.containsKey("uploadUrl")) {
            String uploadUrl = respDoc["uploadUrl"].as<String>();

            HTTPClient uploadHttp;
            uploadHttp.begin(uploadUrl);
            uploadHttp.addHeader("Content-Type", "audio/wav");
            int uploadCode = uploadHttp.PUT(audio_buf, wav_size);

            if (uploadCode >= 200 && uploadCode < 300) {
                LOG_INFO("Audio uploaded: %s (%d bytes)", filename.c_str(), wav_size);
                StaticJsonDocument<256> mediaMsg;
                mediaMsg["type"] = "media_ready";
                mediaMsg["fileType"] = "audio";
                mediaMsg["filename"] = filename;
                mediaMsg["size"] = wav_size;
                ws_client.sendCustomMessage(mediaMsg);
            } else {
                LOG_ERROR("Audio upload failed: HTTP %d", uploadCode);
            }
            uploadHttp.end();
        }
    } else {
        LOG_ERROR("Failed to get upload URL: HTTP %d", httpCode);
        http.end();
    }

    free(audio_buf);
#else
    LOG_WARN("Audio not enabled (ENABLE_AUDIO=0 or I2S pins not configured)");
#endif
}

void updateFirmware(const String& url) {
    LOG_INFO("Starting firmware update from: %s", url.c_str());

    WiFiClient client;
    HTTPUpdate httpUpdate;

    httpUpdate.setLedPin(-1);  // No LED during update
    httpUpdate.rebootOnUpdate(true);

    LOG_INFO("Downloading firmware...");
    t_httpUpdate_return ret = httpUpdate.update(client, url);

    switch (ret) {
        case HTTP_UPDATE_FAILED:
            LOG_ERROR("OTA failed: %s", httpUpdate.getLastErrorString().c_str());
            break;
        case HTTP_UPDATE_NO_UPDATES:
            LOG_INFO("No updates available");
            break;
        case HTTP_UPDATE_OK:
            LOG_INFO("OTA success, rebooting...");
            break;
    }
}

// ============================================================================
// Telemetry Functions
// ============================================================================

void sendHeartbeat() {
    if (!device_state.is_paired) {
        return;
    }

    if (ws_client.isConnected()) {
        // Send via WebSocket
        ws_client.sendHeartbeat(device_state.battery_voltage, device_state.signal_strength,
                               esp_get_free_heap_size(), device_state.uptime_ms);
    } else {
        // Fallback: HTTP POST heartbeat
        StaticJsonDocument<256> doc;
        doc["type"] = "heartbeat";
        doc["token"] = device_state.device_token;
        doc["battery"] = device_state.battery_voltage;
        doc["signal"] = device_state.signal_strength;
        doc["freeMemory"] = esp_get_free_heap_size();
        doc["uptime"] = device_state.uptime_ms / 1000;
        doc["timestamp"] = millis();

        String payload;
        serializeJson(doc, payload);

        HTTPClient http;
        String url = String("http://") + SERVER_HOST + ":" + String(SERVER_PORT_HTTP) + "/api/devices/heartbeat";

        http.begin(url);
        http.addHeader("Content-Type", "application/json");
        http.POST(payload);
        http.end();
    }

    LOG_VERBOSE("Heartbeat sent (battery: %.2fV, signal: %d, heap: %d bytes)",
               device_state.battery_voltage, device_state.signal_strength,
               esp_get_free_heap_size());
}

void updateGPS() {
    if (!ENABLE_GPS || !modem.isModemReady()) {
        return;
    }

    float lat, lon, alt, acc, spd, hdg;
    int sats;
    if (modem.getGPSFix(lat, lon, alt, acc, spd, hdg, sats)) {
        device_state.has_gps_fix = true;
        ws_client.sendGPS(lat, lon, alt, acc, spd, hdg, sats);
#if USE_MQTT
        mqtt_client.publishGPS(lat, lon, alt, spd, hdg, sats);
#endif
        LOG_INFO("GPS: %.4f, %.4f (alt: %.1f m, sats: %d)", lat, lon, alt, sats);

        if (ENABLE_SD_CARD && storage.sd_isReady()) {
            StaticJsonDocument<128> gps_data;
            gps_data["lat"] = lat;
            gps_data["lon"] = lon;
            gps_data["alt"] = alt;
            gps_data["acc"] = acc;
            gps_data["ts"] = millis();

            String json;
            serializeJson(gps_data, json);
            storage.log_writeLog("GPS: " + json);
        }
    } else {
        device_state.has_gps_fix = false;
    }
}

void updateStatus() {
    if (!device_state.is_paired) {
        return;
    }

    StaticJsonDocument<512> doc;
    doc["type"] = "status_report";
    doc["token"] = device_state.device_token;
    doc["is_paired"] = device_state.is_paired;
    doc["wifi_connected"] = device_state.wifi_connected;
    doc["modem_connected"] = device_state.modem_connected;
    doc["has_gps_fix"] = device_state.has_gps_fix;
    doc["battery_voltage"] = device_state.battery_voltage;
    doc["signal_strength"] = device_state.signal_strength;
    doc["free_heap"] = esp_get_free_heap_size();
    doc["uptime_ms"] = device_state.uptime_ms;
    doc["frame_count"] = device_state.frame_count;
    doc["wifi_ssid"] = WiFi.SSID();
    doc["wifi_rssi"] = WiFi.RSSI();

    if (ENABLE_SD_CARD && storage.sd_isReady()) {
        doc["sd_usage_percent"] = storage.sd_getUsagePercent();
        doc["queued_files"] = storage.queue_getCount();
    }

    doc["timestamp"] = millis();

    String payload;
    serializeJson(doc, payload);

    if (ws_client.isConnected()) {
        ws_client.sendTelemetry(doc);
    } else {
        HTTPClient http;
        String url = String("http://") + SERVER_HOST + ":" + String(SERVER_PORT_HTTP) + "/api/devices/status";

        http.begin(url);
        http.addHeader("Content-Type", "application/json");
        http.POST(payload);
        http.end();
    }

    LOG_INFO("Status report sent");
}

// ============================================================================
// LED Status Indicator
// ============================================================================

void setLEDStatus(int pattern) {
    if (STATUS_LED_PIN == -1) {
        return;
    }

    // Pattern: 0=off, 1=steady, 2=slow blink, 3=fast blink/error
    static uint32_t last_blink = 0;
    static bool led_state = false;

    uint32_t now = millis();

    switch (pattern) {
        case 0:  // Off
            digitalWrite(STATUS_LED_PIN, LOW);
            break;
        case 1:  // Steady on
            digitalWrite(STATUS_LED_PIN, HIGH);
            break;
        case 2:  // Slow blink (1Hz)
            if (now - last_blink > 500) {
                led_state = !led_state;
                digitalWrite(STATUS_LED_PIN, led_state ? HIGH : LOW);
                last_blink = now;
            }
            break;
        case 3:  // Fast blink (2Hz)
            if (now - last_blink > 250) {
                led_state = !led_state;
                digitalWrite(STATUS_LED_PIN, led_state ? HIGH : LOW);
                last_blink = now;
            }
            break;
    }
}

// ============================================================================
// Battery Voltage Monitoring
// ============================================================================

void updateBatteryVoltage() {
    if (BATTERY_ADC_PIN == -1) {
        device_state.battery_voltage = 0.0;
        return;
    }

    // Read ADC (12-bit, 0-4095 maps to 0-3.3V)
    int adc_raw = analogRead(BATTERY_ADC_PIN);
    float voltage = (adc_raw / 4095.0) * 3.3;

    // Assuming voltage divider: actual battery voltage = measured voltage * divider ratio
    // For example, if using 1:2 divider, multiply by 2
    // Adjust based on actual circuit
    device_state.battery_voltage = voltage;  // * 2.0 if using 1:2 divider
}

// ============================================================================
// WiFi Event Handler
// ============================================================================

void handleWiFiEvent(WiFiEvent_t event) {
    switch (event) {
        case SYSTEM_EVENT_STA_START:
            LOG_INFO("WiFi STA started");
            break;
        case SYSTEM_EVENT_STA_CONNECTED:
            LOG_INFO("WiFi connected");
            break;
        case SYSTEM_EVENT_STA_GOT_IP:
            LOG_INFO("WiFi got IP: %s", WiFi.localIP().toString().c_str());
            device_state.wifi_connected = true;
            setLEDStatus(1);  // Connected LED
            break;
        case SYSTEM_EVENT_STA_DISCONNECTED:
            LOG_WARN("WiFi disconnected");
            device_state.wifi_connected = false;
            setLEDStatus(2);  // Slow blink
            break;
        default:
            break;
    }
}

// ============================================================================
// Watchdog Timer ISR
// ============================================================================

void IRAM_ATTR watchdogISR() {
    LOG_ERROR("WATCHDOG TIMEOUT - REBOOTING");
    ESP.restart();
}
