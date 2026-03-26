import {OrganizationSuggestedContact} from 'domain/entities/organization-suggested-contact.entity';

export interface IOrganizationSuggestedContactRepository {
    create(suggestedContact: OrganizationSuggestedContact): Promise<void>;
    getOneById(id: string): Promise<OrganizationSuggestedContact>;
    delete(suggestedContact: OrganizationSuggestedContact): Promise<void>;
    getByPatientUserId(patientUserId: string): Promise<OrganizationSuggestedContact[]>;
    getByPatientUserIdAndSuggestedBy(
        patientUserId: string,
        suggestedBy: string,
    ): Promise<OrganizationSuggestedContact[]>;
    findByPatientUserIdAndPhone(patientUserId: string, phone: string): Promise<OrganizationSuggestedContact | null>;
}

export const IOrganizationSuggestedContactRepository = Symbol('IOrganizationSuggestedContactRepository');
