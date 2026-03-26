import {Injectable, Inject} from '@nestjs/common';
import {IDeviceBindingRepository} from '../repositories/device-binding.repository';
import {BindDeviceUseCase} from '../use-cases/bind-device.use-case';
import {UnbindDeviceUseCase} from '../use-cases/unbind-device.use-case';
import {GetBindingsUseCase} from '../use-cases/get-bindings.use-case';

@Injectable()
export class DeviceBindingUseCasesFactory {
    constructor(
        @Inject(IDeviceBindingRepository)
        private readonly repository: IDeviceBindingRepository,
    ) {}

    createBindDeviceUseCase(): BindDeviceUseCase {
        return new BindDeviceUseCase(this.repository);
    }

    createUnbindDeviceUseCase(): UnbindDeviceUseCase {
        return new UnbindDeviceUseCase(this.repository);
    }

    createGetBindingsUseCase(): GetBindingsUseCase {
        return new GetBindingsUseCase(this.repository);
    }
}
