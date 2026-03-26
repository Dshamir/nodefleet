import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {DeviceBindingModel} from './models/device-binding.model';
import {DeviceBindingRepository} from './repositories/device-binding.repository';
import {IDeviceBindingRepository} from 'app/modules/device-binding/repositories/device-binding.repository';
import {DeviceBindingUseCasesFactory} from 'app/modules/device-binding/factories/device-binding-use-cases.factory';
import {DeviceBindingController} from 'controllers/device-binding.controller';
import {AuthModule} from 'infrastructure/modules/auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([DeviceBindingModel]),
        AuthModule,
    ],
    controllers: [DeviceBindingController],
    providers: [
        {
            provide: IDeviceBindingRepository,
            useClass: DeviceBindingRepository,
        },
        DeviceBindingUseCasesFactory,
    ],
    exports: [IDeviceBindingRepository],
})
export class DeviceBindingModule {}
