import { EventEmitter } from 'events';
import { PatientProfile, DeviceState, VitalReading, BleNotification } from './types';
import { VitalsGenerator } from './vitals-generator';
import {
  BLE_CHARACTERISTICS,
  encodeHeartRate,
  encodeTemperature,
  encodeSpo2,
  encodeBattery,
  encodeFallAlert,
} from './ble-protocol';
import { config } from './config';

export class Device extends EventEmitter {
  public state: DeviceState = 'ADVERTISING';
  public readonly id: number;
  public readonly name: string;
  public readonly profile: PatientProfile;
  private generator: VitalsGenerator;
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastReading: VitalReading | null = null;

  constructor(id: number, profile: PatientProfile) {
    super();
    this.id = id;
    this.name = `${config.devicePrefix}-${String(id).padStart(3, '0')}`;
    this.profile = profile;
    this.generator = new VitalsGenerator(profile);
  }

  connect(): void {
    if (this.state === 'CONNECTED') return;
    this.state = 'CONNECTED';
    this.startVitalsStream();
    console.log(`[Device ${this.name}] Connected (profile: ${this.profile.name})`);
  }

  disconnect(): void {
    this.state = 'ADVERTISING';
    this.stopVitalsStream();
    console.log(`[Device ${this.name}] Disconnected`);
  }

  getAdvertisement() {
    return {
      id: this.id,
      name: this.name,
      rssi: -50 - Math.floor(Math.random() * 30), // -50 to -80 dBm
    };
  }

  getLastReading(): VitalReading | null {
    return this.lastReading;
  }

  private startVitalsStream(): void {
    this.stopVitalsStream();
    // Emit immediately, then on interval
    this.emitVitals();
    this.interval = setInterval(() => this.emitVitals(), config.readingIntervalMs);
  }

  private stopVitalsStream(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private emitVitals(): void {
    const vitals = this.generator.generate();
    this.lastReading = vitals;

    // Emit BLE-style characteristic notifications
    const notifications: BleNotification[] = [
      { characteristic: BLE_CHARACTERISTICS.HEART_RATE, data: encodeHeartRate(vitals.hr, vitals.rr) },
      { characteristic: BLE_CHARACTERISTICS.TEMPERATURE, data: encodeTemperature(vitals.temp) },
      { characteristic: BLE_CHARACTERISTICS.SPO2, data: encodeSpo2(vitals.spo2) },
      { characteristic: BLE_CHARACTERISTICS.BATTERY, data: encodeBattery(vitals.battery) },
    ];

    if (vitals.fall) {
      notifications.push({
        characteristic: BLE_CHARACTERISTICS.FALL_ALERT,
        data: encodeFallAlert(true),
      });
    }

    for (const notification of notifications) {
      this.emit('notification', notification);
    }

    // Also emit the decoded vitals for convenience (used by gateway)
    this.emit('vitals', vitals);
  }
}
