import {Injectable} from '@nestjs/common';
import {InjectDataSource} from '@nestjs/typeorm';
import {DataSource} from 'typeorm';
import {IPersonSuggestedContactRepository} from 'app/modules/suggested-contact/repositories';
import {PersonSuggestedContactModel} from './person-suggested-contact.model';
import {PersonSuggestedContact} from 'domain/entities';

@Injectable()
export class PersonSuggestedContactRepository implements IPersonSuggestedContactRepository {
    public constructor(@InjectDataSource() private dataSource: DataSource) {}

    public async create(suggestedContact: PersonSuggestedContactModel): Promise<void> {
        await this.dataSource.manager.save(suggestedContact);
    }

    public async getOneById(id: string): Promise<PersonSuggestedContact> {
        return await this.dataSource.manager.findOneBy(PersonSuggestedContactModel, {id});
    }

    public async delete(suggestedContact: PersonSuggestedContactModel): Promise<void> {
        await this.dataSource.manager.remove(suggestedContact);
    }

    public async getByPatientUserId(patientUserId: string): Promise<PersonSuggestedContact[]> {
        return await this.dataSource.manager.find(PersonSuggestedContactModel, {
            where: {patientUserId},
            order: {
                firstName: 'ASC',
                lastName: 'ASC',
            },
        });
    }

    public async getByPatientUserIdAndSuggestedBy(
        patientUserId: string,
        suggestedBy: string,
    ): Promise<PersonSuggestedContact[]> {
        return await this.dataSource.manager.find(PersonSuggestedContactModel, {
            where: {patientUserId, suggestedBy},
            order: {
                firstName: 'ASC',
                lastName: 'ASC',
            },
        });
    }

    public async findByPatientUserIdAndPhone(patientUserId: string, phone: string): Promise<PersonSuggestedContact | null> {
        return await this.dataSource.manager.findOneBy(PersonSuggestedContactModel, {patientUserId, phone});
    }
}
