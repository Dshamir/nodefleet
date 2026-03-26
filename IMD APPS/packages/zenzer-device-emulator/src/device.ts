import { EventEmitter } from 'events';
import { PatientProfile, DeviceState, VitalReading, BleNotification, DeviceInfoService } from './types';
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

const SERIAL_SUFFIXES = ['A001', 'B002', 'C003', 'D004', 'E005', 'F006', 'G007', 'H008', 'I009', 'J010'];

export class Device extends EventEmitter {
  public state: DeviceState = 'ADVERTISING';
  public readonly id: number;
  public readonly name: string;
  public readonly profile: PatientProfile;
  public readonly serialNumber: string;
  public readonly macAddress: string;
  public readonly firmwareVersion: string = '1.0.0';
  public readonly modelNumber: string = 'ZENZERS-V1';
  public pairedUserId: string | null = null;
  private generator: VitalsGenerator;
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastReading: VitalReading | null = null;
  private dataset: VitalReading[] | null = null;
  private datasetIndex: number = 0;

  constructor(id: number, profile: PatientProfile) {
    super();
    this.id = id;
    this.name = `${config.devicePrefix}-${String(id).padStart(3, '0')}`;
    this.profile = profile;
    this.generator = new VitalsGenerator(profile);
    this.serialNumber = `${config.serialPrefix}-${SERIAL_SUFFIXES[id % SERIAL_SUFFIXES.length]}`;
    this.macAddress = `AA:BB:CC:DD:EE:${String(id).padStart(2, '0')}`;
  }

  connect(): void {
    if (this.state === 'CONNECTED' || this.state === 'PAIRED') return;
    this.state = 'CONNECTED';
    this.startVitalsStream();
    console.log(`[Device ${this.name}] Connected (profile: ${this.profile.name}, serial: ${this.serialNumber})`);
  }

  disconnect(): void {
    this.state = 'ADVERTISING';
    this.pairedUserId = null;
    this.stopVitalsStream();
    console.log(`[Device ${this.name}] Disconnected`);
  }

  pair(userId: string): void {
    if (this.state !== 'CONNECTED' && this.state !== 'PAIRED') return;
    this.state = 'PAIRED';
    this.pairedUserId = userId;
    console.log(`[Device ${this.name}] Paired to user ${userId}`);
  }

  unpair(): void {
    if (this.state !== 'PAIRED') return;
    this.state = 'CONNECTED';
    this.pairedUserId = null;
    console.log(`[Device ${this.name}] Unpaired`);
  }

  getAdvertisement() {
    return {
      id: this.id,
      name: this.name,
      rssi: -50 - Math.floor(Math.random() * 30),
      serialNumber: this.serialNumber,
      macAddress: this.macAddress,
      firmwareVersion: this.firmwareVersion,
      modelNumber: this.modelNumber,
    };
  }

  getDeviceInfo(): DeviceInfoService {
    return {
      modelNumber: this.modelNumber,
      serialNumber: this.serialNumber,
      firmwareRevision: this.firmwareVersion,
      hardwareRevision: '1.0',
      manufacturerName: 'ZENZERS Medical',
    };
  }

  getLastReading(): VitalReading | null {
    return this.lastReading;
  }

  loadDataset(readings: VitalReading[]): void {
    this.dataset = readings;
    this.datasetIndex = 0;
    console.log(`[Device ${this.name}] Dataset loaded: ${readings.length} readings`);
  }

  clearDataset(): void {
    this.dataset = null;
    this.datasetIndex = 0;
    console.log(`[Device ${this.name}] Dataset cleared, reverting to synthetic`);
  }

  getDatasetStatus(): { mode: 'synthetic' | 'playback'; totalReadings?: number; currentIndex?: number } {
    if (this.dataset) {
      return { mode: 'playback', totalReadings: this.dataset.length, currentIndex: this.datasetIndex };
    }
    return { mode: 'synthetic' };
  }

  private startVitalsStream(): void {
    this.stopVitalsStream();
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
    let vitals: VitalReading;

    if (this.dataset && this.dataset.length > 0) {
      vitals = { ...this.dataset[this.datasetIndex % this.dataset.length] };
      vitals.timestamp = Math.floor(Date.now() / 1000);
      this.datasetIndex++;
    } else {
      vitals = this.generator.generate();
    }

    vitals.deviceSerial = this.serialNumber;
    this.lastReading = vitals;

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

    this.emit('vitals', vitals);
  }
}
