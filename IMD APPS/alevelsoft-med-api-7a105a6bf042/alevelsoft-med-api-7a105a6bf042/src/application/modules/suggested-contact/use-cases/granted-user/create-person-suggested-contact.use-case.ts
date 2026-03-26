import {IAuthedUserService} from 'app/modules/auth/services/authed-user.service';
import {User} from 'domain/entities';
import {PersonSuggestedContactDto} from 'domain/dtos/request/suggested-contact/person-suggested-contact.dto';
import {PersonSuggestedContact} from 'domain/entities/person-suggested-contact.entity';
import {IPersonSuggestedContactRepository} from 'app/modules/suggested-contact/repositories';
import {IPersonSuggestedContactEntityMapper} from 'app/modules/suggested-contact/mappers/person-suggested-contact-entity.mapper';
import {SuggestedContactSpecification} from 'app/modules/suggested-contact/specifications/suggested-contact.specification';

export class CreatePersonSuggestedContactUseCase {
    public constructor(
        private readonly authedUserService: IAuthedUserService,
        private readonly contactRepository: IPersonSuggestedContactRepository,
        private readonly contactEntityMapper: IPersonSuggestedContactEntityMapper,
        private readonly contactSpecification: SuggestedContactSpecification,
    ) {}

    public async createContact(dto: PersonSuggestedContactDto): Promise<void> {
        const user = await this.authedUserService.getUser();

        await this.contactSpecification.assertUserCanCreateContact(user, dto.patientUserId);
        await this.contactSpecification.assertPersonSuggestedContactIsNotDuplicate(this.contactRepository, dto.patientUserId, dto.phone);

        const contact = this.createPersonContact(user, dto);

        await this.contactRepository.create(contact);
    }

    private createPersonContact(grantedUser: User, dto: PersonSuggestedContactDto): PersonSuggestedContact {
        const contact = this.contactEntityMapper.mapByPersonSuggestedContactDto(dto);
        contact.suggestedBy = grantedUser.id;

        return contact;
    }
}
