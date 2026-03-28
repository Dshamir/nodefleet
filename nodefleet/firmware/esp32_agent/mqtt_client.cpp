#include "mqtt_client.h"
#include "config.h"

NodeFleetMQTT* NodeFleetMQTT::instance = nullptr;

NodeFleetMQTT::NodeFleetMQTT()
    : mqtt(wifiClient), enabled(false), lastReconnectAttempt(0), onCommand(nullptr) {
    instance = this;
}

bool NodeFleetMQTT::begin(const char* broker, uint16_t port, const char* devId) {
    deviceId = devId;
    topicPrefix = String(MQTT_TOPIC_PREFIX) + deviceId + "/";

    mqtt.setServer(broker, port);
    mqtt.setCallback(mqttCallback);
    mqtt.setBufferSize(512);

    enabled = true;
    LOG_INFO("MQTT client configured: %s:%d topic=%s", broker, port, topicPrefix.c_str());

    return reconnect();
}

bool NodeFleetMQTT::isConnected() {
    return enabled && mqtt.connected();
}

bool NodeFleetMQTT::reconnect() {
    if (!enabled) return false;
    if (mqtt.connected()) return true;

    uint32_t now = millis();
    if (now - lastReconnectAttempt < 5000) return false;
    lastReconnectAttempt = now;

    String clientId = "nodefleet-" + deviceId.substring(0, 8);
    LOG_INFO("MQTT connecting as %s...", clientId.c_str());

    if (mqtt.connect(clientId.c_str())) {
        LOG_INFO("MQTT connected");

        // Subscribe to command topic
        String cmdTopic = topicPrefix + "command";
        mqtt.subscribe(cmdTopic.c_str());
        LOG_INFO("MQTT subscribed to: %s", cmdTopic.c_str());

        // Publish online status
        publishStatus("online");
        return true;
    }

    LOG_WARN("MQTT connection failed (rc=%d)", mqtt.state());
    return false;
}

void NodeFleetMQTT::loop() {
    if (!enabled) return;

    if (!mqtt.connected()) {
        reconnect();
    }
    mqtt.loop();
}

bool NodeFleetMQTT::publishHeartbeat(float battery, int signal, float cpuTemp, uint32_t freeMemory, uint32_t uptime) {
    if (!isConnected()) return false;

    StaticJsonDocument<256> doc;
    doc["battery"] = battery;
    doc["signal"] = signal;
    doc["cpuTemp"] = cpuTemp;
    doc["freeMemory"] = freeMemory;
    doc["uptime"] = uptime;
    doc["firmware"] = FIRMWARE_VERSION;
    doc["ts"] = millis();

    String payload;
    serializeJson(doc, payload);

    String topic = topicPrefix + "telemetry";
    return mqtt.publish(topic.c_str(), payload.c_str());
}

bool NodeFleetMQTT::publishGPS(float lat, float lng, float alt, float speed, float heading, int satellites) {
    if (!isConnected()) return false;

    StaticJsonDocument<256> doc;
    doc["lat"] = lat;
    doc["lng"] = lng;
    doc["alt"] = alt;
    doc["speed"] = speed;
    doc["heading"] = heading;
    doc["satellites"] = satellites;
    doc["ts"] = millis();

    String payload;
    serializeJson(doc, payload);

    String topic = topicPrefix + "gps";
    return mqtt.publish(topic.c_str(), payload.c_str());
}

bool NodeFleetMQTT::publishStatus(const char* status) {
    if (!mqtt.connected()) return false;

    String topic = topicPrefix + "status";
    return mqtt.publish(topic.c_str(), status, true);  // retained
}

bool NodeFleetMQTT::publishRaw(const char* topic, const char* payload) {
    if (!isConnected()) return false;
    String fullTopic = topicPrefix + topic;
    return mqtt.publish(fullTopic.c_str(), payload);
}

void NodeFleetMQTT::setCommandCallback(void (*callback)(const char* topic, const char* payload)) {
    onCommand = callback;
}

void NodeFleetMQTT::mqttCallback(char* topic, byte* payload, unsigned int length) {
    if (!instance || !instance->onCommand) return;

    char msg[512];
    unsigned int len = min(length, (unsigned int)511);
    memcpy(msg, payload, len);
    msg[len] = '\0';

    LOG_INFO("MQTT message on %s: %s", topic, msg);
    instance->onCommand(topic, msg);
}
