import {IDeviceBindingRepository} from '../repositories/device-binding.repository';

export class UnbindDeviceUseCase {
    constructor(private readonly repository: IDeviceBindingRepository) {}

    async execute(deviceSerial: string): Promise<void> {
        return this.repository.unbind(deviceSerial);
    }
}
