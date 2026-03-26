import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsNotEmpty,
    IsBoolean,
    IsNumber,
    ValidateNested,
    IsOptional,
    IsUUID,
    IsIn,
    IsString,
} from 'class-validator';
import {PostVitalsByPatientDto, VitalDto} from 'domain/dtos/request/vital';
import {FallTypeEnum} from 'domain/constants/vitals.const';
import {IsFallValid} from 'infrastructure/validators/fall.validator';

export class VitalView extends VitalDto {
    @ApiProperty({nullable: true, required: false, multipleOf: 0.1})
    @IsNumber()
    @IsOptional()
    public temp: number | null;

    @ApiProperty({nullable: true, required: false})
    @IsBoolean()
    @IsOptional()
    public isTempNormal: boolean | null;

    @ApiProperty({nullable: true, required: false})
    @IsNumber()
    @IsOptional()
    public hr: number | null;

    @ApiProperty({nullable: true, required: false})
    @IsBoolean()
    @IsOptional()
    public isHrNormal: boolean | null;

    @ApiProperty({nullable: true, required: false})
    @IsNumber()
    @IsOptional()
    public spo2: number | null;

    @ApiProperty({nullable: true, required: false})
    @IsBoolean()
    @IsOptional()
    public isSpo2Normal: boolean | null;

    @ApiProperty({nullable: true, required: false})
    @IsNumber()
    @IsOptional()
    public rr: number | null;

    @ApiProperty({nullable: true, required: false})
    @IsBoolean()
    @IsOptional()
    public isRrNormal: boolean | null;

    @ApiProperty({nullable: true, required: false})
    @IsNumber()
    @IsOptional()
    public dbp: number | null;

    @ApiProperty({nullable: true, required: false})
    @IsBoolean()
    @IsOptional()
    public isDbpNormal: boolean | null;

    @ApiProperty({nullable: true, required: false})
    @IsNumber()
    @IsOptional()
    public sbp: number | null;

    @ApiProperty({nullable: true, required: false})
    @IsBoolean()
    @IsOptional()
    public isSbpNormal: boolean | null;

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

    @ApiProperty()
    @IsNotEmpty()
    @IsUUID()
    public thresholdsId: string;

    @ApiProperty({nullable: true, required: false, description: 'Device serial number for provenance'})
    @IsOptional()
    @IsString()
    public deviceSerial: string | null = null;

    @ApiProperty({nullable: true, required: false, description: 'Relay type: phone or gateway'})
    @IsOptional()
    @IsString()
    public relayType: string | null = null;

    @ApiProperty({nullable: true, required: false, description: 'Relay identifier (phone UUID or gateway userId)'})
    @IsOptional()
    @IsString()
    public relayId: string | null = null;
}

export class PostVitalsByPatientView extends PostVitalsByPatientDto {
    @ApiProperty({isArray: true, type: VitalView})
    @IsArray()
    @ValidateNested()
    @ArrayMinSize(1)
    @Type(() => VitalView)
    public vitals: VitalView[] = [];
}
