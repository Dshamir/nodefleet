import {PersonEmergencyContactDto} from 'domain/dtos/request/emergency-contact/person-emergency-contact.dto';
import {IAuthedUserService} from 'app/modules/auth/services/authed-user.service';
import {IPersonEmergencyContactRepository} from 'app/modules/emergency-contact/repositories';
import {IPersonEmergencyContactEntityMapper} from 'app/modules/emergency-contact/mappers/person-emergency-contact-entity.mapper';
import {PersonEmergencyContact, User} from 'domain/entities';
import {PersonEmergencyContactSpecification} from 'app/modules/emergency-contact/specifications';

export class CreatePersonContactUseCase {
    public constructor(
        private readonly authedUserService: IAuthedUserService,
        private readonly contactRepository: IPersonEmergencyContactRepository,
        private readonly contactEntityMapper: IPersonEmergencyContactEntityMapper,
        private readonly contactSpecification: PersonEmergencyContactSpecification,
    ) {}

    public async createContact(dto: PersonEmergencyContactDto): Promise<void> {
        const user = await this.authedUserService.getUser();

        this.contactSpecification.assertUserCanCreateContact(user);
        this.contactSpecification.assertContactIsNotSelf(user, dto.firstName, dto.lastName, dto.phone, dto.email);
        await this.contactSpecification.assertPersonContactIsNotDuplicate(this.contactRepository, user.id, dto.phone);

        const emergencyContact = this.createEmergencyContact(user, dto);

        await this.contactRepository.create(emergencyContact);
    }

    private createEmergencyContact(patient: User, dto: PersonEmergencyContactDto): PersonEmergencyContact {
        const emergencyContact = this.contactEntityMapper.mapByPersonEmergencyContactDto(dto);
        emergencyContact.userId = patient.id;

        return emergencyContact;
    }
}
