export interface VitalReading {
  hr: number;
  spo2: number;
  temp: number;
  rr: number;
  sbp: number;
  dbp: number;
  battery: number;
  fall: boolean;
  fallType: number | null;
  timestamp: number;
}

export interface PatientProfile {
  name: string;
  baselineHr: number;
  baselineSpo2: number;
  baselineTemp: number;
  baselineRr: number;
  baselineSbp: number;
  baselineDbp: number;
  abnormalProbability: number;
}

export interface DeviceAdvertisement {
  id: number;
  name: string;
  rssi: number;
}

export type DeviceState = 'ADVERTISING' | 'CONNECTED' | 'DISCONNECTED';

export interface BleNotification {
  characteristic: string;
  data: number[];
}

export interface BleWriteCommand {
  action: 'write';
  characteristic: string;
  data: number[];
}
