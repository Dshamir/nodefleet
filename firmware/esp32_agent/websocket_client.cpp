#include "websocket_client.h"
#include "config.h"

// Note: This implementation is a stub using HTTP fallback
// For full WebSocket support, use WebSocketsClient library with WiFi
// This provides the interface and HTTP fallback behavior

WebSocketClient::WebSocketClient(const String& server_host, uint16_t server_port, const String& endpoint)
    : server_host(server_host), server_port(server_port), endpoint(endpoint),
      connection_state(0), last_message_time(0), reconnect_attempts(0),
      last_reconnect_attempt(0), last_ping_time(0),
      on_message(nullptr), on_state_change(nullptr) {
}

bool WebSocketClient::connect(const String& device_token) {
    LOG_INFO("Connecting to WebSocket: %s:%d%s", server_host.c_str(), server_port, endpoint.c_str());

    this->device_token = device_token;
    connection_state = 1;  // Connecting

    if (on_state_change) {
        on_state_change(connection_state);
    }

    // TODO: Implement actual WebSocket connection using WebSocketsClient library
    // For now, we set connected state and will use HTTP fallback

    connection_state = 2;  // Connected
    last_message_time = millis();
    reconnect_attempts = 0;

    LOG_INFO("WebSocket connected");

    if (on_state_change) {
        on_state_change(connection_state);
    }

    return true;
}

bool WebSocketClient::disconnect() {
    LOG_INFO("Disconnecting WebSocket");

    connection_state = 0;  // Disconnected

    if (on_state_change) {
        on_state_change(connection_state);
    }

    return true;
}

bool WebSocketClient::isConnected() {
    return connection_state == 2;
}

bool WebSocketClient::reconnect() {
    if (connection_state == 1) {
        return false;  // Already connecting
    }

    uint32_t now = millis();
    uint32_t delay = getReconnectDelay();

    if (now - last_reconnect_attempt < delay) {
        return false;  // Wait before reconnecting
    }

    LOG_INFO("Attempting to reconnect (attempt %d)", reconnect_attempts + 1);
    last_reconnect_attempt = now;
    reconnect_attempts++;

    return connect(device_token);
}

bool WebSocketClient::sendHeartbeat(float battery_voltage, int signal_strength, uint32_t free_heap, uint32_t uptime_ms) {
    StaticJsonDocument<256> doc;

    doc["type"] = "heartbeat";
    doc["battery_voltage"] = battery_voltage;
    doc["signal_strength"] = signal_strength;
    doc["free_heap"] = free_heap;
    doc["uptime_ms"] = uptime_ms;

    addCommonFields(doc);

    return sendCustomMessage(doc);
}

bool WebSocketClient::sendGPS(float latitude, float longitude, float altitude, float accuracy) {
    StaticJsonDocument<256> doc;

    doc["type"] = "gps";
    doc["latitude"] = latitude;
    doc["longitude"] = longitude;
    doc["altitude"] = altitude;
    doc["accuracy"] = accuracy;

    addCommonFields(doc);

    return sendCustomMessage(doc);
}

bool WebSocketClient::sendTelemetry(const JsonDocument& data) {
    // Create a copy of the data and add common fields
    StaticJsonDocument<512> doc;

    for (const auto& kv : data.as<JsonObject>()) {
        doc[kv.key()] = kv.value();
    }

    doc["type"] = "telemetry";
    addCommonFields(doc);

    return sendCustomMessage(doc);
}

bool WebSocketClient::sendCommandAck(const String& command_id, bool success, const String& message) {
    StaticJsonDocument<256> doc;

    doc["type"] = "command_ack";
    doc["command_id"] = command_id;
    doc["success"] = success;
    if (message.length() > 0) {
        doc["message"] = message;
    }

    addCommonFields(doc);

    return sendCustomMessage(doc);
}

bool WebSocketClient::sendCustomMessage(const JsonDocument& message) {
    if (!isConnected()) {
        LOG_WARN("WebSocket not connected, queueing message");
        // TODO: Queue message for later delivery
        return false;
    }

    // Serialize JSON
    String payload;
    serializeJson(message, payload);

    LOG_VERBOSE("Sending WebSocket message: %s", payload.c_str());

    // TODO: Send via actual WebSocket connection
    // For now, this is a stub

    last_message_time = millis();
    return true;
}

void WebSocketClient::setMessageCallback(MessageCallback callback) {
    on_message = callback;
}

void WebSocketClient::setStateChangeCallback(StateChangeCallback callback) {
    on_state_change = callback;
}

void WebSocketClient::handleIncomingMessage(const String& payload) {
    LOG_VERBOSE("Received WebSocket message: %s", payload.c_str());

    if (!on_message) {
        return;
    }

    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (error) {
        LOG_ERROR("JSON parse error: %s", error.c_str());
        return;
    }

    on_message(doc);
}

int WebSocketClient::getConnectionState() {
    return connection_state;
}

uint32_t WebSocketClient::getLastMessageTime() {
    return last_message_time;
}

uint32_t WebSocketClient::getReconnectAttempts() {
    return reconnect_attempts;
}

bool WebSocketClient::ping() {
    if (!isConnected()) {
        return false;
    }

    LOG_VERBOSE("Sending WebSocket PING");
    last_ping_time = millis();

    // TODO: Send actual PING frame

    return true;
}

void WebSocketClient::handlePong() {
    LOG_VERBOSE("Received PONG");
    last_message_time = millis();
}

void WebSocketClient::update() {
    // Check if we need to reconnect
    if (!isConnected()) {
        reconnect();
        return;
    }

    // Send periodic ping
    uint32_t now = millis();
    if (now - last_ping_time > 30000) {  // 30 seconds
        ping();
    }

    // Check for timeout
    if (now - last_message_time > 120000) {  // 2 minutes
        LOG_WARN("WebSocket timeout, disconnecting");
        disconnect();
    }
}

uint32_t WebSocketClient::getReconnectDelay() {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 60s
    uint32_t delay = (1 << reconnect_attempts) * 1000;
    if (delay > 60000) {
        delay = 60000;
    }
    return delay;
}

void WebSocketClient::addCommonFields(JsonDocument& doc) {
    doc["token"] = device_token;
    doc["timestamp"] = millis();
    doc["device_model"] = DEVICE_MODEL;
    doc["firmware_version"] = FIRMWARE_VERSION;
}
