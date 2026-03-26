import {OrganizationEmergencyContactDto} from 'domain/dtos/request/emergency-contact/organization-emergency-contact.dto';
import {IAuthedUserService} from 'app/modules/auth/services/authed-user.service';
import {IOrganizationEmergencyContactRepository} from 'app/modules/emergency-contact/repositories';
import {OrganizationEmergencyContact, User} from 'domain/entities';
import {OrganizationEmergencyContactSpecification} from 'app/modules/emergency-contact/specifications';
import {IOrganizationEmergencyContactEntityMapper} from 'app/modules/emergency-contact/mappers/organization-emergency-contact-entity.mapper';

export class CreateOrganizationContactUseCase {
    public constructor(
        private readonly authedUserService: IAuthedUserService,
        private readonly contactRepository: IOrganizationEmergencyContactRepository,
        private readonly contactEntityMapper: IOrganizationEmergencyContactEntityMapper,
        private readonly contactSpecification: OrganizationEmergencyContactSpecification,
    ) {}

    public async createContact(dto: OrganizationEmergencyContactDto): Promise<void> {
        const user = await this.authedUserService.getUser();

        this.contactSpecification.assertUserCanCreateContact(user);
        await this.contactSpecification.assertOrganizationContactIsNotDuplicate(this.contactRepository, user.id, dto.phone);

        const emergencyContact = this.createEmergencyContact(user, dto);

        await this.contactRepository.create(emergencyContact);
    }

    private createEmergencyContact(patient: User, dto: OrganizationEmergencyContactDto): OrganizationEmergencyContact {
        const emergencyContact = this.contactEntityMapper.mapByOrganizationEmergencyContactDto(dto);
        emergencyContact.userId = patient.id;

        return emergencyContact;
    }
}
