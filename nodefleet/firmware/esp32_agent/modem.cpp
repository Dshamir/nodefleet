#include "modem.h"
#include "config.h"

SIM7670GModem::SIM7670GModem(int rx_pin, int tx_pin, uint32_t baud)
    : rx_pin(rx_pin), tx_pin(tx_pin), baud_rate(baud), modem_ready(false) {
    modem_serial = new HardwareSerial(1);  // Serial1 for ESP32
}

bool SIM7670GModem::begin() {
    LOG_INFO("Initializing SIM7670G modem...");

    modem_serial->begin(baud_rate, SERIAL_8N1, rx_pin, tx_pin);

    // Wait for modem to boot (may take several seconds after power-on)
    delay(3000);

    // Try AT command with multiple retries (modem may need time to initialize UART)
    String response;
    bool modem_found = false;

    for (int attempt = 0; attempt < 5; attempt++) {
        LOG_INFO("Modem AT probe attempt %d/5...", attempt + 1);

        // Flush any garbage from serial buffer
        while (modem_serial->available()) {
            modem_serial->read();
        }

        if (sendAT("AT", response, 2000)) {
            LOG_INFO("Modem responding: %s", response.c_str());
            modem_found = true;
            break;
        }

        delay(2000);
    }

    if (!modem_found) {
        LOG_ERROR("Modem not responding after 5 attempts");
        return false;
    }

    // Disable echo
    sendAT("ATE0", response, 1000);

    // Check SIM
    if (!checkSIM()) {
        LOG_ERROR("SIM check failed");
        return false;
    }

    LOG_INFO("SIM detected");

    // Enable cellular connection
    if (!enableCellular()) {
        LOG_WARN("Cellular registration pending, will retry in background");
        // Don't fail hard - modem is alive, just not registered yet
    }

    modem_ready = true;
    LOG_INFO("Modem initialized successfully");
    return true;
}

bool SIM7670GModem::checkSIM() {
    String response;
    if (!sendAT("AT+CPIN?", response, 2000)) {
        return false;
    }
    // Expected response: +CPIN: READY
    return response.indexOf("READY") != -1 || response.indexOf("SIM PIN") != -1;
}

bool SIM7670GModem::waitForNetworkRegistration(uint32_t timeout_ms) {
    LOG_INFO("Waiting for network registration...");
    uint32_t start_time = millis();
    String response;

    while (millis() - start_time < timeout_ms) {
        // Try LTE registration first (AT+CEREG), then fall back to 2G/3G (AT+CREG)
        if (sendAT("AT+CEREG?", response, 1000)) {
            // stat=1 (registered home) or stat=5 (registered roaming)
            if (response.indexOf(",1") != -1 || response.indexOf(",5") != -1) {
                LOG_INFO("LTE network registered");
                return true;
            }
        }
        if (sendAT("AT+CREG?", response, 1000)) {
            if (response.indexOf(",1") != -1 || response.indexOf(",5") != -1) {
                LOG_INFO("2G/3G network registered");
                return true;
            }
        }
        delay(2000);
    }

    LOG_ERROR("Network registration timeout");
    return false;
}

bool SIM7670GModem::enableCellular() {
    String response;

    // Enable full functionality
    sendAT("AT+CFUN=1", response, 5000);

    return waitForNetworkRegistration();
}

bool SIM7670GModem::disableCellular() {
    String response;
    return sendAT("AT+CFUN=0", response, 2000);
}

bool SIM7670GModem::isConnected() {
    String response;
    // Check LTE registration first
    if (sendAT("AT+CEREG?", response, 1000)) {
        if (response.indexOf(",1") != -1 || response.indexOf(",5") != -1) {
            return true;
        }
    }
    // Fall back to 2G/3G
    if (sendAT("AT+CREG?", response, 1000)) {
        return response.indexOf(",1") != -1 || response.indexOf(",5") != -1;
    }
    return false;
}

bool SIM7670GModem::getSignalStrength(int& rssi, int& ber) {
    String response;
    if (!sendAT("AT+CSQ", response, 1000)) {
        return false;
    }

    // Parse: +CSQ: <rssi>,<ber>
    int comma_pos = response.indexOf(',');
    if (comma_pos != -1) {
        String rssi_str = response.substring(response.indexOf(":") + 1, comma_pos);
        String ber_str = response.substring(comma_pos + 1);

        rssi = atoi(rssi_str.c_str());
        ber = atoi(ber_str.c_str());

        LOG_VERBOSE("Signal strength: RSSI=%d, BER=%d", rssi, ber);
        return true;
    }

    return false;
}

bool SIM7670GModem::getNetworkInfo(String& operator_name, String& rat) {
    String response;

    if (!sendAT("AT+COPS?", response, 2000)) {
        return false;
    }

    // Parse: +COPS: <mode>,<format>,<oper>,<act>
    // Extract operator name and RAT (Radio Access Technology)
    int first_comma = response.indexOf(',');
    int second_comma = response.indexOf(',', first_comma + 1);
    int third_comma = response.indexOf(',', second_comma + 1);

    if (first_comma != -1 && second_comma != -1) {
        operator_name = response.substring(second_comma + 2, third_comma - 1);

        if (third_comma != -1) {
            rat = response.substring(third_comma + 1);
            // Parse RAT: 0=GSM, 1=GSM Compact, 2=UTRAN, 3=GSM w/EGPRS, 4=UTRAN w/HSDPA, 5=UTRAN w/HSUPA, 6=UTRAN w/HSUPA+HSDPA, 7=LTE, etc.
        }
        return true;
    }

    return false;
}

bool SIM7670GModem::enableGNSS() {
    String response;
    LOG_INFO("Enabling GNSS (GPS)...");

    // SIM7670G uses AT+CGPS=1 to enable GPS
    // First try to enable, ignore error if already enabled
    sendAT("AT+CGPS=1", response, 2000);

    delay(2000);
    LOG_INFO("GNSS enabled");
    return true;
}

bool SIM7670GModem::disableGNSS() {
    String response;
    return sendAT("AT+CGPS=0", response, 2000);
}

bool SIM7670GModem::getGPSFix(float& latitude, float& longitude, float& altitude, float& accuracy,
                               float& speed, float& heading, int& satellites) {
    String response;

    // SIM7670G uses AT+CGPSINFO instead of AT+CGNSINF
    if (!sendAT("AT+CGPSINFO", response, 3000)) {
        return false;
    }

    // Response format: +CGPSINFO: ddmm.mmmm,N/S,dddmm.mmmm,E/W,date,time,alt,speed,course
    // Example: +CGPSINFO: 4531.0216,N,07338.5976,W,270326,191126.000,61.6,0.54,144.40
    // Empty response means no fix: +CGPSINFO: ,,,,,,,,

    int colon = response.indexOf(":");
    if (colon == -1) {
        return false;
    }

    String data = response.substring(colon + 2);
    data.trim();

    // Check for empty/no-fix response
    if (data.startsWith(",") || data.length() < 10) {
        LOG_VERBOSE("No GPS fix yet");
        return false;
    }

    // Split CSV into fields
    String fields[10];
    int fieldCount = 0;
    int lastPos = 0;

    for (unsigned int i = 0; i <= data.length() && fieldCount < 10; i++) {
        if (i == data.length() || data[i] == ',') {
            fields[fieldCount++] = data.substring(lastPos, i);
            lastPos = i + 1;
        }
    }

    if (fieldCount < 9) {
        LOG_VERBOSE("CGPSINFO response too short (%d fields)", fieldCount);
        return false;
    }

    // Parse latitude: ddmm.mmmm format → decimal degrees
    // fields[0] = "4531.0216" (45 degrees, 31.0216 minutes)
    // fields[1] = "N" or "S"
    float lat_raw = fields[0].toFloat();
    int lat_deg = (int)(lat_raw / 100);
    float lat_min = lat_raw - (lat_deg * 100);
    latitude = lat_deg + (lat_min / 60.0);
    if (fields[1] == "S") latitude = -latitude;

    // Parse longitude: dddmm.mmmm format → decimal degrees
    // fields[2] = "07338.5976" (73 degrees, 38.5976 minutes)
    // fields[3] = "E" or "W"
    float lon_raw = fields[2].toFloat();
    int lon_deg = (int)(lon_raw / 100);
    float lon_min = lon_raw - (lon_deg * 100);
    longitude = lon_deg + (lon_min / 60.0);
    if (fields[3] == "W") longitude = -longitude;

    // fields[4] = date (ddmmyy)
    // fields[5] = time (hhmmss.sss)
    altitude = fields[6].toFloat();     // meters
    speed = fields[7].toFloat();         // km/h (knots on some firmware)
    heading = fields[8].toFloat();       // degrees

    // SIM7670G CGPSINFO doesn't provide HDOP or satellite count
    accuracy = 10.0;  // reasonable default
    satellites = 0;    // not available in this response

    LOG_INFO("GPS fix: %.6f, %.6f (alt:%.1fm spd:%.1fkm/h hdg:%.1f)",
             latitude, longitude, altitude, speed, heading);
    return true;
}

bool SIM7670GModem::httpGet(const String& url, String& response, uint32_t timeout_ms) {
    LOG_INFO("HTTP GET: %s", url.c_str());

    String cmd = "AT+HTTPTOFS=1," + url;
    if (!sendAT(cmd, response, timeout_ms)) {
        LOG_ERROR("HTTP GET failed");
        return false;
    }

    return true;
}

bool SIM7670GModem::httpPost(const String& url, const String& contentType, const uint8_t* data, size_t data_len, String& response, uint32_t timeout_ms) {
    LOG_INFO("HTTP POST: %s (%d bytes)", url.c_str(), data_len);

    // This is a simplified implementation
    // Production code should properly use AT+HTTPTOFS or AT+HTTPTOP commands with proper encoding

    String cmd = "AT+HTTPTOP=\"" + url + "\"," + String(data_len) + ",\"" + contentType + "\"";

    if (!sendAT(cmd, response, 2000)) {
        LOG_ERROR("HTTP POST init failed");
        return false;
    }

    // Send data
    modem_serial->write(data, data_len);
    delay(100);

    // Wait for response
    return waitResponse(response, timeout_ms);
}

bool SIM7670GModem::httpPostFile(const String& url, const String& file_path, String& response, uint32_t timeout_ms) {
    LOG_INFO("HTTP POST file: %s to %s", file_path.c_str(), url.c_str());

    // Implementation would depend on SD card availability
    // For now, return placeholder
    return false;
}

bool SIM7670GModem::sendAT(const String& cmd, String& response, uint32_t timeout_ms) {
    // Clear serial buffer
    while (modem_serial->available()) {
        modem_serial->read();
    }

    LOG_VERBOSE(">>> %s", cmd.c_str());

    // Send command
    modem_serial->println(cmd);

    // Wait for response
    return waitResponse(response, timeout_ms);
}

bool SIM7670GModem::waitResponse(String& response, uint32_t timeout_ms) {
    response = "";
    uint32_t start_time = millis();

    while (millis() - start_time < timeout_ms) {
        if (modem_serial->available()) {
            char c = modem_serial->read();
            response += c;

            // Check for OK or ERROR
            if (response.indexOf("OK") != -1 || response.indexOf("ERROR") != -1) {
                LOG_VERBOSE("<<< %s", response.c_str());
                return response.indexOf("OK") != -1;
            }
        }
        delay(10);
    }

    LOG_ERROR("Timeout waiting for response");
    return false;
}

bool SIM7670GModem::sendATCommand(const String& cmd, const String& expected_response, uint32_t timeout_ms) {
    String response;
    if (!sendAT(cmd, response, timeout_ms)) {
        return false;
    }
    return response.indexOf(expected_response) != -1;
}

String SIM7670GModem::parseATResponse(const String& response) {
    // Helper to extract relevant data from AT responses
    int start = response.indexOf(":") + 1;
    int end = response.indexOf("\r", start);
    if (end == -1) end = response.indexOf("\n", start);
    if (start != 0) {
        return response.substring(start, end);
    }
    return response;
}

bool SIM7670GModem::isModemReady() {
    return modem_ready;
}

void SIM7670GModem::powerOn() {
    if (MODEM_POWER_PIN != -1) {
        digitalWrite(MODEM_POWER_PIN, HIGH);
        delay(1000);
    }
}

void SIM7670GModem::powerOff() {
    if (MODEM_POWER_PIN != -1) {
        digitalWrite(MODEM_POWER_PIN, LOW);
    }
}

void SIM7670GModem::reset() {
    if (MODEM_RESET_PIN != -1) {
        digitalWrite(MODEM_RESET_PIN, LOW);
        delay(100);
        digitalWrite(MODEM_RESET_PIN, HIGH);
        delay(2000);
    }
}
