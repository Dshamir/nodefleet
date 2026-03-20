import {Module} from '@nestjs/common';
import {MailerModule, MailerService} from '@nestjs-modules/mailer';
import {IMailSender} from 'app/modules/mail/services/abstract/mail-sender';
import {transportOptions, mailOptions} from 'config/mail.config';
import {IMailService} from 'app/modules/mail/services/abstract/mail.service';
import {ConfigService} from '@nestjs/config';
import {MailService} from 'app/modules/mail/services/mail.service';
import {SmtpMailSenderService} from './services/smtp-mail-sender.service';
import {BranchIoService} from 'infrastructure/services/branch-io.service';
import {IDeepLinkService} from 'app/modules/mail/services/deep-link.service';

@Module({
    imports: [
        MailerModule.forRoot({
            transport: {...transportOptions},
            defaults: {...mailOptions},
        }),
    ],
    exports: [IMailService, IMailSender],
    providers: [
        {
            provide: IMailSender,
            useFactory: (mailerService: MailerService) => {
                return new SmtpMailSenderService(mailerService);
            },
            inject: [MailerService],
        },
        {
            provide: IMailService,
            useFactory: (mailSender: IMailSender, deepLinkService: IDeepLinkService) => {
                return new MailService(mailSender, deepLinkService);
            },
            inject: [IMailSender, IDeepLinkService],
        },
        {
            provide: IDeepLinkService,
            useFactory: (configService: ConfigService) => {
                return new BranchIoService(configService);
            },
            inject: [ConfigService],
        },
    ],
})
export class MailModule {}
