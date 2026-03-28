#ifndef BATTERY_H
#define BATTERY_H

#include <Arduino.h>
#include <Wire.h>

// MAX17048 I2C Fuel Gauge — Waveshare ESP32-S3-SIM7670G-4G
// Address: 0x36
// Shares I2C bus with camera SCCB (GPIO15/16)

#define MAX17048_ADDR     0x36
#define MAX17048_VCELL    0x02  // Voltage register (12-bit, 1.25mV/unit)
#define MAX17048_SOC      0x04  // State of charge (%)
#define MAX17048_MODE     0x06  // Mode register
#define MAX17048_VERSION  0x08  // IC version
#define MAX17048_CONFIG   0x0C  // Configuration
#define MAX17048_CRATE    0x16  // Charge/discharge rate (%/hr)

class BatteryGauge {
public:
    BatteryGauge(int sda_pin = 15, int scl_pin = 16);

    bool begin();
    bool isConnected();

    float readVoltage();      // Returns voltage in V (e.g., 3.85)
    float readSOC();          // Returns state of charge 0-100%
    float readChargeRate();   // Returns charge rate in %/hr (negative = discharging)
    uint16_t readVersion();   // Returns IC version

private:
    int sda_pin;
    int scl_pin;
    bool connected;

    uint16_t readRegister(uint8_t reg);
};

#endif // BATTERY_H
