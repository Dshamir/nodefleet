import {Injectable} from '@nestjs/common';
import {InjectDataSource} from '@nestjs/typeorm';
import {DataSource} from 'typeorm';
import {IPersonEmergencyContactRepository} from 'app/modules/emergency-contact/repositories';
import {PersonEmergencyContact} from 'domain/entities';
import {PersonEmergencyContactModel} from './person-emergency-contact.model';

@Injectable()
export class PersonEmergencyContactRepository implements IPersonEmergencyContactRepository {
    public constructor(@InjectDataSource() private dataSource: DataSource) {}

    public async create(emergencyContact: PersonEmergencyContactModel): Promise<void> {
        await this.dataSource.manager.save(emergencyContact);
    }

    public async update(emergencyContact: PersonEmergencyContactModel): Promise<void> {
        await this.dataSource.manager.save(emergencyContact);
    }

    public async delete(emergencyContact: PersonEmergencyContactModel): Promise<void> {
        await this.dataSource.manager.remove(emergencyContact);
    }

    public async getOneById(id: string): Promise<PersonEmergencyContact> {
        return await this.dataSource.manager.findOneBy(PersonEmergencyContactModel, {id});
    }

    public async getByUserId(userId: string): Promise<PersonEmergencyContact[]> {
        return await this.dataSource.manager.find(PersonEmergencyContactModel, {
            where: {userId},
            order: {
                createdAt: 'DESC',
            },
        });
    }

    public async getByUserIdOrderedByRank(userId: string): Promise<PersonEmergencyContact[]> {
        return await this.dataSource.manager.find(PersonEmergencyContactModel, {
            where: {userId},
            order: {
                rank: 'ASC',
                createdAt: 'DESC',
            },
        });
    }

    public async countByUserId(userId: string): Promise<number> {
        return await this.dataSource.manager.countBy(PersonEmergencyContactModel, {userId});
    }

    public async findByUserIdAndPhone(userId: string, phone: string): Promise<PersonEmergencyContact | null> {
        return await this.dataSource.manager.findOneBy(PersonEmergencyContactModel, {userId, phone});
    }
}
