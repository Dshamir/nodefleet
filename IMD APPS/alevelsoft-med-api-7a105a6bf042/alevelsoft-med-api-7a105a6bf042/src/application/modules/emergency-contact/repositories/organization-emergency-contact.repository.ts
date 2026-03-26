import {OrganizationEmergencyContact} from 'domain/entities/organization-emergency-contact.entity';
import {IEmergencyContactRepository} from './emergency-contact.repository';

export interface IOrganizationEmergencyContactRepository extends IEmergencyContactRepository {
    create(emergencyContact: OrganizationEmergencyContact): Promise<void>;

    update(emergencyContact: OrganizationEmergencyContact): Promise<void>;

    delete(emergencyContact: OrganizationEmergencyContact): Promise<void>;

    getOneById(id: string): Promise<OrganizationEmergencyContact>;

    getByUserId(userId: string): Promise<OrganizationEmergencyContact[]>;

    getByUserIdOrderedByRank(userId: string): Promise<OrganizationEmergencyContact[]>;

    findByUserIdAndPhone(userId: string, phone: string): Promise<OrganizationEmergencyContact | null>;
}

export const IOrganizationEmergencyContactRepository = Symbol('IOrganizationEmergencyContactRepository');
