import {InjectRepository} from '@nestjs/typeorm';
import {Repository, IsNull} from 'typeorm';
import {IDeviceBindingRepository} from 'app/modules/device-binding/repositories/device-binding.repository';
import {DeviceBindingModel} from '../models/device-binding.model';
import {DeviceBinding} from 'domain/entities/device-binding.entity';
import {BadRequestException} from '@nestjs/common';

export class DeviceBindingRepository implements IDeviceBindingRepository {
    constructor(
        @InjectRepository(DeviceBindingModel)
        private readonly repository: Repository<DeviceBindingModel>,
    ) {}

    async bind(deviceSerial: string, userId: string, relayType: string, relayId: string): Promise<DeviceBinding> {
        // Check if device is already actively bound to another user
        const existing = await this.repository.findOne({
            where: {deviceSerial, unboundAt: IsNull()},
        });
        if (existing && existing.userId !== userId) {
            throw new BadRequestException(`Device ${deviceSerial} is already bound to another user`);
        }
        if (existing && existing.userId === userId) {
            return existing;
        }

        const binding = this.repository.create({
            deviceSerial,
            userId,
            relayType,
            relayId,
            boundAt: new Date(),
        });
        return this.repository.save(binding);
    }

    async unbind(deviceSerial: string): Promise<void> {
        const binding = await this.repository.findOne({
            where: {deviceSerial, unboundAt: IsNull()},
        });
        if (binding) {
            binding.unboundAt = new Date();
            await this.repository.save(binding);
        }
    }

    async getActiveBinding(deviceSerial: string): Promise<DeviceBinding | null> {
        return this.repository.findOne({
            where: {deviceSerial, unboundAt: IsNull()},
            relations: ['user'],
        });
    }

    async getBindingsByUser(userId: string): Promise<DeviceBinding[]> {
        return this.repository.find({
            where: {userId, unboundAt: IsNull()},
        });
    }
}
