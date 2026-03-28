#include "battery.h"
#include "config.h"

BatteryGauge::BatteryGauge(int sda, int scl)
    : sda_pin(sda), scl_pin(scl), connected(false) {
}

bool BatteryGauge::begin() {
    Wire.begin(sda_pin, scl_pin);

    // Check if MAX17048 responds
    Wire.beginTransmission(MAX17048_ADDR);
    uint8_t err = Wire.endTransmission();

    if (err == 0) {
        connected = true;
        uint16_t ver = readVersion();
        LOG_INFO("MAX17048 fuel gauge detected (version: 0x%04X)", ver);
        return true;
    }

    LOG_WARN("MAX17048 not detected on I2C (error: %d). Battery monitoring disabled.", err);
    connected = false;
    return false;
}

bool BatteryGauge::isConnected() {
    return connected;
}

uint16_t BatteryGauge::readRegister(uint8_t reg) {
    Wire.beginTransmission(MAX17048_ADDR);
    Wire.write(reg);
    if (Wire.endTransmission(false) != 0) {
        return 0;
    }

    Wire.requestFrom(MAX17048_ADDR, (uint8_t)2);
    if (Wire.available() < 2) {
        return 0;
    }

    uint16_t msb = Wire.read();
    uint16_t lsb = Wire.read();
    return (msb << 8) | lsb;
}

float BatteryGauge::readVoltage() {
    if (!connected) return 0.0;

    uint16_t raw = readRegister(MAX17048_VCELL);
    // VCELL is a 12-bit value (top 12 bits of 16-bit register)
    // Resolution: 1.25mV per unit (78.125uV per LSB of 16-bit)
    return (float)raw * 78.125 / 1000000.0;  // Convert to volts
}

float BatteryGauge::readSOC() {
    if (!connected) return 0.0;

    uint16_t raw = readRegister(MAX17048_SOC);
    // SOC high byte = integer %, low byte = 1/256 %
    return (float)(raw >> 8) + (float)(raw & 0xFF) / 256.0;
}

float BatteryGauge::readChargeRate() {
    if (!connected) return 0.0;

    uint16_t raw = readRegister(MAX17048_CRATE);
    // CRATE is signed 16-bit, units of 0.208%/hr
    int16_t signed_raw = (int16_t)raw;
    return (float)signed_raw * 0.208;
}

uint16_t BatteryGauge::readVersion() {
    return readRegister(MAX17048_VERSION);
}
