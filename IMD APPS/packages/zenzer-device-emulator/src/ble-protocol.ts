export const BLE_CHARACTERISTICS = {
  BATTERY: '00002a19-0000-1000-8000-00805f9b34fb',
  HEART_RATE: '00002a37-0000-1000-8000-00805f9b34fb',
  TEMPERATURE: '00002a1c-0000-1000-8000-00805f9b34fb',
  SPO2: '00002a5f-0000-1000-8000-00805f9b34fb',
  FALL_ALERT: '00002a46-0000-1000-8000-00805f9b34fb',
  FIRMWARE: '00002a26-0000-1000-8000-00805f9b34fb',
} as const;

// GATT Device Information Service (0x180A)
export const DEVICE_INFO_SERVICE = '0000180a-0000-1000-8000-00805f9b34fb';
export const DEVICE_INFO_CHARACTERISTICS = {
  MODEL_NUMBER: '00002a24-0000-1000-8000-00805f9b34fb',
  SERIAL_NUMBER: '00002a25-0000-1000-8000-00805f9b34fb',
  FIRMWARE_REVISION: '00002a26-0000-1000-8000-00805f9b34fb',
  HARDWARE_REVISION: '00002a27-0000-1000-8000-00805f9b34fb',
  MANUFACTURER_NAME: '00002a29-0000-1000-8000-00805f9b34fb',
} as const;

export function encodeHeartRate(hr: number, rr?: number): number[] {
  const result = [Math.round(hr)];
  if (rr !== undefined) result.push(Math.round(rr));
  return result;
}

export function encodeTemperature(tempCelsius: number): number[] {
  // 3-byte big-endian raw int: value * 100
  const raw = Math.round(tempCelsius * 100);
  return [0, (raw >> 16) & 0xff, (raw >> 8) & 0xff, raw & 0xff];
}

export function encodeSpo2(spo2: number): number[] {
  return [Math.round(spo2)];
}

export function encodeBattery(percent: number): number[] {
  return [Math.round(Math.max(0, Math.min(100, percent)))];
}

export function encodeFallAlert(fell: boolean): number[] {
  return [fell ? 1 : 0];
}
