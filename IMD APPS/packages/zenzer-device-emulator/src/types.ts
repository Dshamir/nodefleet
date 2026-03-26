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
  deviceSerial?: string;
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
  serialNumber: string;
  macAddress: string;
  firmwareVersion: string;
  modelNumber: string;
}

export type DeviceState = 'ADVERTISING' | 'CONNECTED' | 'PAIRED' | 'DISCONNECTED';

export interface DeviceInfoService {
  modelNumber: string;
  serialNumber: string;
  firmwareRevision: string;
  hardwareRevision: string;
  manufacturerName: string;
}

export interface DatasetUpload {
  readings: VitalReading[];
}

export interface BleNotification {
  characteristic: string;
  data: number[];
}

export interface BleWriteCommand {
  action: 'write' | 'pair' | 'unpair';
  characteristic?: string;
  data?: number[];
  userId?: string;
}
