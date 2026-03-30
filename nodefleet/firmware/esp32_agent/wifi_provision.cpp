#include "wifi_provision.h"
#include "config.h"

WiFiProvisioner::WiFiProvisioner()
    : server(AP_PORTAL_PORT), provisioned(false) {
}

bool WiFiProvisioner::startAP(const char* apSSID, const char* apPassword) {
    LOG_INFO("Starting WiFi provisioning AP: %s", apSSID);

    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP(apSSID, apPassword);

    IPAddress ip = WiFi.softAPIP();
    LOG_INFO("AP started. Portal at http://%s", ip.toString().c_str());

    server.on("/", [this]() { handleRoot(); });
    server.on("/save", HTTP_POST, [this]() { handleSave(); });
    server.on("/scan", [this]() { handleScan(); });
    server.onNotFound([this]() { handleRoot(); });  // Captive portal redirect

    server.begin();
    return true;
}

void WiFiProvisioner::handleClient() {
    server.handleClient();
}

bool WiFiProvisioner::isProvisioned() {
    return provisioned;
}

void WiFiProvisioner::stopAP() {
    server.stop();
    WiFi.softAPdisconnect(true);
    WiFi.mode(WIFI_STA);
    LOG_INFO("AP stopped");
}

String WiFiProvisioner::getSSID() { return cfg_ssid; }
String WiFiProvisioner::getPassword() { return cfg_password; }
String WiFiProvisioner::getServerHost() { return cfg_server_host; }
String WiFiProvisioner::getServerPort() { return cfg_server_port; }
String WiFiProvisioner::getMQTTBroker() { return cfg_mqtt_broker; }
String WiFiProvisioner::getMQTTPort() { return cfg_mqtt_port; }
String WiFiProvisioner::getPairingCode() { return cfg_pairing_code; }
String WiFiProvisioner::getNgrokDomain() { return cfg_ngrok_domain; }
String WiFiProvisioner::getConnectionMode() { return cfg_conn_mode; }
String WiFiProvisioner::getApiKey() { return cfg_api_key; }

void WiFiProvisioner::handleRoot() {
    server.send(200, "text/html", generateHTML());
}

void WiFiProvisioner::handleScan() {
    int n = WiFi.scanNetworks();
    String json = "[";
    for (int i = 0; i < n; i++) {
        if (i > 0) json += ",";
        json += "\"" + WiFi.SSID(i) + "\"";
    }
    json += "]";
    server.send(200, "application/json", json);
}

void WiFiProvisioner::handleSave() {
    cfg_ssid = server.arg("ssid");
    cfg_password = server.arg("password");
    cfg_server_host = server.arg("server_host");
    cfg_server_port = server.arg("server_port");
    cfg_mqtt_broker = server.arg("mqtt_broker");
    cfg_mqtt_port = server.arg("mqtt_port");
    cfg_pairing_code = server.arg("pairing_code");
    cfg_ngrok_domain = server.arg("ngrok_domain");
    cfg_conn_mode = server.arg("conn_mode");
    cfg_api_key = server.arg("api_key");

    LOG_INFO("Provisioning saved: SSID=%s Server=%s:%s ngrok=%s mode=%s",
             cfg_ssid.c_str(), cfg_server_host.c_str(), cfg_server_port.c_str(),
             cfg_ngrok_domain.c_str(), cfg_conn_mode.c_str());

    String html = R"(<!DOCTYPE html><html><head>
<meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
<title>NodeFleet - Saved</title>
<style>body{background:#0f172a;color:#e2e8f0;font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}
.card{background:#1e293b;padding:2rem;border-radius:12px;text-align:center;max-width:400px}
h1{color:#22c55e;font-size:1.5rem}p{color:#94a3b8}</style>
</head><body><div class='card'>
<h1>Configuration Saved</h1>
<p>Device will restart and connect to <strong>)" + cfg_ssid + R"(</strong></p>
<p>Rebooting in 3 seconds...</p>
</div></body></html>)";

    server.send(200, "text/html", html);
    provisioned = true;
}

String WiFiProvisioner::generateHTML() {
    String html = "<!DOCTYPE html><html><head>"
        "<meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>NodeFleet Device Setup</title>"
        "<style>"
        "*{box-sizing:border-box;margin:0;padding:0}"
        "body{background:#0f172a;color:#e2e8f0;font-family:system-ui;display:flex;justify-content:center;padding:2rem}"
        ".card{background:#1e293b;padding:2rem;border-radius:12px;width:100%;max-width:480px}"
        "h1{color:#38bdf8;font-size:1.4rem;margin-bottom:0.5rem}"
        "h2{color:#94a3b8;font-size:0.9rem;font-weight:normal;margin-bottom:1.5rem}"
        ".section{margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid #334155}"
        ".section-title{color:#38bdf8;font-size:0.8rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:0.8rem}"
        "label{display:block;color:#94a3b8;font-size:0.85rem;margin-bottom:0.3rem}"
        "input,select{width:100%;padding:0.6rem;background:#0f172a;border:1px solid #334155;border-radius:6px;color:#e2e8f0;font-size:0.9rem;margin-bottom:0.8rem}"
        "input:focus,select:focus{outline:none;border-color:#38bdf8}"
        "button{width:100%;padding:0.8rem;background:#2563eb;color:white;border:none;border-radius:8px;font-size:1rem;cursor:pointer;font-weight:600}"
        "button:hover{background:#1d4ed8}"
        "</style></head><body><div class='card'>"
        "<h1>NodeFleet Device Setup</h1>"
        "<h2>Configure your ESP32-S3 SIM7670G</h2>"
        "<form action='/save' method='POST'>"
        "<div class='section'><div class='section-title'>WiFi Network</div>"
        "<label>SSID</label>"
        "<input type='text' name='ssid' value='" + String(WIFI_SSID) + "' placeholder='WiFi network name'>"
        "<label>Password</label>"
        "<input type='password' name='password' value='" + String(WIFI_PASSWORD) + "' placeholder='WiFi password'>"
        "</div>"
        "<div class='section'><div class='section-title'>NodeFleet Server</div>"
        "<label>Server Host</label>"
        "<input type='text' name='server_host' value='" + String(SERVER_HOST) + "' placeholder='192.168.0.19'>"
        "<label>API Port</label>"
        "<input type='text' name='server_port' value='" + String(SERVER_PORT_HTTP) + "' placeholder='50300'>"
        "</div>"
        "<div class='section'><div class='section-title'>Remote Access</div>"
        "<label>ngrok Domain</label>"
        "<input type='text' name='ngrok_domain' value='" + String(NGROK_DOMAIN) + "' placeholder='nodefleet.ngrok.dev'>"
        "<label>Connection Mode</label>"
        "<select name='conn_mode'>"
        "<option value='auto' selected>Auto (try local, fall back to remote)</option>"
        "<option value='local'>Local only (WiFi direct)</option>"
        "<option value='remote'>Remote only (ngrok/LTE)</option>"
        "</select>"
        "<label>API Key (optional)</label>"
        "<input type='text' name='api_key' placeholder='nf_xxxxxxxx_xxxxxxxx'>"
        "</div>"
        "<div class='section'><div class='section-title'>MQTT Broker (optional override)</div>"
        "<label>Broker Host</label>"
        "<input type='text' name='mqtt_broker' value='" + String(MQTT_BROKER_HOST) + "' placeholder='192.168.0.19'>"
        "<label>Broker Port</label>"
        "<input type='text' name='mqtt_port' value='" + String(MQTT_BROKER_PORT) + "' placeholder='51883'>"
        "</div>"
        "<div class='section'><div class='section-title'>Device Pairing</div>"
        "<label>Pairing Code</label>"
        "<input type='text' name='pairing_code' value='" + String(PAIRING_CODE) + "' placeholder='ABC123' maxlength='10'>"
        "</div>"
        "<button type='submit'>Save &amp; Connect</button>"
        "</form></div></body></html>";
    return html;
}
