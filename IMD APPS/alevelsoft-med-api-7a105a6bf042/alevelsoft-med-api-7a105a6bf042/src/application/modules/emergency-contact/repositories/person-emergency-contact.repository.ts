import {PersonEmergencyContact} from 'domain/entities/person-emergency-contact.entity';
import {IEmergencyContactRepository} from './emergency-contact.repository';

export interface IPersonEmergencyContactRepository extends IEmergencyContactRepository {
    create(emergencyContact: PersonEmergencyContact): Promise<void>;

    update(emergencyContact: PersonEmergencyContact): Promise<void>;

    delete(emergencyContact: PersonEmergencyContact): Promise<void>;

    getOneById(id: string): Promise<PersonEmergencyContact>;

    getByUserId(userId: string): Promise<PersonEmergencyContact[]>;

    getByUserIdOrderedByRank(userId: string): Promise<PersonEmergencyContact[]>;

    findByUserIdAndPhone(userId: string, phone: string): Promise<PersonEmergencyContact | null>;
}

export const IPersonEmergencyContactRepository = Symbol('IPersonEmergencyContactRepository');
