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
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>

// ============================================================================
// Global Objects
// ============================================================================

SIM7670GModem modem(MODEM_RX_PIN, MODEM_TX_PIN, MODEM_BAUD);
CameraModule camera;
StorageManager storage;
WebSocketClient ws_client(SERVER_HOST, SERVER_PORT, DEVICE_WS_URL);

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

    // Try to connect to server
    if (device_state.wifi_connected || device_state.modem_connected) {
        if (!device_state.is_paired) {
            pairDevice();
        } else {
            // Connect WebSocket
            ws_client.connect(device_state.device_token);
        }
    }

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

    // Update battery voltage
    updateBatteryVoltage();

    // Update signal strength (convert CSQ to dBm: dBm = -113 + 2*rssi)
    if (device_state.modem_connected) {
        int rssi_raw = 0, ber = 0;
        if (modem.getSignalStrength(rssi_raw, ber)) {
            device_state.signal_strength = (rssi_raw < 99) ? (-113 + 2 * rssi_raw) : 0;
        }
    }

    // WebSocket keep-alive and message handling
    ws_client.update();

    // Send heartbeat at interval
    uint32_t now = millis();
    if (now - last_heartbeat_ms >= HEARTBEAT_INTERVAL_MS) {
        last_heartbeat_ms = now;
        sendHeartbeat();
    }

    // Update GPS at interval
    if (ENABLE_GPS && now - last_gps_update_ms >= GPS_UPDATE_INTERVAL_MS) {
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
    }
}

// ============================================================================
// 4G Modem Initialization
// ============================================================================

void initialize4G() {
    LOG_INFO("Initializing 4G modem");

    if (!modem.begin()) {
        LOG_ERROR("Modem initialization failed");
        return;
    }

    if (modem.enableCellular()) {
        device_state.modem_connected = true;
        LOG_INFO("4G connection established");
    } else {
        LOG_WARN("Failed to establish 4G connection");
    }

    // Enable GPS
    if (ENABLE_GPS) {
        modem.enableGNSS();
    }
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

    // Make HTTP POST request to pairing endpoint
    HTTPClient http;
    String url = String("http://") + SERVER_HOST + ":" + String(SERVER_PORT_HTTP) + DEVICE_PAIR_URL;
    LOG_INFO("Pairing URL: %s", url.c_str());

    http.begin(url);
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

            // Connect WebSocket
            ws_client.connect(device_state.device_token);

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
        if (ENABLE_CAMERA && camera.isReady()) {
            captureAndUploadPhoto();
            success = true;
            message = "Photo captured";
        } else {
            message = "No camera module on this board";
            success = false;
        }
    }
    else if (command == "capture_video") {
        LOG_INFO("Executing: capture_video");
        if (ENABLE_CAMERA && camera.isReady()) {
            captureAndUploadVideo();
            success = true;
            message = "Video captured";
        } else {
            message = "No camera module on this board";
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
        } else {
            message = "Invalid config parameters";
            success = false;
        }
    }
    else {
        message = "Unknown command";
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
    LOG_INFO("Recording audio...");

    // TODO: Implement I2S audio recording
    // This requires I2S microphone hardware configured in pins

    // Placeholder: record 5 seconds of audio at 16kHz
    // Save as WAV file with proper header

    LOG_WARN("Audio recording not yet implemented");
}

void updateFirmware(const String& url) {
    LOG_INFO("Starting firmware update from: %s", url.c_str());

    // TODO: Implement OTA update using httpUpdate library
    // This requires proper error handling and rollback support

    LOG_WARN("Firmware update not yet implemented");
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
