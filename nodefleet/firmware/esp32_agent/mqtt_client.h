#ifndef MQTT_CLIENT_H
#define MQTT_CLIENT_H

#include <Arduino.h>
#include <WiFiClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

class NodeFleetMQTT {
public:
    NodeFleetMQTT();

    bool begin(const char* broker, uint16_t port, const char* deviceId);
    bool isConnected();
    bool reconnect();
    void loop();

    // Publish telemetry
    bool publishHeartbeat(float battery, int signal, float cpuTemp, uint32_t freeMemory, uint32_t uptime);
    bool publishGPS(float lat, float lng, float alt, float speed, float heading, int satellites);
    bool publishStatus(const char* status);
    bool publishRaw(const char* topic, const char* payload);

    // Subscribe to commands
    void setCommandCallback(void (*callback)(const char* topic, const char* payload));

private:
    WiFiClient wifiClient;
    PubSubClient mqtt;
    String deviceId;
    String topicPrefix;
    bool enabled;
    uint32_t lastReconnectAttempt;

    void (*onCommand)(const char* topic, const char* payload);

    static NodeFleetMQTT* instance;
    static void mqttCallback(char* topic, byte* payload, unsigned int length);
};

#endif // MQTT_CLIENT_H
