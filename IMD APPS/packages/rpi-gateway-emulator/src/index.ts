import { config } from './config';
import { seedEmulatorUsers } from './seed';
import { authenticate } from './auth';
import { DeviceConnector } from './device-connector';
import { VitalsCollector } from './vitals-collector';
import { PatientMapper } from './patient-mapper';
import { submitVitals } from './vitals-submitter';
import { WebSocketPublisher } from './websocket-publisher';
import { startHeartbeat, stopHeartbeat } from './heartbeat';
import { DeviceVitals } from './types';

async function waitForService(url: string, name: string, maxRetries = 60): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log(`[Startup] ${name} is ready`);
        return;
      }
    } catch {
      // Not ready yet
    }
    console.log(`[Startup] Waiting for ${name}... (${i + 1}/${maxRetries})`);
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error(`${name} not available after ${maxRetries} retries`);
}

async function main(): Promise<void> {
  console.log('=== RPi Gateway Emulator ===');
  console.log(`Medical API: ${config.medicalApiUrl}`);
  console.log(`Admin Backend: ${config.adminBackendUrl}`);
  console.log(`Device Emulator: ${config.deviceEmulatorUrl}`);
  console.log(`Patients: ${config.patientCount}`);
  console.log(`Submit Interval: ${config.submitIntervalMs}ms`);
  console.log('');

  // Step 1: Wait for dependencies
  await waitForService(`${config.medicalApiUrl}/api`, 'Medical API');
  await waitForService(`${config.adminBackendUrl}/api/health`, 'Admin Backend');
  await waitForService(
    `${config.deviceEmulatorUrl.replace('ws://', 'http://').replace('wss://', 'https://')}/health`,
    'Device Emulator',
  );

  // Step 2: Seed gateway + patient users
  const seedResult = await seedEmulatorUsers();
  console.log(`[Startup] Seeded: gateway=${seedResult.gatewayUserId}, patients=${seedResult.patients.length}`);

  // Step 3: Authenticate as gateway
  await authenticate();

  // Step 4: Set up patient mapper
  const patientMapper = new PatientMapper();
  patientMapper.setMappings(seedResult.patients);

  // Step 5: Connect to device emulator
  const deviceConnector = new DeviceConnector();
  const connectedDevices = await deviceConnector.connectToDevices();
  console.log(`[Startup] Connected to ${connectedDevices.length} devices`);

  // Step 6: Set up vitals collection + submission
  const collector = new VitalsCollector(patientMapper);
  const wsPublisher = new WebSocketPublisher(patientMapper);

  // Try to connect WS publisher (non-fatal if it fails)
  try {
    await wsPublisher.connect();
  } catch (err: any) {
    console.log(`[Startup] WebSocket publisher connection failed (non-fatal): ${err.message}`);
  }

  // Step 7: Listen for vitals from devices
  deviceConnector.on('vitals', (deviceIndex: number, vitals: DeviceVitals) => {
    collector.addReading(deviceIndex, vitals);
    // Also publish real-time via WebSocket
    wsPublisher.publish(deviceIndex, vitals);
  });

  // Step 8: Periodic batch submission
  const submitLoop = setInterval(async () => {
    const payload = collector.flush();
    if (payload) {
      try {
        await submitVitals(payload);
      } catch (err: any) {
        console.error(`[Main] Submission error: ${err.message}`);
      }
    }
  }, config.submitIntervalMs);

  // Step 9: Start heartbeat
  startHeartbeat();

  console.log('\n[Main] Gateway emulator running. Press Ctrl+C to stop.\n');

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Main] Shutting down...');
    clearInterval(submitLoop);
    stopHeartbeat();
    deviceConnector.close();
    wsPublisher.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[Fatal]', err);
  process.exit(1);
});
