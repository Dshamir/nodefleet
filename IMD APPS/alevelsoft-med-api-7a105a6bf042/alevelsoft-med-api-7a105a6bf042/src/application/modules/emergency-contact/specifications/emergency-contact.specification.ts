import {EmergencyContact, User} from 'domain/entities';
import {UserRoleEnum} from 'domain/constants/user.const';
import {EmergencyContactSpecificationError} from 'app/modules/emergency-contact/errors';
import {IEmergencyContactRepository, IPersonEmergencyContactRepository, IOrganizationEmergencyContactRepository} from 'app/modules/emergency-contact/repositories';
import {arrayDiff} from 'support/array.helper';
import {ContactsOrderDto} from 'domain/dtos/request/emergency-contact/contacts-order.dto';

export abstract class EmergencyContactSpecification {
    public constructor(private readonly emergencyContactRepository: IEmergencyContactRepository) {}

    public assertUserCanCreateContact(user: User): void {
        const isUserPatient = user.role === UserRoleEnum.Patient;

        if (!isUserPatient) {
            throw new EmergencyContactSpecificationError('Create Emergency Contact Not Allowed.');
        }
    }

    public assertUserCanUpdateContact(user: User, contact: EmergencyContact): void {
        if (!this.isUserOwnerOfContact(user, contact)) {
            throw new EmergencyContactSpecificationError('Update Emergency Contact Not Allowed.');
        }
    }

    public async assertUserCanDeletePersonContact(user: User, contact: EmergencyContact): Promise<void> {
        if (!this.isUserOwnerOfContact(user, contact)) {
            throw new EmergencyContactSpecificationError('Delete Emergency Contact Not Allowed.');
        }

        const contactsQuantity = await this.emergencyContactRepository.countByUserId(user.id);
        if (contactsQuantity <= 1) {
            throw new EmergencyContactSpecificationError('You must have at least one emergency contact.');
        }
    }

    public async assertUserCanDeleteOrganizationContact(user: User, contact: EmergencyContact): Promise<void> {
        if (!this.isUserOwnerOfContact(user, contact)) {
            throw new EmergencyContactSpecificationError('Delete Emergency Contact Not Allowed.');
        }
    }

    public assertContactsOrderIsValid(dto: ContactsOrderDto, contacts: EmergencyContact[]): void {
        const contactIds = contacts.map((contact) => contact.id);

        const absentContactIds = arrayDiff(dto.contactIds, contactIds);
        const isThereAbsentContactId = absentContactIds.length > 0;

        if (isThereAbsentContactId) {
            throw new EmergencyContactSpecificationError(`[${absentContactIds.join(', ')}] Not Found.`);
        }
    }

    public async assertPersonContactIsNotDuplicate(
        personRepo: IPersonEmergencyContactRepository,
        userId: string,
        phone: string,
        excludeId?: string,
    ): Promise<void> {
        const existing = await personRepo.findByUserIdAndPhone(userId, phone);
        if (existing && existing.id !== excludeId) {
            throw new EmergencyContactSpecificationError(
                'A contact with this phone number already exists.',
            );
        }
    }

    public async assertOrganizationContactIsNotDuplicate(
        orgRepo: IOrganizationEmergencyContactRepository,
        userId: string,
        phone: string,
        excludeId?: string,
    ): Promise<void> {
        const existing = await orgRepo.findByUserIdAndPhone(userId, phone);
        if (existing && existing.id !== excludeId) {
            throw new EmergencyContactSpecificationError(
                'A contact with this phone number already exists.',
            );
        }
    }

    public assertContactIsNotSelf(user: User, firstName: string, lastName: string, phone: string, email?: string): void {
        if (user.phone && user.phone === phone) {
            throw new EmergencyContactSpecificationError('You cannot add yourself as an emergency contact.');
        }
        const nameMatch = user.firstName?.toLowerCase() === firstName?.toLowerCase()
            && user.lastName?.toLowerCase() === lastName?.toLowerCase();
        if (nameMatch && email && user.email?.toLowerCase() === email?.toLowerCase()) {
            throw new EmergencyContactSpecificationError('You cannot add yourself as an emergency contact.');
        }
    }

    private isUserOwnerOfContact(user: User, contact: EmergencyContact): boolean {
        return user.id === contact.userId;
    }
}
