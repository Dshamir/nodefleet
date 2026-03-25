import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { config } from './config';
import { DeviceVitals } from './types';

interface DeviceAd {
  id: number;
  name: string;
  rssi: number;
}

export class DeviceConnector extends EventEmitter {
  private deviceSockets: Map<number, WebSocket> = new Map();
  private scanSocket: WebSocket | null = null;

  async connectToDevices(): Promise<number[]> {
    console.log(`[DeviceConnector] Scanning for devices at ${config.deviceEmulatorUrl}/scan`);

    return new Promise((resolve, reject) => {
      const scanUrl = `${config.deviceEmulatorUrl}/scan`;
      this.scanSocket = new WebSocket(scanUrl);

      this.scanSocket.on('open', () => {
        console.log('[DeviceConnector] Scan connection established');
      });

      this.scanSocket.on('message', async (data: Buffer) => {
        try {
          const devices: DeviceAd[] = JSON.parse(data.toString());
          console.log(`[DeviceConnector] Discovered ${devices.length} devices`);

          // Connect to each device that we haven't connected to yet
          const connected: number[] = [];
          for (const device of devices) {
            if (!this.deviceSockets.has(device.id)) {
              await this.connectToDevice(device.id);
              connected.push(device.id);
            }
          }

          if (connected.length > 0 || this.deviceSockets.size >= config.patientCount) {
            resolve(Array.from(this.deviceSockets.keys()));
          }
        } catch (err) {
          console.error('[DeviceConnector] Scan parse error:', err);
        }
      });

      this.scanSocket.on('error', (err) => {
        console.error('[DeviceConnector] Scan connection error:', err.message);
        reject(err);
      });

      // Timeout after 30s
      setTimeout(() => {
        if (this.deviceSockets.size > 0) {
          resolve(Array.from(this.deviceSockets.keys()));
        } else {
          reject(new Error('No devices found within 30s'));
        }
      }, 30_000);
    });
  }

  private async connectToDevice(deviceId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const deviceUrl = `${config.deviceEmulatorUrl}/device/${deviceId}`;
      const ws = new WebSocket(deviceUrl);

      ws.on('open', () => {
        console.log(`[DeviceConnector] Connected to device ${deviceId}`);
        this.deviceSockets.set(deviceId, ws);
        resolve();
      });

      ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'vitals') {
            this.emit('vitals', deviceId, msg as DeviceVitals);
          }
          // Ignore BLE notification messages — we use the convenience vitals event
        } catch {
          // Ignore non-JSON
        }
      });

      ws.on('close', () => {
        console.log(`[DeviceConnector] Device ${deviceId} disconnected, reconnecting in 5s...`);
        this.deviceSockets.delete(deviceId);
        setTimeout(() => this.connectToDevice(deviceId), 5000);
      });

      ws.on('error', (err) => {
        console.error(`[DeviceConnector] Device ${deviceId} error:`, err.message);
        reject(err);
      });
    });
  }

  close(): void {
    this.scanSocket?.close();
    for (const [id, ws] of this.deviceSockets) {
      ws.close();
    }
    this.deviceSockets.clear();
  }
}
