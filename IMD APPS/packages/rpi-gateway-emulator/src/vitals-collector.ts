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
  deviceSerial?: string;
}

export class VitalsCollector {
  // Buffer: deviceIndex → array of readings since last flush
  private buffer: Map<number, BufferedReading[]> = new Map();
  private patientMapper: PatientMapper;
  private gatewayUserId: string;

  constructor(patientMapper: PatientMapper, gatewayUserId: string) {
    this.patientMapper = patientMapper;
    this.gatewayUserId = gatewayUserId;
  }

  addReading(deviceIndex: number, vitals: DeviceVitals, deviceSerial?: string): void {
    if (!this.buffer.has(deviceIndex)) {
      this.buffer.set(deviceIndex, []);
    }
    this.buffer.get(deviceIndex)!.push({
      timestamp: vitals.timestamp,
      hr: Math.round(vitals.hr),
      spo2: Math.round(vitals.spo2),
      temp: Math.round(vitals.temp),
      rr: Math.round(vitals.rr),
      sbp: Math.round(vitals.sbp),
      dbp: Math.round(vitals.dbp),
      fall: vitals.fall,
      fallType: vitals.fallType,
      deviceSerial: deviceSerial || undefined,
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
        payload.vitals.push({
          userId,
          relayType: 'gateway',
          relayId: this.gatewayUserId,
          vitals: readings,
        });
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
