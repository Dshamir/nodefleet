import {User} from './user.entity';

export interface Vital {
    id: string;

    timestamp: number;

    temp: number | null;

    isTempNormal: boolean | null;

    hr: number | null;

    isHrNormal: boolean | null;

    spo2: number | null;

    isSpo2Normal: boolean | null;

    rr: number | null;

    isRrNormal: boolean | null;

    dbp: number | null;

    isDbpNormal: boolean | null;

    sbp: number | null;

    isSbpNormal: boolean | null;

    fall: boolean | null;

    fallType: string | null;

    isFallConfirmed: boolean | null;

    fallConfirmedAt: number | null;

    userId: string;

    thresholdsId: string;

    deviceSerial: string | null;

    relayType: string | null;

    relayId: string | null;

    user: User;
}
