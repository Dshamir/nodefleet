import {DeviceBinding} from 'domain/entities/device-binding.entity';

export abstract class IDeviceBindingRepository {
    abstract bind(deviceSerial: string, userId: string, relayType: string, relayId: string): Promise<DeviceBinding>;
    abstract unbind(deviceSerial: string): Promise<void>;
    abstract getActiveBinding(deviceSerial: string): Promise<DeviceBinding | null>;
    abstract getBindingsByUser(userId: string): Promise<DeviceBinding[]>;
}
