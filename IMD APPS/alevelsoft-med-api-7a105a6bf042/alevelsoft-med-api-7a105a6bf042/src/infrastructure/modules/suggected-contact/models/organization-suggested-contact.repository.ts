import {Injectable} from '@nestjs/common';
import {InjectDataSource} from '@nestjs/typeorm';
import {DataSource} from 'typeorm';
import {IOrganizationSuggestedContactRepository} from 'app/modules/suggested-contact/repositories';
import {OrganizationSuggestedContactModel} from './organization-suggested-contact.model';
import {OrganizationSuggestedContact} from 'domain/entities';

@Injectable()
export class OrganizationSuggestedContactRepository implements IOrganizationSuggestedContactRepository {
    public constructor(@InjectDataSource() private dataSource: DataSource) {}

    public async create(suggestedContact: OrganizationSuggestedContactModel): Promise<void> {
        await this.dataSource.manager.save(suggestedContact);
    }

    public async getOneById(id: string): Promise<OrganizationSuggestedContact> {
        return await this.dataSource.manager.findOneBy(OrganizationSuggestedContactModel, {id});
    }

    public async delete(suggestedContact: OrganizationSuggestedContactModel): Promise<void> {
        await this.dataSource.manager.remove(suggestedContact);
    }

    public async getByPatientUserId(patientUserId: string): Promise<OrganizationSuggestedContact[]> {
        return await this.dataSource.manager.find(OrganizationSuggestedContactModel, {
            where: {patientUserId},
            order: {
                name: 'ASC',
            },
        });
    }

    public async getByPatientUserIdAndSuggestedBy(
        patientUserId: string,
        suggestedBy: string,
    ): Promise<OrganizationSuggestedContact[]> {
        return await this.dataSource.manager.find(OrganizationSuggestedContactModel, {
            where: {patientUserId, suggestedBy},
            order: {
                name: 'ASC',
            },
        });
    }

    public async findByPatientUserIdAndPhone(patientUserId: string, phone: string): Promise<OrganizationSuggestedContact | null> {
        return await this.dataSource.manager.findOneBy(OrganizationSuggestedContactModel, {patientUserId, phone});
    }
}
