import {IDeviceBindingRepository} from '../repositories/device-binding.repository';
import {DeviceBinding} from 'domain/entities/device-binding.entity';

export class BindDeviceUseCase {
    constructor(private readonly repository: IDeviceBindingRepository) {}

    async execute(deviceSerial: string, userId: string, relayType: string, relayId: string): Promise<DeviceBinding> {
        return this.repository.bind(deviceSerial, userId, relayType, relayId);
    }
}
