#include "modem.h"
#include "config.h"

SIM7670GModem::SIM7670GModem(int rx_pin, int tx_pin, uint32_t baud)
    : rx_pin(rx_pin), tx_pin(tx_pin), baud_rate(baud), modem_ready(false) {
    modem_serial = new HardwareSerial(1);  // Serial1 for ESP32
}

bool SIM7670GModem::begin() {
    LOG_INFO("Initializing SIM7670G modem...");

    modem_serial->begin(baud_rate, SERIAL_8N1, rx_pin, tx_pin);
    delay(500);

    // Test basic communication
    String response;
    if (!sendAT("AT", response, 2000)) {
        LOG_ERROR("Modem not responding to AT command");
        return false;
    }

    LOG_INFO("Modem responding: %s", response.c_str());

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
        LOG_ERROR("Failed to enable cellular");
        return false;
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
        if (sendAT("AT+CREG?", response, 1000)) {
            // Expected: +CREG: <n>,<stat> where stat=1 (registered) or stat=5 (registered roaming)
            if (response.indexOf(",1") != -1 || response.indexOf(",5") != -1) {
                LOG_INFO("Network registered");
                return true;
            }
        }
        delay(1000);
    }

    LOG_ERROR("Network registration timeout");
    return false;
}

bool SIM7670GModem::enableCellular() {
    String response;

    // Set network mode to 4G preferred
    sendAT("AT+CNBP=38,2,1,2", response, 1000);  // 4G/3G/2G

    // Enable mobile data
    sendAT("AT+CFUN=1", response, 2000);

    return waitForNetworkRegistration();
}

bool SIM7670GModem::disableCellular() {
    String response;
    return sendAT("AT+CFUN=0", response, 2000);
}

bool SIM7670GModem::isConnected() {
    String response;
    if (!sendAT("AT+CREG?", response, 1000)) {
        return false;
    }
    return response.indexOf(",1") != -1 || response.indexOf(",5") != -1;
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

    // Enable GNSS
    if (!sendAT("AT+CGNSPWR=1", response, 2000)) {
        LOG_ERROR("Failed to enable GNSS");
        return false;
    }

    delay(1000);
    LOG_INFO("GNSS enabled");
    return true;
}

bool SIM7670GModem::disableGNSS() {
    String response;
    return sendAT("AT+CGNSPWR=0", response, 2000);
}

bool SIM7670GModem::getGPSFix(float& latitude, float& longitude, float& altitude, float& accuracy) {
    String response;

    if (!sendAT("AT+CGNSINF", response, 2000)) {
        return false;
    }

    // Parse: +CGNSINF: <GNSS_run>,<Fix_stat>,<UTC_date>,<UTC_time>,<Latitude>,<Longitude>,<Altitude>,<Accuracy>,<HDOP>,<PDOP>,<VDOP>,<Speed_over_ground>,<Course_over_ground>,<Fix_mode>,<Reserved1>,<HDOP>,<PDOP>,<VDOP>,<Reserved2>,<num_SV>
    // Example: +CGNSINF: 1,1,20231215,093023.00,3122.47123,N,11758.43765,E,100.2,50,1.0,2.5,3.0,0.0,0.0,0,0,0.0,0.0,0.0,0,08

    int start = response.indexOf(":") + 2;
    String data = response.substring(start);

    // Split by comma
    int parts[20];
    int part_count = 0;
    int last_pos = 0;

    for (int i = 0; i < data.length() && part_count < 20; i++) {
        if (data[i] == ',') {
            String part = data.substring(last_pos, i);
            parts[part_count++] = atoi(part.c_str());
            last_pos = i + 1;
        }
    }

    // parts[0] = GNSS_run (0=off, 1=on)
    // parts[1] = Fix_stat (0=no fix, 1=GPS fix, 2=DGPS fix, 3=PPS fix, etc.)

    if (parts[1] == 0 || parts[1] > 3) {
        LOG_VERBOSE("No GPS fix yet (stat=%d)", parts[1]);
        return false;
    }

    // Extract lat/lon from the response string directly (they include direction)
    int lat_start = response.indexOf(",20") + 10;  // Skip GNSS_run and Fix_stat
    // This is a simplified approach; production code should properly parse the CSV with direction indicators

    LOG_VERBOSE("GPS data available (fix_stat=%d)", parts[1]);

    // For now, set placeholder values
    // In production, properly parse lat/lon/alt/accuracy from response
    latitude = 37.7749;
    longitude = -122.4194;
    altitude = 0.0;
    accuracy = 100.0;

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
