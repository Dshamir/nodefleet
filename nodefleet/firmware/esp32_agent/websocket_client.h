#ifndef WEBSOCKET_CLIENT_H
#define WEBSOCKET_CLIENT_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>

typedef void (*MessageCallback)(const JsonDocument& message);
typedef void (*StateChangeCallback)(int state);

class WebSocketClient {
public:
    WebSocketClient(const String& server_host, uint16_t server_port, const String& endpoint);

    // Connection management
    bool connect(const String& device_token);
    bool disconnect();
    bool isConnected();
    bool reconnect();

    // Message sending
    bool sendHeartbeat(float battery_voltage, int signal_strength, uint32_t free_heap, uint32_t uptime_ms);
    bool sendGPS(float latitude, float longitude, float altitude, float accuracy,
                 float speed = 0, float heading = 0, int satellites = 0);
    bool sendTelemetry(const JsonDocument& data);
    bool sendCommandAck(const String& command_id, bool success, const String& message = "");
    bool sendCustomMessage(const JsonDocument& message);

    // Message handling
    void setMessageCallback(MessageCallback callback);
    void setStateChangeCallback(StateChangeCallback callback);
    void handleIncomingMessage(const String& payload);

    // Status
    int getConnectionState();  // 0=disconnected, 1=connecting, 2=connected
    uint32_t getLastMessageTime();
    uint32_t getReconnectAttempts();

    // Ping/Pong
    bool ping();
    void handlePong();

    // Periodic update (call from loop)
    void update();

private:
    String server_host;
    uint16_t server_port;
    String endpoint;
    String device_token;

    WebSocketsClient webSocket;

    int connection_state;  // 0=disconnected, 1=connecting, 2=connected
    uint32_t last_message_time;
    uint32_t reconnect_attempts;
    uint32_t last_reconnect_attempt;
    uint32_t last_ping_time;

    MessageCallback on_message;
    StateChangeCallback on_state_change;

    // Exponential backoff
    uint32_t getReconnectDelay();

    // WebSocket event handler
    void onWebSocketEvent(WStype_t type, uint8_t* payload, size_t length);
    static void eventCallback(WStype_t type, uint8_t* payload, size_t length);
    static WebSocketClient* instance;
};

#endif // WEBSOCKET_CLIENT_H
