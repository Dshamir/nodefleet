import { DeviceManager } from './device-manager';
import { createWsServer } from './ws-server';
import { config } from './config';

function main(): void {
  console.log('=== Zenzer Device Emulator ===');
  console.log(`Devices: ${config.deviceCount}`);
  console.log(`WS Port: ${config.wsPort}`);
  console.log(`Reading Interval: ${config.readingIntervalMs}ms`);
  console.log('');

  const deviceManager = new DeviceManager();
  const server = createWsServer(deviceManager);

  server.listen(config.wsPort, () => {
    console.log(`[Server] WebSocket server listening on port ${config.wsPort}`);
    console.log(`[Server] Scan:    ws://localhost:${config.wsPort}/scan`);
    console.log(`[Server] Device:  ws://localhost:${config.wsPort}/device/{id}`);
    console.log(`[Server] Health:  http://localhost:${config.wsPort}/health`);
  });

  process.on('SIGTERM', () => {
    console.log('[Server] Shutting down...');
    server.close();
    process.exit(0);
  });
}

main();
