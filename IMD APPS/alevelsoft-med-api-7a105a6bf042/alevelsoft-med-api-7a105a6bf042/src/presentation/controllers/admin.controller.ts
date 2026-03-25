import {randomUUID} from 'crypto';
import {Controller, Get, Post, Put, Delete, Param, Body, Query, HttpCode, HttpStatus, NotFoundException, BadRequestException, ConflictException, CanActivate, ExecutionContext, Injectable, UseGuards, UnauthorizedException} from '@nestjs/common';
import {ApiTags, ApiBearerAuth, ApiResponse, ApiQuery} from '@nestjs/swagger';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository, Like, MoreThanOrEqual, DataSource} from 'typeorm';
import {UserModel} from 'infrastructure/modules/auth/models';
import {PatientMetadataModel} from 'infrastructure/modules/auth/models/patient-metadata.model';
import {DoctorMetadataModel} from 'infrastructure/modules/auth/models/doctor-metadata.model';
import {CaregiverMetadataModel} from 'infrastructure/modules/auth/models/caregiver-metadata.model';
import {VitalModel} from 'infrastructure/modules/vital/models';
import {PatientVitalThresholdsModel} from 'infrastructure/modules/patient-vital-thresholds/models/patient-vital-thresholds.model';
import {PatientDataAccessModel} from 'infrastructure/modules/patient-data-access/models';
import {PersonEmergencyContactModel} from 'infrastructure/modules/emergency-contact/models/person-emergency-contact.model';
import {PatientDiagnosisModel} from 'infrastructure/modules/patient-diagnosis/models/patient-diagnosis.model';
import {PatientMedicationModel} from 'infrastructure/modules/patient-medication/models/patient-medication.model';
import {PatientStatusModel} from 'infrastructure/modules/patient-status/models/patient-status.model';
import {UserRoleEnum, UserRoleLabelEnum, UserMeasurementSystemEnum} from 'domain/constants/user.const';
import {ConfigService} from '@nestjs/config';

@Injectable()
class InternalOrJwtGuard implements CanActivate {
    constructor(private readonly configService: ConfigService) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();

        const internalKey = request.headers['x-internal-auth'];
        const passkey = this.configService.get<string>('INTERNAL_SERVICES_PASSKEY');
        if (passkey && internalKey === passkey) {
            return true;
        }

        if (request.user?.accessTokenClaims) {
            return true;
        }

        throw new UnauthorizedException('Admin endpoints require valid JWT or internal service key');
    }
}

@Controller('admin')
@ApiBearerAuth()
@ApiTags('Admin')
@UseGuards(InternalOrJwtGuard)
export class AdminController {
    constructor(
        @InjectRepository(UserModel)
        private readonly userRepository: Repository<UserModel>,
        @InjectRepository(VitalModel)
        private readonly vitalRepository: Repository<VitalModel>,
        @InjectRepository(PatientDataAccessModel)
        private readonly patientDataAccessRepository: Repository<PatientDataAccessModel>,
        @InjectRepository(PersonEmergencyContactModel)
        private readonly emergencyContactRepository: Repository<PersonEmergencyContactModel>,
        @InjectRepository(PatientDiagnosisModel)
        private readonly patientDiagnosisRepository: Repository<PatientDiagnosisModel>,
        @InjectRepository(PatientMedicationModel)
        private readonly patientMedicationRepository: Repository<PatientMedicationModel>,
        @InjectRepository(PatientStatusModel)
        private readonly patientStatusRepository: Repository<PatientStatusModel>,
        private readonly dataSource: DataSource,
    ) {}

    @Post('users')
    @HttpCode(HttpStatus.CREATED)
    @ApiResponse({status: HttpStatus.CREATED, description: 'Create user with role-specific metadata'})
    async createUser(@Body() body: any) {
        const {email, firstName, lastName, phone, role, roleLabel, password, metadata} = body;

        if (!email || !firstName || !lastName || !role) {
            throw new BadRequestException('email, firstName, lastName, and role are required');
        }

        const normalizedRole = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
        if (!Object.values(UserRoleEnum).includes(normalizedRole as UserRoleEnum)) {
            throw new BadRequestException(`Invalid role: ${role}. Must be Patient, Doctor, Caregiver, or Gateway`);
        }

        const existing = await this.userRepository.findOne({where: {email: email.toLowerCase()}});
        if (existing) {
            throw new ConflictException('User with this email already exists');
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const user = new UserModel();
            user.id = randomUUID();
            user.email = email.toLowerCase();
            user.firstName = firstName;
            user.lastName = lastName;
            user.phone = phone || '';
            user.role = normalizedRole;
            user.roleLabel = roleLabel || normalizedRole;
            user.avatar = null;
            user.deletedAt = null;
            user.passwordUpdatedAt = Math.floor(Date.now() / 1000);
            user.measurementSystem = UserMeasurementSystemEnum.Metric;
            user.createdAt = new Date().toISOString();

            const savedUser = await queryRunner.manager.save(UserModel, user);

            if (normalizedRole === UserRoleEnum.Patient) {
                const pm = new PatientMetadataModel();
                pm.userId = savedUser.id;
                pm.dob = metadata?.dob ? new Date(metadata.dob) : new Date('1990-01-01');
                pm.gender = metadata?.gender || 'Other';
                pm.heightCm = metadata?.heightCm || 170;
                pm.weightKg = metadata?.weightKg || 70;
                pm.heightIn = metadata?.heightIn || Math.round((metadata?.heightCm || 170) / 2.54);
                pm.weightLb = metadata?.weightLb || Math.round((metadata?.weightKg || 70) * 2.205);
                await queryRunner.manager.save(PatientMetadataModel, pm);

                const thresholds = PatientVitalThresholdsModel.getModelWithDefaultValues();
                thresholds.patientUserId = savedUser.id;
                thresholds.createdAt = new Date().toISOString();
                await queryRunner.manager.save(PatientVitalThresholdsModel, thresholds);
            } else if (normalizedRole === UserRoleEnum.Doctor) {
                const dm = new DoctorMetadataModel();
                dm.userId = savedUser.id;
                dm.institution = metadata?.institution || '';
                dm.specialty = metadata?.specialty || '';
                await queryRunner.manager.save(DoctorMetadataModel, dm);
            } else if (normalizedRole === UserRoleEnum.Caregiver) {
                const cm = new CaregiverMetadataModel();
                cm.userId = savedUser.id;
                cm.institution = metadata?.institution || '';
                await queryRunner.manager.save(CaregiverMetadataModel, cm);
            }

            await queryRunner.commitTransaction();

            return {userId: savedUser.id, email: savedUser.email, role: savedUser.role};
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    @Get('patients')
    @HttpCode(HttpStatus.OK)
    @ApiQuery({name: 'search', required: false})
    @ApiQuery({name: 'page', required: false})
    @ApiQuery({name: 'limit', required: false})
    @ApiResponse({status: HttpStatus.OK, description: 'List of patients'})
    async getPatients(
        @Query('search') search?: string,
        @Query('page') page = 1,
        @Query('limit') limit = 25,
    ) {
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        const where: any = {role: UserRoleEnum.Patient, deletedAt: null};
        if (search) {
            where.firstName = Like(`%${search}%`);
        }

        const [data, total] = await this.userRepository.findAndCount({
            where: search
                ? [
                      {role: UserRoleEnum.Patient, deletedAt: null, firstName: Like(`%${search}%`)},
                      {role: UserRoleEnum.Patient, deletedAt: null, lastName: Like(`%${search}%`)},
                      {role: UserRoleEnum.Patient, deletedAt: null, email: Like(`%${search}%`)},
                  ]
                : {role: UserRoleEnum.Patient, deletedAt: null},
            relations: ['patientMetadata'],
            skip,
            take,
            order: {createdAt: 'DESC'},
        });

        return {data, total, page: Number(page), limit: take};
    }

    @Get('patients/:id')
    @HttpCode(HttpStatus.OK)
    @ApiResponse({status: HttpStatus.OK, description: 'Patient detail with latest vitals'})
    async getPatientDetail(@Param('id') id: string) {
        const patient = await this.userRepository.findOne({
            where: {id, role: UserRoleEnum.Patient},
            relations: ['patientMetadata'],
        });

        if (!patient) {
            throw new NotFoundException('Patient not found');
        }

        const latestVitals = await this.vitalRepository.find({
            where: {userId: id},
            order: {timestamp: 'DESC'},
            take: 1,
        });

        const diagnosesCount = await this.patientDiagnosisRepository.count({
            where: {patientUserId: id},
        });

        const medicationsCount = await this.patientMedicationRepository.count({
            where: {patientUserId: id},
        });

        return {
            ...patient,
            latestVitals: latestVitals[0] || null,
            diagnosesCount,
            medicationsCount,
        };
    }

    @Get('doctors')
    @HttpCode(HttpStatus.OK)
    @ApiQuery({name: 'search', required: false})
    @ApiQuery({name: 'page', required: false})
    @ApiQuery({name: 'limit', required: false})
    @ApiResponse({status: HttpStatus.OK, description: 'List of doctors'})
    async getDoctors(
        @Query('search') search?: string,
        @Query('page') page = 1,
        @Query('limit') limit = 25,
    ) {
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        const [data, total] = await this.userRepository.findAndCount({
            where: search
                ? [
                      {role: UserRoleEnum.Doctor, deletedAt: null, firstName: Like(`%${search}%`)},
                      {role: UserRoleEnum.Doctor, deletedAt: null, lastName: Like(`%${search}%`)},
                      {role: UserRoleEnum.Doctor, deletedAt: null, email: Like(`%${search}%`)},
                  ]
                : {role: UserRoleEnum.Doctor, deletedAt: null},
            relations: ['doctorMetadata'],
            skip,
            take,
            order: {createdAt: 'DESC'},
        });

        return {data, total, page: Number(page), limit: take};
    }

    @Get('caregivers')
    @HttpCode(HttpStatus.OK)
    @ApiQuery({name: 'search', required: false})
    @ApiQuery({name: 'page', required: false})
    @ApiQuery({name: 'limit', required: false})
    @ApiResponse({status: HttpStatus.OK, description: 'List of caregivers'})
    async getCaregivers(
        @Query('search') search?: string,
        @Query('page') page = 1,
        @Query('limit') limit = 25,
    ) {
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        const [data, total] = await this.userRepository.findAndCount({
            where: search
                ? [
                      {role: UserRoleEnum.Caregiver, deletedAt: null, firstName: Like(`%${search}%`)},
                      {role: UserRoleEnum.Caregiver, deletedAt: null, lastName: Like(`%${search}%`)},
                      {role: UserRoleEnum.Caregiver, deletedAt: null, email: Like(`%${search}%`)},
                  ]
                : {role: UserRoleEnum.Caregiver, deletedAt: null},
            relations: ['caregiverMetadata'],
            skip,
            take,
            order: {createdAt: 'DESC'},
        });

        return {data, total, page: Number(page), limit: take};
    }

    @Get('vitals/active')
    @HttpCode(HttpStatus.OK)
    @ApiResponse({status: HttpStatus.OK, description: 'Patients with vitals in last 24 hours'})
    async getActiveVitals() {
        const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;

        const recentVitals = await this.vitalRepository
            .createQueryBuilder('vital')
            .innerJoinAndSelect('vital.user', 'user')
            .where('vital.timestamp >= :oneDayAgo', {oneDayAgo})
            .orderBy('vital.timestamp', 'DESC')
            .getMany();

        // Group by user, keep latest vital per patient
        const byPatient = new Map<string, typeof recentVitals[0]>();
        for (const vital of recentVitals) {
            if (!byPatient.has(vital.userId)) {
                byPatient.set(vital.userId, vital);
            }
        }

        return {
            data: Array.from(byPatient.values()),
            total: byPatient.size,
        };
    }

    @Get('vitals/:patientId')
    @HttpCode(HttpStatus.OK)
    @ApiResponse({status: HttpStatus.OK, description: 'Vitals for a specific patient'})
    async getPatientVitals(@Param('patientId') patientId: string) {
        const vitals = await this.vitalRepository.find({
            where: {userId: patientId},
            order: {timestamp: 'DESC'},
            take: 100,
        });

        return {data: vitals, total: vitals.length};
    }

    @Get('medical-records')
    @HttpCode(HttpStatus.OK)
    @ApiQuery({name: 'type', required: false, description: 'diagnosis or medication'})
    @ApiQuery({name: 'search', required: false})
    @ApiQuery({name: 'page', required: false})
    @ApiQuery({name: 'limit', required: false})
    @ApiResponse({status: HttpStatus.OK, description: 'Medical records (diagnoses and medications)'})
    async getMedicalRecords(
        @Query('type') type?: string,
        @Query('search') search?: string,
        @Query('page') page = 1,
        @Query('limit') limit = 25,
    ) {
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        const result: {diagnoses?: any; medications?: any} = {};

        if (!type || type === 'diagnosis') {
            const diagnosisWhere: any = {};
            if (search) {
                diagnosisWhere.diagnosisName = Like(`%${search}%`);
            }
            const [data, total] = await this.patientDiagnosisRepository.findAndCount({
                where: diagnosisWhere,
                skip,
                take,
                order: {createdAt: 'DESC'},
            });
            result.diagnoses = {data, total};
        }

        if (!type || type === 'medication') {
            const medicationWhere: any = {};
            if (search) {
                medicationWhere.genericName = Like(`%${search}%`);
            }
            const [data, total] = await this.patientMedicationRepository.findAndCount({
                where: medicationWhere,
                skip,
                take,
                order: {createdAt: 'DESC'},
            });
            result.medications = {data, total};
        }

        return result;
    }

    @Get('emergency-contacts')
    @HttpCode(HttpStatus.OK)
    @ApiQuery({name: 'search', required: false})
    @ApiQuery({name: 'page', required: false})
    @ApiQuery({name: 'limit', required: false})
    @ApiResponse({status: HttpStatus.OK, description: 'List of emergency contacts'})
    async getEmergencyContacts(
        @Query('search') search?: string,
        @Query('page') page = 1,
        @Query('limit') limit = 25,
    ) {
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        const [data, total] = await this.emergencyContactRepository.findAndCount({
            where: search
                ? [
                      {firstName: Like(`%${search}%`)},
                      {lastName: Like(`%${search}%`)},
                      {email: Like(`%${search}%`)},
                  ]
                : {},
            skip,
            take,
            order: {createdAt: 'DESC'},
        });

        return {data, total, page: Number(page), limit: take};
    }

    @Get('data-access')
    @HttpCode(HttpStatus.OK)
    @ApiQuery({name: 'level', required: false, description: 'Filter by status (Approved, Initiated, Refused)'})
    @ApiQuery({name: 'page', required: false})
    @ApiQuery({name: 'limit', required: false})
    @ApiResponse({status: HttpStatus.OK, description: 'List of data access relationships'})
    async getDataAccess(
        @Query('level') level?: string,
        @Query('page') page = 1,
        @Query('limit') limit = 25,
    ) {
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        const where: any = {};
        if (level) {
            where.status = level;
        }

        const [data, total] = await this.patientDataAccessRepository.findAndCount({
            where,
            relations: ['patientUser', 'grantedUser'],
            skip,
            take,
            order: {createdAt: 'DESC'},
        });

        return {data, total, page: Number(page), limit: take};
    }

    @Get('gateways')
    @HttpCode(HttpStatus.OK)
    @ApiQuery({name: 'page', required: false})
    @ApiQuery({name: 'limit', required: false})
    @ApiResponse({status: HttpStatus.OK, description: 'List of gateway devices'})
    async getGateways(
        @Query('page') page = 1,
        @Query('limit') limit = 25,
    ) {
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        const [data, total] = await this.userRepository.findAndCount({
            where: {role: UserRoleEnum.Gateway, deletedAt: null},
            skip,
            take,
            order: {createdAt: 'DESC'},
        });

        return {data, total, page: Number(page), limit: take};
    }

    @Get('stats')
    @HttpCode(HttpStatus.OK)
    @ApiResponse({status: HttpStatus.OK, description: 'Admin dashboard statistics'})
    async getStats() {
        const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;

        const [totalPatients, totalDoctors, totalCaregivers, totalGateways, activeVitalsToday] = await Promise.all([
            this.userRepository.count({where: {role: UserRoleEnum.Patient, deletedAt: null}}),
            this.userRepository.count({where: {role: UserRoleEnum.Doctor, deletedAt: null}}),
            this.userRepository.count({where: {role: UserRoleEnum.Caregiver, deletedAt: null}}),
            this.userRepository.count({where: {role: UserRoleEnum.Gateway, deletedAt: null}}),
            this.vitalRepository
                .createQueryBuilder('vital')
                .select('COUNT(DISTINCT vital.user_id)', 'count')
                .where('vital.timestamp >= :oneDayAgo', {oneDayAgo})
                .getRawOne(),
        ]);

        const totalDiagnoses = await this.patientDiagnosisRepository.count();
        const totalMedications = await this.patientMedicationRepository.count();
        const totalEmergencyContacts = await this.emergencyContactRepository.count();

        return {
            totalPatients,
            totalDoctors,
            totalCaregivers,
            totalGateways,
            activeVitalsToday: Number(activeVitalsToday?.count || 0),
            totalDiagnoses,
            totalMedications,
            totalEmergencyContacts,
        };
    }

    @Get('thresholds/:patientId')
    @HttpCode(HttpStatus.OK)
    @ApiResponse({status: HttpStatus.OK, description: 'Vital thresholds for a patient'})
    async getPatientThresholds(@Param('patientId') patientId: string) {
        const thresholds = await this.dataSource.getRepository(PatientVitalThresholdsModel).findOne({
            where: {patientUserId: patientId},
        });
        if (!thresholds) {
            throw new NotFoundException('No thresholds found for this patient');
        }
        return thresholds;
    }

    @Post('vitals/bulk')
    @HttpCode(HttpStatus.CREATED)
    @ApiResponse({status: HttpStatus.CREATED, description: 'Bulk insert vitals bypassing patient auth'})
    async bulkInsertVitals(@Body() body: {userId: string; thresholdsId: string; vitals: any[]}) {
        const {userId, thresholdsId, vitals} = body;
        if (!userId || !thresholdsId || !Array.isArray(vitals) || vitals.length === 0) {
            throw new BadRequestException('userId, thresholdsId, and non-empty vitals array are required');
        }

        const entities = vitals.map((v) => {
            const vital = new VitalModel();
            vital.userId = userId;
            vital.thresholdsId = thresholdsId;
            vital.timestamp = v.timestamp;
            vital.hr = v.hr ?? null;
            vital.isHrNormal = v.isHrNormal ?? null;
            vital.temp = v.temp ?? null;
            vital.isTempNormal = v.isTempNormal ?? null;
            vital.spo2 = v.spo2 ?? null;
            vital.isSpo2Normal = v.isSpo2Normal ?? null;
            vital.rr = v.rr ?? null;
            vital.isRrNormal = v.isRrNormal ?? null;
            vital.sbp = v.sbp ?? null;
            vital.isSbpNormal = v.isSbpNormal ?? null;
            vital.dbp = v.dbp ?? null;
            vital.isDbpNormal = v.isDbpNormal ?? null;
            vital.fall = v.fall ?? null;
            vital.fallType = v.fallType ?? null;
            return vital;
        });

        const saved = await this.vitalRepository.save(entities);
        return {inserted: saved.length};
    }

    @Post('data-access')
    @HttpCode(HttpStatus.CREATED)
    @ApiResponse({status: HttpStatus.CREATED, description: 'Create data access relationship'})
    async createDataAccess(@Body() body: {patientUserId: string; grantedUserId: string; grantedEmail: string; patientEmail: string; direction?: string; status?: string}) {
        const {patientUserId, grantedUserId, grantedEmail, patientEmail} = body;
        if (!patientUserId || !grantedUserId) {
            throw new BadRequestException('patientUserId and grantedUserId are required');
        }

        const existing = await this.patientDataAccessRepository.findOne({
            where: {patientUserId, grantedUserId},
        });
        if (existing) {
            return {message: 'Relationship already exists', id: existing.id};
        }

        const relationship = this.patientDataAccessRepository.create({
            id: randomUUID(),
            patientUserId,
            grantedUserId,
            grantedEmail: grantedEmail || '',
            patientEmail: patientEmail || '',
            direction: body.direction || 'FromPatient',
            status: body.status || 'Approved',
            createdAt: new Date().toISOString(),
            lastInviteSentAt: 0,
        });

        const saved = await this.patientDataAccessRepository.save(relationship);
        return {id: saved.id, message: 'Relationship created'};
    }

    @Put('users/:id')
    @HttpCode(HttpStatus.OK)
    @ApiResponse({status: HttpStatus.OK, description: 'Updated user'})
    async updateUser(@Param('id') id: string, @Body() body: any) {
        const user = await this.userRepository.findOne({where: {id}});
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const allowedFields = ['firstName', 'lastName', 'phone', 'email', 'avatar'];
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                (user as any)[field] = body[field];
            }
        }

        await this.userRepository.save(user);

        return user;
    }

    @Delete('users/:id')
    @HttpCode(HttpStatus.OK)
    @ApiResponse({status: HttpStatus.OK, description: 'Soft-deleted user'})
    async deleteUser(@Param('id') id: string) {
        const user = await this.userRepository.findOne({where: {id}});
        if (!user) {
            throw new NotFoundException('User not found');
        }

        user.deletedAt = Math.floor(Date.now() / 1000);
        await this.userRepository.save(user);

        return {message: 'User deleted successfully'};
    }
}
