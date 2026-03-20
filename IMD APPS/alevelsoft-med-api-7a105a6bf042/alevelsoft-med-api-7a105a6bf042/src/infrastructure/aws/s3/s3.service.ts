import {S3Client, PutObjectCommand, DeleteObjectCommand} from '@aws-sdk/client-s3';
import {ConfigService} from '@nestjs/config';
import {IUserAvatarService} from 'app/modules/profile/services/user-avatar.service';
import {Injectable} from '@nestjs/common';

@Injectable()
export class S3Service implements IUserAvatarService {
    private readonly s3Client: S3Client;
    private readonly bucket: string;

    public constructor(private readonly configService: ConfigService) {
        this.bucket = configService.get<string>('MINIO_BUCKET') || configService.get<string>('AWS_PUBLIC_BUCKET_NAME');
        this.s3Client = new S3Client({
            region: configService.get<string>('AWS_REGION') || 'us-east-1',
            endpoint: configService.get<string>('MINIO_ENDPOINT'),
            credentials: {
                accessKeyId: configService.get<string>('MINIO_ACCESS_KEY') || configService.get<string>('AWS_ACCESS_KEY_ID'),
                secretAccessKey: configService.get<string>('MINIO_SECRET_KEY') || configService.get<string>('AWS_SECRET_ACCESS_KEY'),
            },
            forcePathStyle: true,
        });
    }

    public async uploadFile(dataBuffer: Buffer, filename: string): Promise<void> {
        const filePath = this.getAvatarFilePath(filename);

        await this.s3Client.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Body: dataBuffer,
                Key: filePath,
            }),
        );
    }

    public async deleteFile(filename: string): Promise<void> {
        const filePath = this.getAvatarFilePath(filename);

        await this.s3Client.send(
            new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: filePath,
            }),
        );
    }

    private getAvatarFilePath(filename: string): string {
        return `avatars/${filename}`;
    }
}
