#ifndef MODEM_H
#define MODEM_H

#include <Arduino.h>
#include <HardwareSerial.h>

class SIM7670GModem {
public:
    SIM7670GModem(int rx_pin, int tx_pin, uint32_t baud = 115200);

    // Initialization
    bool begin();
    bool checkSIM();
    bool waitForNetworkRegistration(uint32_t timeout_ms = 30000);
    bool getSignalStrength(int& rssi, int& ber);

    // 4G/LTE connection
    bool enableCellular();
    bool disableCellular();
    bool isConnected();
    bool getNetworkInfo(String& operator_name, String& rat);

    // GPS Functions
    bool enableGNSS();
    bool disableGNSS();
    bool getGPSFix(float& latitude, float& longitude, float& altitude, float& accuracy,
                   float& speed, float& heading, int& satellites);

    // HTTP Operations via modem
    bool httpGet(const String& url, String& response, uint32_t timeout_ms = 10000);
    bool httpPost(const String& url, const String& contentType, const uint8_t* data, size_t data_len, String& response, uint32_t timeout_ms = 10000);
    bool httpPostFile(const String& url, const String& file_path, String& response, uint32_t timeout_ms = 30000);

    // Modem state
    bool isModemReady();
    void powerOn();
    void powerOff();
    void reset();

    // AT command interface
    bool sendAT(const String& cmd, String& response, uint32_t timeout_ms = 1000);

private:
    HardwareSerial* modem_serial;
    int rx_pin;
    int tx_pin;
    uint32_t baud_rate;
    bool modem_ready;

    // Helper functions
    bool waitResponse(String& response, uint32_t timeout_ms);
    bool sendATCommand(const String& cmd, const String& expected_response, uint32_t timeout_ms = 1000);
    String parseATResponse(const String& response);
};

#endif // MODEM_H
