import {Module} from '@nestjs/common';
import {EventsController} from 'controllers/events.controller';
import {EventsUseCasesFactory} from './factories';
import {AuthModule} from 'infrastructure/modules/auth/auth.module';
import {UserIndependentModule} from 'infrastructure/modules/auth/user.ind.module';
import {PatientDataAccessModule} from 'infrastructure/modules/patient-data-access/patient-data-access.module';
import {INotificationEventEmitter} from 'app/modules/events/event-emitters/notification.event-emitter';
import {NotificationEventEmitter} from 'infrastructure/modules/events/event-emitters/notification.event-emitter';
import {NotificationListener} from 'infrastructure/modules/events/listeners/notification.listener';
import {EventsSpecification} from 'app/modules/events/specifications/events.specification';
import {IPushNotificationService} from 'app/services/push-notification.service';
import {NullPushNotificationService} from 'infrastructure/services/null-push-notification.service';

@Module({
    imports: [AuthModule, UserIndependentModule, PatientDataAccessModule],
    controllers: [EventsController],
    providers: [
        EventsUseCasesFactory,
        NotificationListener,
        {
            provide: INotificationEventEmitter,
            useClass: NotificationEventEmitter,
        },
        {
            provide: EventsSpecification,
            useClass: EventsSpecification,
        },
        {
            provide: IPushNotificationService,
            useClass: NullPushNotificationService,
        },
    ],
})
export class EventsModule {}
