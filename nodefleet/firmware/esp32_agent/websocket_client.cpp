#include "websocket_client.h"
#include "config.h"

// Static instance pointer for callback routing
WebSocketClient* WebSocketClient::instance = nullptr;

WebSocketClient::WebSocketClient(const String& server_host, uint16_t server_port, const String& endpoint)
    : server_host(server_host), server_port(server_port), endpoint(endpoint),
      connection_state(0), last_message_time(0), reconnect_attempts(0),
      last_reconnect_attempt(0), last_ping_time(0),
      on_message(nullptr), on_state_change(nullptr) {
    instance = this;
}

// Static callback that routes to instance method
void WebSocketClient::eventCallback(WStype_t type, uint8_t* payload, size_t length) {
    if (instance) {
        instance->onWebSocketEvent(type, payload, length);
    }
}

void WebSocketClient::onWebSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
    switch (type) {
        case WStype_DISCONNECTED:
            LOG_WARN("WebSocket disconnected");
            connection_state = 0;
            if (on_state_change) {
                on_state_change(connection_state);
            }
            break;

        case WStype_CONNECTED:
            LOG_INFO("WebSocket connected to: %s", (char*)payload);
            connection_state = 2;
            last_message_time = millis();
            reconnect_attempts = 0;
            if (on_state_change) {
                on_state_change(connection_state);
            }
            break;

        case WStype_TEXT:
            LOG_VERBOSE("WebSocket received: %s", (char*)payload);
            last_message_time = millis();
            handleIncomingMessage(String((char*)payload));
            break;

        case WStype_PING:
            LOG_VERBOSE("WebSocket PING received");
            last_message_time = millis();
            break;

        case WStype_PONG:
            LOG_VERBOSE("WebSocket PONG received");
            last_message_time = millis();
            break;

        case WStype_ERROR:
            LOG_ERROR("WebSocket error");
            break;

        default:
            break;
    }
}

bool WebSocketClient::connect(const String& device_token, bool use_ssl,
                               const String& host, uint16_t port) {
    // Allow runtime override of host/port (for dual-mode local/remote)
    String connect_host = host.length() > 0 ? host : server_host;
    uint16_t connect_port = port > 0 ? port : server_port;

    LOG_INFO("Connecting to WebSocket: %s:%d%s (SSL=%s)",
             connect_host.c_str(), connect_port, endpoint.c_str(),
             use_ssl ? "yes" : "no");

    this->device_token = device_token;
    connection_state = 1;  // Connecting

    if (on_state_change) {
        on_state_change(connection_state);
    }

    // Build the path with token query parameter
    String path = endpoint + "?token=" + device_token;

    if (use_ssl) {
        webSocket.beginSSL(connect_host.c_str(), connect_port, path.c_str());
        LOG_INFO("WebSocket connection initiated (WSS/SSL)");
    } else {
        webSocket.begin(connect_host.c_str(), connect_port, path.c_str());
        LOG_INFO("WebSocket connection initiated (WS)");
    }

    // Register event handler
    webSocket.onEvent(eventCallback);

    // Enable auto-reconnect with 5 second interval
    webSocket.setReconnectInterval(5000);

    // Set heartbeat interval (ping every 15s, pong timeout 3s, disconnect after 2 missed)
    webSocket.enableHeartbeat(15000, 3000, 2);

    return true;
}

bool WebSocketClient::disconnect() {
    LOG_INFO("Disconnecting WebSocket");
    webSocket.disconnect();
    connection_state = 0;

    if (on_state_change) {
        on_state_change(connection_state);
    }

    return true;
}

bool WebSocketClient::isConnected() {
    return connection_state == 2;
}

bool WebSocketClient::reconnect() {
    // The WebSocketsClient library handles reconnection automatically
    // via setReconnectInterval(). This method is kept for API compatibility.
    return true;
}

bool WebSocketClient::sendHeartbeat(float battery_voltage, int signal_strength, uint32_t free_heap, uint32_t uptime_ms) {
    StaticJsonDocument<256> doc;

    // Field names must match ws-server expectations
    doc["type"] = "heartbeat";
    doc["battery"] = battery_voltage;
    doc["signal"] = signal_strength;
    doc["cpuTemp"] = temperatureRead();
    doc["freeMemory"] = free_heap;
    doc["uptime"] = uptime_ms / 1000;
    doc["firmware_version"] = FIRMWARE_VERSION;

    return sendCustomMessage(doc);
}

bool WebSocketClient::sendGPS(float latitude, float longitude, float altitude, float accuracy,
                               float speed, float heading, int satellites) {
    StaticJsonDocument<256> doc;

    // Field names must match ws-server expectations
    doc["type"] = "gps";
    doc["lat"] = latitude;
    doc["lng"] = longitude;
    doc["alt"] = altitude;
    doc["speed"] = speed;
    doc["heading"] = heading;
    doc["accuracy"] = accuracy;
    doc["satellites"] = satellites;

    return sendCustomMessage(doc);
}

bool WebSocketClient::sendTelemetry(const JsonDocument& data) {
    StaticJsonDocument<512> doc;

    // Copy fields from the input document
    JsonObjectConst obj = data.as<JsonObjectConst>();
    for (JsonPairConst kv : obj) {
        doc[kv.key()] = kv.value();
    }

    doc["type"] = "telemetry";

    return sendCustomMessage(doc);
}

bool WebSocketClient::sendCommandAck(const String& command_id, bool success, const String& message) {
    StaticJsonDocument<256> doc;

    // Field names must match ws-server expectations
    doc["type"] = "command_ack";
    doc["commandId"] = command_id;
    doc["status"] = success ? "success" : "error";
    if (message.length() > 0) {
        doc["result"] = message;
    }

    return sendCustomMessage(doc);
}

bool WebSocketClient::sendCustomMessage(const JsonDocument& message) {
    if (!isConnected()) {
        LOG_WARN("WebSocket not connected, cannot send message");
        return false;
    }

    // Serialize JSON
    String payload;
    serializeJson(message, payload);

    LOG_VERBOSE("Sending: %s", payload.c_str());

    bool sent = webSocket.sendTXT(payload);

    if (sent) {
        last_message_time = millis();
    } else {
        LOG_ERROR("Failed to send WebSocket message");
    }

    return sent;
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
    // The library handles ping/pong automatically via enableHeartbeat()
    return true;
}

void WebSocketClient::handlePong() {
    last_message_time = millis();
}

void WebSocketClient::update() {
    // CRITICAL: Must call webSocket.loop() to pump the WebSocket state machine
    webSocket.loop();
}

uint32_t WebSocketClient::getReconnectDelay() {
    // Handled internally by WebSocketsClient via setReconnectInterval()
    uint32_t delay = (1 << reconnect_attempts) * 1000;
    if (delay > 60000) {
        delay = 60000;
    }
    return delay;
}
