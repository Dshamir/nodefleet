import {IDeviceBindingRepository} from '../repositories/device-binding.repository';
import {DeviceBinding} from 'domain/entities/device-binding.entity';

export class GetBindingsUseCase {
    constructor(private readonly repository: IDeviceBindingRepository) {}

    async getByUser(userId: string): Promise<DeviceBinding[]> {
        return this.repository.getBindingsByUser(userId);
    }

    async getBySerial(deviceSerial: string): Promise<DeviceBinding | null> {
        return this.repository.getActiveBinding(deviceSerial);
    }
}
