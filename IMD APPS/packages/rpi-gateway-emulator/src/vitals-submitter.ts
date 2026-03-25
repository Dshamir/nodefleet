import { config } from './config';
import { authenticate } from './auth';
import { GatewayVitalPayload } from './types';

export async function submitVitals(payload: GatewayVitalPayload): Promise<void> {
  const token = await authenticate();

  const totalReadings = payload.vitals.reduce((sum, v) => sum + v.vitals.length, 0);
  console.log(`[Submitter] Posting ${totalReadings} vitals for ${payload.vitals.length} patients`);

  const res = await fetch(`${config.medicalApiUrl}/gateway/vitals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[Submitter] Failed: ${res.status} ${body}`);
    throw new Error(`Vitals submission failed: ${res.status}`);
  }

  console.log(`[Submitter] Successfully submitted ${totalReadings} vitals`);
}
