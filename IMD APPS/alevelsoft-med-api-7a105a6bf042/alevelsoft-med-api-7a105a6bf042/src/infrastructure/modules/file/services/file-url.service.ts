import {ConfigService} from '@nestjs/config';
import {Injectable} from '@nestjs/common';
import {IFileUrlService} from 'app/modules/profile/services/file-url.service';

@Injectable()
export class FileUrlService implements IFileUrlService {
    public constructor(private readonly configService: ConfigService) {}

    public createUrlToUserAvatar(avatar: string | null): string | null {
        if (avatar === null) {
            return null;
        }

        const baseUrl = this.configService.get<string>('MINIO_PUBLIC_URL')
            || this.configService.get<string>('AWS_PUBLIC_FILE_URL');

        return baseUrl + avatar;
    }
}
