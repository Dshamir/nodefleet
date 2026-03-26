import {SuggestedContact, User} from 'domain/entities';
import {PersonSuggestedContact} from 'domain/entities/person-suggested-contact.entity';
import {OrganizationSuggestedContact} from 'domain/entities/organization-suggested-contact.entity';
import {PatientDataAccessSpecification} from 'app/modules/patient-data-access/specifications/patient-data-access.specification';
import {SuggestedContactSpecificationError} from 'app/modules/suggested-contact/errors';
import {IPersonSuggestedContactRepository} from 'app/modules/suggested-contact/repositories';
import {IOrganizationSuggestedContactRepository} from 'app/modules/suggested-contact/repositories';

export class SuggestedContactSpecification {
    public constructor(private readonly patientDataAccessSpecification: PatientDataAccessSpecification) {}

    public async assertUserCanCreateContact(user: User, patientUserId: string): Promise<void> {
        await this.patientDataAccessSpecification.assertAccessIsOpenByGrantedUserIdAndPatientUserId(
            user.id,
            patientUserId,
        );
    }

    public async assertPersonSuggestedContactIsNotDuplicate(
        repo: IPersonSuggestedContactRepository,
        patientUserId: string,
        phone: string,
    ): Promise<void> {
        const existing = await repo.findByPatientUserIdAndPhone(patientUserId, phone);
        if (existing) {
            throw new SuggestedContactSpecificationError(
                'A suggested contact with this phone number already exists.',
            );
        }
    }

    public async assertOrganizationSuggestedContactIsNotDuplicate(
        repo: IOrganizationSuggestedContactRepository,
        patientUserId: string,
        phone: string,
    ): Promise<void> {
        const existing = await repo.findByPatientUserIdAndPhone(patientUserId, phone);
        if (existing) {
            throw new SuggestedContactSpecificationError(
                'A suggested contact with this phone number already exists.',
            );
        }
    }

    public assertUserCanDeletePersonContact(grantedUser: User, suggestedContact: SuggestedContact): void {
        const isSuggestedBy = suggestedContact.suggestedBy === grantedUser.id;

        if (!isSuggestedBy) {
            throw new SuggestedContactSpecificationError('Delete Not Allowed.');
        }
    }

    public assertPatientCanModifyContact(patient: User, suggestedContact: SuggestedContact): void {
        const isSuggestedBy = suggestedContact.patientUserId === patient.id;

        if (!isSuggestedBy) {
            throw new SuggestedContactSpecificationError('Action Not Allowed.');
        }
    }
}
