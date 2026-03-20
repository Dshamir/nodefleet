import {IAuthedUserService} from 'app/modules/auth/services/authed-user.service';
import {IPatientVitalThresholdsRepository} from 'app/modules/patient-vital-thresholds/repositories';
import {IVitalRepository} from 'app/modules/vital/repositories';
import {ThresholdsDtoService} from 'app/modules/patient-vital-thresholds/services/thresholds-dto.service';
import {CurrentPatientVitalThresholdsDto} from 'domain/dtos/response/patient-vital-thresholds/current-patient-vital-thresholds.dto';

export class ThresholdListUseCase {
    public constructor(
        private readonly authedUserService: IAuthedUserService,
        private readonly thresholdRepository: IPatientVitalThresholdsRepository,
        private readonly vitalRepository: IVitalRepository,
        private readonly thresholdsDtoService: ThresholdsDtoService,
    ) {}

    public async getList(): Promise<CurrentPatientVitalThresholdsDto> {
        const user = await this.authedUserService.getUser();

        const thresholds = await this.thresholdRepository.getCurrentThresholdsByPatientUserId(user.id);

        const dto = new CurrentPatientVitalThresholdsDto();

        if (!thresholds) {
            dto.threshold = null;
            dto.users = [];

            return dto;
        }

        const thresholdsDto = await this.thresholdsDtoService.createDtoByThresholds([thresholds]);
        const vitalsQuantity = await this.vitalRepository.countByThresholdsId(thresholds.id);

        dto.threshold = thresholdsDto.thresholds[0];
        dto.users = thresholdsDto.users;
        dto.threshold.isPending = !vitalsQuantity;

        return dto;
    }
}
