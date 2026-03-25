import { Device } from './device';
import { PATIENT_PROFILES } from './patient-profiles';
import { config } from './config';

export class DeviceManager {
  private devices: Map<number, Device> = new Map();

  constructor() {
    for (let i = 0; i < config.deviceCount; i++) {
      const profile = PATIENT_PROFILES[i % PATIENT_PROFILES.length];
      const device = new Device(i, profile);
      this.devices.set(i, device);
    }
    console.log(`[DeviceManager] Created ${config.deviceCount} virtual devices`);
  }

  getDevice(id: number): Device | undefined {
    return this.devices.get(id);
  }

  getAllDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  getAdvertisingDevices() {
    return this.getAllDevices()
      .filter(d => d.state === 'ADVERTISING' || d.state === 'CONNECTED')
      .map(d => d.getAdvertisement());
  }
}
