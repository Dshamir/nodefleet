import { io, Socket } from 'socket.io-client';
import { config } from './config';
import { authenticate } from './auth';
import { DeviceVitals } from './types';
import { PatientMapper } from './patient-mapper';

export class WebSocketPublisher {
  private socket: Socket | null = null;
  private patientMapper: PatientMapper;

  constructor(patientMapper: PatientMapper) {
    this.patientMapper = patientMapper;
  }

  async connect(): Promise<void> {
    const token = await authenticate();

    this.socket = io(`${config.medicalApiUrl}/ws/current-vitals`, {
      auth: { token: `Bearer ${token}` },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 5000,
    });

    this.socket.on('connect', () => {
      console.log('[WSPublisher] Connected to /ws/current-vitals');
    });

    this.socket.on('connect_error', (err) => {
      console.error('[WSPublisher] Connection error:', err.message);
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[WSPublisher] Disconnected: ${reason}`);
    });
  }

  publish(deviceIndex: number, vitals: DeviceVitals, deviceSerial?: string): void {
    if (!this.socket?.connected) return;

    const userId = this.patientMapper.getPatientUserId(deviceIndex);
    if (!userId) return;

    this.socket.emit('messageToServer', {
      patientUserId: userId,
      hr: vitals.hr,
      spo2: vitals.spo2,
      temp: vitals.temp,
      rr: vitals.rr,
      sbp: vitals.sbp,
      dbp: vitals.dbp,
      fall: vitals.fall,
      fallType: vitals.fallType,
      battery: vitals.battery,
      deviceSerial: deviceSerial || undefined,
    });
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
  }
}
