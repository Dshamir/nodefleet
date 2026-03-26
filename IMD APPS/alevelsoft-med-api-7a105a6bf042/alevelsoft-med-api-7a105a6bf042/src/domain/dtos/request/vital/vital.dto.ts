export class VitalTimestampDto {
    public timestamp: number;
}

export class VitalDto extends VitalTimestampDto {
    public temp: number | null;

    public isTempNormal: boolean | null;

    public hr: number | null;

    public isHrNormal: boolean | null;

    public spo2: number | null;

    public isSpo2Normal: boolean | null;

    public rr: number | null;

    public isRrNormal: boolean | null;

    public dbp: number | null;

    public isDbpNormal: boolean | null;

    public sbp: number | null;

    public isSbpNormal: boolean | null;

    public fall: boolean | null;

    public fallType: string | null;

    public thresholdsId: string;

    public deviceSerial: string | null = null;

    public relayType: string | null = null;

    public relayId: string | null = null;
}
