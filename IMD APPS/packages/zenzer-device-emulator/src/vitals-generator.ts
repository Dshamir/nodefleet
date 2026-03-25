import { PatientProfile, VitalReading } from './types';

function gaussianRandom(mean: number, sigma: number): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * sigma;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getCircadianHrOffset(): number {
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 6) return -10;   // Night: deep rest
  if (hour >= 6 && hour < 9) return 5;     // Morning: waking up
  if (hour >= 9 && hour < 18) return 0;    // Day: baseline
  return -5;                                // Evening: winding down
}

interface AbnormalEpisode {
  hr: [number, number];
  spo2: [number, number];
  temp: [number, number];
  rr: [number, number];
}

const ABNORMAL_RANGES: AbnormalEpisode = {
  hr: [120, 150],     // Tachycardia
  spo2: [85, 92],     // Hypoxemia
  temp: [38.5, 40.0], // Fever
  rr: [25, 35],       // Tachypnea
};

const FALL_TYPES = [4, 5, 6, 7]; // Forward, Backward, Lateral, Vertical

export class VitalsGenerator {
  private battery = 100;

  constructor(private profile: PatientProfile) {}

  generate(): VitalReading {
    const isAbnormal = Math.random() < this.profile.abnormalProbability;
    const circadianOffset = getCircadianHrOffset();

    let hr: number;
    let spo2: number;
    let temp: number;
    let rr: number;

    if (isAbnormal) {
      // Pick one or two vitals to make abnormal
      const abnormalType = Math.floor(Math.random() * 4);
      hr = abnormalType === 0
        ? gaussianRandom((ABNORMAL_RANGES.hr[0] + ABNORMAL_RANGES.hr[1]) / 2, 5)
        : gaussianRandom(this.profile.baselineHr + circadianOffset, 3);
      spo2 = abnormalType === 1
        ? gaussianRandom((ABNORMAL_RANGES.spo2[0] + ABNORMAL_RANGES.spo2[1]) / 2, 1.5)
        : gaussianRandom(this.profile.baselineSpo2, 0.5);
      temp = abnormalType === 2
        ? gaussianRandom((ABNORMAL_RANGES.temp[0] + ABNORMAL_RANGES.temp[1]) / 2, 0.3)
        : gaussianRandom(this.profile.baselineTemp, 0.1);
      rr = abnormalType === 3
        ? gaussianRandom((ABNORMAL_RANGES.rr[0] + ABNORMAL_RANGES.rr[1]) / 2, 2)
        : gaussianRandom(this.profile.baselineRr, 1);
    } else {
      hr = gaussianRandom(this.profile.baselineHr + circadianOffset, 3);
      spo2 = gaussianRandom(this.profile.baselineSpo2, 0.5);
      temp = gaussianRandom(this.profile.baselineTemp, 0.1);
      rr = gaussianRandom(this.profile.baselineRr, 1);
    }

    // Blood pressure with correlated noise
    const sbp = gaussianRandom(this.profile.baselineSbp, 5);
    const dbp = gaussianRandom(this.profile.baselineDbp, 3);

    // Battery drain: ~0.1% per minute → ~0.008% per 5s cycle
    this.battery = Math.max(0, this.battery - 0.008 - Math.random() * 0.004);

    // Fall detection: 0.5% chance per cycle
    const fall = Math.random() < 0.005;
    const fallType = fall ? FALL_TYPES[Math.floor(Math.random() * FALL_TYPES.length)] : null;

    return {
      hr: clamp(Math.round(hr * 10) / 10, 30, 200),
      spo2: clamp(Math.round(spo2), 70, 100),
      temp: clamp(Math.round(temp * 10) / 10, 34.0, 42.0),
      rr: clamp(Math.round(rr), 8, 40),
      sbp: clamp(Math.round(sbp), 70, 220),
      dbp: clamp(Math.round(dbp), 40, 140),
      battery: Math.round(this.battery),
      fall,
      fallType,
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  getBattery(): number {
    return Math.round(this.battery);
  }

  resetBattery(): void {
    this.battery = 100;
  }
}
