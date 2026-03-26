import {Controller, Post, Delete, Get, Param, Body, HttpStatus, Inject} from '@nestjs/common';
import {ApiTags, ApiBearerAuth, ApiResponse} from '@nestjs/swagger';
import {DeviceBindingUseCasesFactory} from 'app/modules/device-binding/factories/device-binding-use-cases.factory';
import {BindDeviceView} from 'presentation/views/request/device-binding/bind-device.view';
import {IAuthedUserService} from 'app/modules/auth/services/authed-user.service';

@ApiTags('Device Binding')
@ApiBearerAuth()
@Controller('device-binding')
export class DeviceBindingController {
    constructor(
        private readonly useCasesFactory: DeviceBindingUseCasesFactory,
        @Inject(IAuthedUserService)
        private readonly authedUserService: IAuthedUserService,
    ) {}

    @Post()
    @ApiResponse({status: HttpStatus.CREATED, description: 'Device bound to user'})
    @ApiResponse({status: HttpStatus.BAD_REQUEST, description: 'Device already bound to another user'})
    async bindDevice(@Body() body: BindDeviceView) {
        const user = await this.authedUserService.getUser();
        const useCase = this.useCasesFactory.createBindDeviceUseCase();
        const binding = await useCase.execute(body.deviceSerial, user.id, body.relayType, body.relayId);
        return {
            id: binding.id,
            deviceSerial: binding.deviceSerial,
            userId: binding.userId,
            relayType: binding.relayType,
            relayId: binding.relayId,
            boundAt: binding.boundAt,
        };
    }

    @Delete(':serial')
    @ApiResponse({status: HttpStatus.OK, description: 'Device unbound'})
    async unbindDevice(@Param('serial') serial: string) {
        const useCase = this.useCasesFactory.createUnbindDeviceUseCase();
        await useCase.execute(serial);
        return {status: 'unbound', deviceSerial: serial};
    }

    @Get()
    @ApiResponse({status: HttpStatus.OK, description: 'List user bindings'})
    async getBindings() {
        const user = await this.authedUserService.getUser();
        const useCase = this.useCasesFactory.createGetBindingsUseCase();
        const bindings = await useCase.getByUser(user.id);
        return {
            bindings: bindings.map((b) => ({
                id: b.id,
                deviceSerial: b.deviceSerial,
                userId: b.userId,
                relayType: b.relayType,
                relayId: b.relayId,
                boundAt: b.boundAt,
            })),
        };
    }

    @Get(':serial')
    @ApiResponse({status: HttpStatus.OK, description: 'Binding status for device'})
    async getBindingBySerial(@Param('serial') serial: string) {
        const useCase = this.useCasesFactory.createGetBindingsUseCase();
        const binding = await useCase.getBySerial(serial);
        if (!binding) {
            return {bound: false, deviceSerial: serial};
        }
        return {
            bound: true,
            id: binding.id,
            deviceSerial: binding.deviceSerial,
            userId: binding.userId,
            relayType: binding.relayType,
            relayId: binding.relayId,
            boundAt: binding.boundAt,
        };
    }
}
