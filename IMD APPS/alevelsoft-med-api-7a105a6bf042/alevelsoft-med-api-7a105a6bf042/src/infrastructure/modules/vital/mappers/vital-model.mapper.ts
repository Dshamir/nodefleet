import {IVitalEntityMapper} from 'app/modules/vital/mappers/vital-entity.mapper';
import {User, Vital} from 'domain/entities';
import {VitalDto} from 'domain/dtos/request/vital';
import {VitalModel} from 'infrastructure/modules/vital/models';

export class VitalModelMapper implements IVitalEntityMapper {
    public mapByVitalsDtoAndPatient(dto: VitalDto, patient: User): Vital {
        const vital = new VitalModel();
        vital.fall = dto.fall;
        vital.fallType = dto.fallType;
        vital.hr = dto.hr;
        vital.isHrNormal = dto.isHrNormal;
        vital.rr = dto.rr;
        vital.isRrNormal = dto.isRrNormal;
        vital.spo2 = dto.spo2;
        vital.isSpo2Normal = dto.isSpo2Normal;
        vital.temp = dto.temp;
        vital.isTempNormal = dto.isTempNormal;
        vital.rr = dto.rr;
        vital.isRrNormal = dto.isRrNormal;
        vital.dbp = dto.dbp;
        vital.isDbpNormal = dto.isDbpNormal;
        vital.sbp = dto.sbp;
        vital.isSbpNormal = dto.isSbpNormal;
        vital.timestamp = dto.timestamp;
        vital.thresholdsId = dto.thresholdsId;
        vital.userId = patient.id;
        vital.deviceSerial = dto.deviceSerial ?? null;
        vital.relayType = dto.relayType ?? null;
        vital.relayId = dto.relayId ?? null;

        return vital;
    }
}
