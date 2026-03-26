import {ApiProperty} from '@nestjs/swagger';
import {IsNotEmpty, IsString, IsIn} from 'class-validator';

export class BindDeviceView {
    @ApiProperty({description: 'Device serial number'})
    @IsNotEmpty()
    @IsString()
    public deviceSerial: string;

    @ApiProperty({description: 'Relay type', enum: ['phone', 'gateway']})
    @IsNotEmpty()
    @IsIn(['phone', 'gateway'])
    public relayType: string;

    @ApiProperty({description: 'Relay identifier (phone UUID or gateway userId)'})
    @IsNotEmpty()
    @IsString()
    public relayId: string;
}
