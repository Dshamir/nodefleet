import {User} from './user.entity';

export interface DeviceBinding {
    id: string;

    deviceSerial: string;

    userId: string;

    relayType: string;

    relayId: string;

    boundAt: Date;

    unboundAt: Date | null;

    createdAt: Date;

    user: User;
}
