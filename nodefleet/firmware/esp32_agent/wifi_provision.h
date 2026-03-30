#ifndef WIFI_PROVISION_H
#define WIFI_PROVISION_H

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>

// WiFi provisioning via AP mode + web portal
// When WiFi connection fails, the device starts an AP with a captive portal
// allowing the user to configure WiFi SSID/password, server, MQTT, and OTA settings

class WiFiProvisioner {
public:
    WiFiProvisioner();

    // Start AP mode and web portal
    bool startAP(const char* apSSID, const char* apPassword);

    // Run the web server (call in loop while provisioning)
    void handleClient();

    // Check if provisioning is complete (user submitted form)
    bool isProvisioned();

    // Stop AP mode
    void stopAP();

    // Get configured values
    String getSSID();
    String getPassword();
    String getServerHost();
    String getServerPort();
    String getMQTTBroker();
    String getMQTTPort();
    String getPairingCode();
    String getNgrokDomain();
    String getConnectionMode();
    String getApiKey();

private:
    WebServer server;
    bool provisioned;
    String cfg_ssid;
    String cfg_password;
    String cfg_server_host;
    String cfg_server_port;
    String cfg_mqtt_broker;
    String cfg_mqtt_port;
    String cfg_pairing_code;
    String cfg_ngrok_domain;
    String cfg_conn_mode;
    String cfg_api_key;

    void handleRoot();
    void handleSave();
    void handleScan();
    String generateHTML();
};

#endif // WIFI_PROVISION_H
