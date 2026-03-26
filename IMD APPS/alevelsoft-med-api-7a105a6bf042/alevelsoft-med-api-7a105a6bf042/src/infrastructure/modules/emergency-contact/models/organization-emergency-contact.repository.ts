import {Injectable} from '@nestjs/common';
import {InjectDataSource} from '@nestjs/typeorm';
import {DataSource} from 'typeorm';
import {IOrganizationEmergencyContactRepository} from 'app/modules/emergency-contact/repositories';
import {OrganizationEmergencyContact} from 'domain/entities';
import {OrganizationEmergencyContactModel} from './organization-emergency-contact.model';

@Injectable()
export class OrganizationEmergencyContactRepository implements IOrganizationEmergencyContactRepository {
    public constructor(@InjectDataSource() private dataSource: DataSource) {}

    public async create(emergencyContact: OrganizationEmergencyContactModel): Promise<void> {
        await this.dataSource.manager.save(emergencyContact);
    }

    public async update(emergencyContact: OrganizationEmergencyContactModel): Promise<void> {
        await this.dataSource.manager.save(emergencyContact);
    }

    public async delete(emergencyContact: OrganizationEmergencyContactModel): Promise<void> {
        await this.dataSource.manager.remove(emergencyContact);
    }

    public async getOneById(id: string): Promise<OrganizationEmergencyContact> {
        return await this.dataSource.manager.findOneBy(OrganizationEmergencyContactModel, {id});
    }

    public async getByUserId(userId: string): Promise<OrganizationEmergencyContact[]> {
        return await this.dataSource.manager.find(OrganizationEmergencyContactModel, {
            where: {userId},
            order: {
                createdAt: 'DESC',
            },
        });
    }

    public async getByUserIdOrderedByRank(userId: string): Promise<OrganizationEmergencyContact[]> {
        return await this.dataSource.manager.find(OrganizationEmergencyContactModel, {
            where: {userId},
            order: {
                rank: 'ASC',
                createdAt: 'DESC',
            },
        });
    }

    public async countByUserId(userId: string): Promise<number> {
        return await this.dataSource.manager.countBy(OrganizationEmergencyContactModel, {userId});
    }

    public async findByUserIdAndPhone(userId: string, phone: string): Promise<OrganizationEmergencyContact | null> {
        return await this.dataSource.manager.findOneBy(OrganizationEmergencyContactModel, {userId, phone});
    }
}
