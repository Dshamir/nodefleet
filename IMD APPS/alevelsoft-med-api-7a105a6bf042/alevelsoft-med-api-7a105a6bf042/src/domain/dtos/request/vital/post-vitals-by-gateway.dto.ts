import {VitalTimestampDto} from './vital.dto';

export class VitalFromGatewayDto extends VitalTimestampDto {
    public temp: number | null;

    public hr: number | null;

    public spo2: number | null;

    public rr: number | null;

    public dbp: number | null;

    public sbp: number | null;

    public fall: boolean | null;

    public fallType: string | null;

    public deviceSerial: string | null = null;
}

export class UserVitalsFromGatewayDto {
    public userId: string;

    public vitals: VitalFromGatewayDto[];

    public relayType: string | null = null;

    public relayId: string | null = null;
}

export class PostVitalsByGatewayDto {
    public vitals: UserVitalsFromGatewayDto[];
}
