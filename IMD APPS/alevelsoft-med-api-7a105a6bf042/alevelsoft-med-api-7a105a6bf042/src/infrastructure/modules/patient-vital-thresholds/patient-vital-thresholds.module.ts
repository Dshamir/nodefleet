import {Module} from '@nestjs/common';
import {DoctorController, PatientController} from 'controllers/patient-vital-thresholds';
import {TypeOrmModule} from '@nestjs/typeorm';
import {PatientVitalThresholdsModel} from './models';
import {DoctorUseCasesFactory, PatientUseCasesFactory, GrantedUserUseCasesFactory} from './factories';
import {PatientVitalThresholdsSpecification} from 'app/modules/patient-vital-thresholds/specifications/patient-vital-thresholds.specification';
import {PatientDataAccessSpecification} from 'app/modules/patient-data-access/specifications/patient-data-access.specification';
import {GrantedUserController} from 'controllers/patient-vital-thresholds/granted-user.controller';
import {PatientVitalThresholdsIndependentModule} from './patient-vital-thresholds.ind.module';
import {AuthModule} from 'infrastructure/modules/auth/auth.module';
import {PatientDataAccessModule} from 'infrastructure/modules/patient-data-access/patient-data-access.module';
import {VitalIndependentModule} from 'infrastructure/modules/vital/vital.ind.module';
import {UserIndependentModule} from 'infrastructure/modules/auth/user.ind.module';
import {ThresholdsDtoService} from 'app/modules/patient-vital-thresholds/services/thresholds-dto.service';
import {IUserRepository} from 'app/modules/auth/repositories';
import {UserDtoMapper} from 'app/modules/profile/mappers/user-dto.mapper';
import {IPushNotificationService} from 'app/services/push-notification.service';
import {NullPushNotificationService} from 'infrastructure/services/null-push-notification.service';
import {PatientVitalThresholdsListener} from 'infrastructure/modules/patient-vital-thresholds/listeners/patient-vital-thresholds.listener';

@Module({
    imports: [
        TypeOrmModule.forFeature([PatientVitalThresholdsModel]),
        AuthModule,
        UserIndependentModule,
        PatientDataAccessModule,
        PatientVitalThresholdsIndependentModule,
        VitalIndependentModule,
    ],
    exports: [PatientVitalThresholdsSpecification, ThresholdsDtoService],
    controllers: [DoctorController, PatientController, GrantedUserController],
    providers: [
        DoctorUseCasesFactory,
        PatientUseCasesFactory,
        GrantedUserUseCasesFactory,
        PatientVitalThresholdsListener,
        {
            provide: PatientVitalThresholdsSpecification,
            useFactory: (patientDataAccessSpecification: PatientDataAccessSpecification) => {
                return new PatientVitalThresholdsSpecification(patientDataAccessSpecification);
            },
            inject: [PatientDataAccessSpecification],
        },
        {
            provide: ThresholdsDtoService,
            useFactory: (userRepository: IUserRepository, userDtoMapper: UserDtoMapper) => {
                return new ThresholdsDtoService(userRepository, userDtoMapper);
            },
            inject: [IUserRepository, UserDtoMapper],
        },
        {
            provide: IPushNotificationService,
            useClass: NullPushNotificationService,
        },
    ],
})
export class PatientVitalThresholdsModule {}
