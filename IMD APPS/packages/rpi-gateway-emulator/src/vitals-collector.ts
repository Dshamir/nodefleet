import { DeviceVitals, GatewayVitalPayload } from './types';
import { PatientMapper } from './patient-mapper';

interface BufferedReading {
  timestamp: number;
  hr: number;
  spo2: number;
  temp: number;
  rr: number;
  sbp: number;
  dbp: number;
  fall: boolean;
  fallType: number | null;
}

export class VitalsCollector {
  // Buffer: deviceIndex → array of readings since last flush
  private buffer: Map<number, BufferedReading[]> = new Map();
  private patientMapper: PatientMapper;

  constructor(patientMapper: PatientMapper) {
    this.patientMapper = patientMapper;
  }

  addReading(deviceIndex: number, vitals: DeviceVitals): void {
    if (!this.buffer.has(deviceIndex)) {
      this.buffer.set(deviceIndex, []);
    }
    this.buffer.get(deviceIndex)!.push({
      timestamp: vitals.timestamp,
      hr: vitals.hr,
      spo2: vitals.spo2,
      temp: vitals.temp,
      rr: vitals.rr,
      sbp: vitals.sbp,
      dbp: vitals.dbp,
      fall: vitals.fall,
      fallType: vitals.fallType,
    });
  }

  flush(): GatewayVitalPayload | null {
    if (this.buffer.size === 0) return null;

    const payload: GatewayVitalPayload = { vitals: [] };

    for (const [deviceIndex, readings] of this.buffer) {
      const userId = this.patientMapper.getPatientUserId(deviceIndex);
      if (!userId) {
        console.warn(`[VitalsCollector] No patient mapping for device ${deviceIndex}`);
        continue;
      }

      if (readings.length > 0) {
        payload.vitals.push({ userId, vitals: readings });
      }
    }

    this.buffer.clear();
    return payload.vitals.length > 0 ? payload : null;
  }

  getLatestReading(deviceIndex: number): BufferedReading | undefined {
    const readings = this.buffer.get(deviceIndex);
    return readings?.[readings.length - 1];
  }
}
