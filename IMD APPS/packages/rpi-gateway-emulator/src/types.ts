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

export interface GatewayVitalPayload {
  vitals: Array<{
    userId: string;
    relayType?: string;
    relayId?: string;
    vitals: Array<{
      timestamp: number;
      hr?: number;
      spo2?: number;
      temp?: number;
      rr?: number;
      sbp?: number;
      dbp?: number;
      fall?: boolean;
      fallType?: number | null;
      deviceSerial?: string;
    }>;
  }>;
}

export interface PatientMapping {
  deviceIndex: number;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  deviceSerial?: string;
}

export interface SeedResult {
  gatewayUserId: string;
  patients: PatientMapping[];
}

export interface DeviceVitals {
  type: 'vitals';
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
