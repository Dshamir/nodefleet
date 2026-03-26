import {PostVitalsByGatewayDto, UserVitalsFromGatewayDto, VitalFromGatewayDto} from 'domain/dtos/request/vital';
import {IVitalRepository} from 'app/modules/vital/repositories';
import {IVitalEntityMapper} from 'app/modules/vital/mappers/vital-entity.mapper';
import {IUserRepository} from 'app/modules/auth/repositories';
import {User, Vital} from 'domain/entities';
import {IPatientVitalThresholdsRepository} from 'app/modules/patient-vital-thresholds/repositories';
import {IVitalDtoMapper} from 'app/modules/vital/mappers/vital-dto.mapper';
import {removeVitalsWithSameTimestamp} from 'support/vitals.helper';

export class SyncVitalsUseCase {
    public constructor(
        private readonly userRepository: IUserRepository,
        private readonly vitalRepository: IVitalRepository,
        private readonly vitalDtoMapper: IVitalDtoMapper,
        private readonly vitalEntityMapper: IVitalEntityMapper,
        private readonly patientVitalThresholdsRepository: IPatientVitalThresholdsRepository,
    ) {}

    public async updateVitals(dto: PostVitalsByGatewayDto): Promise<void> {
        dto.vitals = this.normalizeUserVitals(dto.vitals);

        const patientsIndexedByUserId = await this.getPatientsIndexedByUserId(dto);

        let vitals = [];
        await Promise.all(
            dto.vitals
                .filter((userVitalsDto) => userVitalsDto.userId in patientsIndexedByUserId)
                .map(async (userVitalsDto) => {
                    const patient = patientsIndexedByUserId[userVitalsDto.userId];
                    const userVitals = await this.prepareUserVitalsToPersist(userVitalsDto, patient);

                    vitals = [...vitals, ...userVitals];
                }),
        );

        await this.vitalRepository.insertVitals(vitals);
    }

    private async prepareUserVitalsToPersist(dto: UserVitalsFromGatewayDto, patient: User): Promise<Vital[]> {
        const thresholds = await this.patientVitalThresholdsRepository.getCurrentThresholdsByPatientUserId(patient.id);
        const vitalFromGatewayDtos = await this.filterSavedVitals(dto);

        return vitalFromGatewayDtos.map((vitalFromGateway) => {
            const vitalDto = this.vitalDtoMapper.mapByVitalFromGatewayDtoAndThresholds(vitalFromGateway, thresholds);
            vitalDto.relayType = dto.relayType ?? null;
            vitalDto.relayId = dto.relayId ?? null;
            return this.vitalEntityMapper.mapByVitalsDtoAndPatient(vitalDto, patient);
        });
    }

    private async filterSavedVitals(dto: UserVitalsFromGatewayDto): Promise<VitalFromGatewayDto[]> {
        const savedVitals = await this.vitalRepository.getByUserIdAndTimestamps(
            dto.userId,
            dto.vitals.map((item) => item.timestamp),
        );
        const timestamps = savedVitals.map((item) => item.timestamp);

        return dto.vitals.filter((item) => !timestamps.includes(item.timestamp));
    }

    private normalizeUserVitals(vitals: UserVitalsFromGatewayDto[]): UserVitalsFromGatewayDto[] {
        const vitalsGroupedByUserId = {};
        vitals.map((item) => {
            if (item.userId in vitalsGroupedByUserId) {
                const {vitals} = vitalsGroupedByUserId[item.userId];
                vitalsGroupedByUserId[item.userId].vitals = {...vitals, ...item.vitals};
            } else {
                vitalsGroupedByUserId[item.userId] = item;
            }
        });

        Object.keys(vitalsGroupedByUserId).map((userId) => {
            const {vitals} = vitalsGroupedByUserId[userId];
            vitalsGroupedByUserId[userId].vitals = removeVitalsWithSameTimestamp(vitals);
        });

        return Object.values(vitalsGroupedByUserId);
    }

    private async getPatientsIndexedByUserId(dto: PostVitalsByGatewayDto): Promise<{[userId: string]: User}> {
        const userIds = dto.vitals.map((item) => item.userId);
        const users = await this.userRepository.getByIds(userIds);

        const result = {};
        users.filter((user) => user.isRolePatient()).map((user) => (result[user.id] = user));

        return result;
    }
}
