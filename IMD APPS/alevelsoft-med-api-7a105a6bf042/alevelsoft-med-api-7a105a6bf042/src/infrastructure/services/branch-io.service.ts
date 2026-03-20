import {ConfigService} from '@nestjs/config';
import {Inject} from '@nestjs/common';
import {IDeepLinkService} from 'app/modules/mail/services/deep-link.service';

export class BranchIoService implements IDeepLinkService {
    private readonly webAppUrl: string;

    public constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
        this.webAppUrl = configService.get<string>('WEB_APP_URL') || 'http://localhost:40080';
    }

    public async getSignUpLinkForPatient(email: string): Promise<string> {
        return `${this.webAppUrl}/sign-up-patient?email=${encodeURIComponent(email)}`;
    }

    public async getSignUpLinkForCaregiver(email: string): Promise<string> {
        return `${this.webAppUrl}/sign-up-caregiver?email=${encodeURIComponent(email)}`;
    }

    public async getSignUpLinkForDoctor(email: string): Promise<string> {
        return `${this.webAppUrl}/sign-up-doctor?email=${encodeURIComponent(email)}`;
    }

    public async getRequestsLinkForGrantedUser(): Promise<string> {
        return `${this.webAppUrl}/requests`;
    }

    public async getRequestsLinkForPatient(): Promise<string> {
        return `${this.webAppUrl}/requests`;
    }
}
