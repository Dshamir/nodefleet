import {IVitalDtoMapper} from 'app/modules/vital/mappers/vital-dto.mapper';
import {PatientVitalThresholds} from 'domain/entities';
import {VitalDto, VitalFromGatewayDto} from 'domain/dtos/request/vital';
import {getVitalsState} from 'support/vitals-state';

export class VitalDtoMapper implements IVitalDtoMapper {
    public mapByVitalFromGatewayDtoAndThresholds(
        dto: VitalFromGatewayDto,
        thresholds: PatientVitalThresholds,
    ): VitalDto {
        const vitalsState = getVitalsState(dto, thresholds);

        const vitalDto = new VitalDto();
        vitalDto.fall = dto.fall;
        vitalDto.fallType = dto.fallType;
        vitalDto.hr = dto.hr;
        vitalDto.isHrNormal = vitalsState.isHrNormal;
        vitalDto.rr = dto.rr;
        vitalDto.isRrNormal = vitalsState.isRrNormal;
        vitalDto.spo2 = dto.spo2;
        vitalDto.isSpo2Normal = vitalsState.isSpo2Normal;
        vitalDto.temp = dto.temp;
        vitalDto.isTempNormal = vitalsState.isTempNormal;
        vitalDto.dbp = dto.dbp;
        vitalDto.isDbpNormal = vitalsState.isDbpNormal;
        vitalDto.sbp = dto.sbp;
        vitalDto.isSbpNormal = vitalsState.isSbpNormal;
        vitalDto.timestamp = dto.timestamp;
        vitalDto.thresholdsId = thresholds.id;
        vitalDto.deviceSerial = dto.deviceSerial ?? null;

        return vitalDto;
    }
}
