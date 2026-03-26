import {IAuthedUserService} from 'app/modules/auth/services/authed-user.service';
import {User} from 'domain/entities';
import {OrganizationSuggestedContactDto} from 'domain/dtos/request/suggested-contact/organization-suggested-contact.dto';
import {OrganizationSuggestedContact} from 'domain/entities/organization-suggested-contact.entity';
import {IOrganizationSuggestedContactRepository} from 'app/modules/suggested-contact/repositories';
import {IOrganizationSuggestedContactEntityMapper} from 'app/modules/suggested-contact/mappers/organization-suggested-contact-entity.mapper';
import {SuggestedContactSpecification} from 'app/modules/suggested-contact/specifications/suggested-contact.specification';

export class CreateOrganizationSuggestedContactUseCase {
    public constructor(
        private readonly authedUserService: IAuthedUserService,
        private readonly contactRepository: IOrganizationSuggestedContactRepository,
        private readonly contactEntityMapper: IOrganizationSuggestedContactEntityMapper,
        private readonly contactSpecification: SuggestedContactSpecification,
    ) {}

    public async createContact(dto: OrganizationSuggestedContactDto): Promise<void> {
        const user = await this.authedUserService.getUser();

        await this.contactSpecification.assertUserCanCreateContact(user, dto.patientUserId);
        await this.contactSpecification.assertOrganizationSuggestedContactIsNotDuplicate(this.contactRepository, dto.patientUserId, dto.phone);

        const contact = this.createContactEntity(user, dto);

        await this.contactRepository.create(contact);
    }

    private createContactEntity(grantedUser: User, dto: OrganizationSuggestedContactDto): OrganizationSuggestedContact {
        const contact = this.contactEntityMapper.mapByOrganizationSuggestedContactDto(dto);
        contact.suggestedBy = grantedUser.id;

        return contact;
    }
}
