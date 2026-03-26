import { PatientMapping } from './types';

export class PatientMapper {
  private deviceToPatient: Map<number, PatientMapping> = new Map();

  setMappings(patients: PatientMapping[]): void {
    for (const patient of patients) {
      this.deviceToPatient.set(patient.deviceIndex, patient);
    }
    console.log(`[PatientMapper] Mapped ${patients.length} devices to patients`);
  }

  setDeviceSerial(deviceIndex: number, serial: string): void {
    const mapping = this.deviceToPatient.get(deviceIndex);
    if (mapping) {
      mapping.deviceSerial = serial;
      console.log(`[PatientMapper] Device ${deviceIndex} → serial ${serial}`);
    }
  }

  getPatientUserId(deviceIndex: number): string | undefined {
    return this.deviceToPatient.get(deviceIndex)?.userId;
  }

  getDeviceSerial(deviceIndex: number): string | undefined {
    return this.deviceToPatient.get(deviceIndex)?.deviceSerial;
  }

  getAllMappings(): PatientMapping[] {
    return Array.from(this.deviceToPatient.values());
  }
}
