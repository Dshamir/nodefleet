import { PatientMapping } from './types';

export class PatientMapper {
  private deviceToPatient: Map<number, PatientMapping> = new Map();

  setMappings(patients: PatientMapping[]): void {
    for (const patient of patients) {
      this.deviceToPatient.set(patient.deviceIndex, patient);
    }
    console.log(`[PatientMapper] Mapped ${patients.length} devices to patients`);
  }

  getPatientUserId(deviceIndex: number): string | undefined {
    return this.deviceToPatient.get(deviceIndex)?.userId;
  }

  getAllMappings(): PatientMapping[] {
    return Array.from(this.deviceToPatient.values());
  }
}
