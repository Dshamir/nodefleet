import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {ArrayMinSize, IsArray, IsNotEmpty, IsNumber, ValidateNested, IsOptional, IsUUID, IsIn, IsString} from 'class-validator';
import {PostVitalsByGatewayDto, VitalFromGatewayDto, UserVitalsFromGatewayDto} from 'domain/dtos/request/vital';
import {FallTypeEnum} from 'domain/constants/vitals.const';
import {IsFallValid} from 'infrastructure/validators/fall.validator';

export class VitalFromGatewayView extends VitalFromGatewayDto {
    @ApiProperty({nullable: true, required: false, multipleOf: 0.1})
    @IsNumber()
    @IsOptional()
    public temp: number | null;

    @ApiProperty({nullable: true, required: false})
    @IsNumber()
    @IsOptional()
    public hr: number | null;

    @ApiProperty({nullable: true, required: false})
    @IsNumber()
    @IsOptional()
    public spo2: number | null;

    @ApiProperty({nullable: true, required: false})
    @IsNumber()
    @IsOptional()
    public rr: number | null;

    @ApiProperty({nullable: true, required: false})
    @IsNumber()
    @IsOptional()
    public dbp: number | null;

    @ApiProperty({nullable: true, required: false})
    @IsNumber()
    @IsOptional()
    public sbp: number | null;

    @ApiProperty({nullable: true, required: false})
    @IsFallValid({
        message: 'Fall value is invalid.',
    })
    public fall: boolean | null;

    @ApiProperty({nullable: true, required: false, enum: FallTypeEnum})
    @IsOptional()
    @IsIn(Object.values(FallTypeEnum))
    public fallType: string | null;

    @ApiProperty()
    @IsNotEmpty()
    @IsNumber()
    public timestamp: number;

    @ApiProperty({nullable: true, required: false, description: 'Device serial number for provenance'})
    @IsOptional()
    @IsString()
    public deviceSerial: string | null = null;
}

export class UserVitalsByGatewayView extends UserVitalsFromGatewayDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsUUID()
    public userId: string;

    @ApiProperty({isArray: true, type: VitalFromGatewayView})
    @IsArray()
    @ValidateNested()
    @ArrayMinSize(1)
    @Type(() => VitalFromGatewayView)
    public vitals: VitalFromGatewayView[] = [];

    @ApiProperty({nullable: true, required: false, description: 'Relay type: phone or gateway'})
    @IsOptional()
    @IsString()
    public relayType: string | null = null;

    @ApiProperty({nullable: true, required: false, description: 'Relay identifier (phone UUID or gateway userId)'})
    @IsOptional()
    @IsString()
    public relayId: string | null = null;
}

export class PostVitalsByGatewayView extends PostVitalsByGatewayDto {
    @ApiProperty({isArray: true, type: UserVitalsByGatewayView})
    @IsArray()
    @ValidateNested()
    @ArrayMinSize(1)
    @Type(() => UserVitalsByGatewayView)
    public vitals: UserVitalsByGatewayView[] = [];
}
