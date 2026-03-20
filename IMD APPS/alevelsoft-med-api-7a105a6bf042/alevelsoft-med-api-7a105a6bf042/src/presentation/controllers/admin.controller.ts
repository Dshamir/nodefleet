import {Controller, Get, Put, Delete, Param, Body, Query, HttpCode, HttpStatus, NotFoundException, CanActivate, ExecutionContext, Injectable, UseGuards, UnauthorizedException} from '@nestjs/common';
import {ApiTags, ApiBearerAuth, ApiResponse, ApiQuery} from '@nestjs/swagger';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository, Like, MoreThanOrEqual} from 'typeorm';
import {UserModel} from 'infrastructure/modules/auth/models';
import {VitalModel} from 'infrastructure/modules/vital/models';
import {PatientDataAccessModel} from 'infrastructure/modules/patient-data-access/models';
import {PersonEmergencyContactModel} from 'infrastructure/modules/emergency-contact/models/person-emergency-contact.model';
import {PatientDiagnosisModel} from 'infrastructure/modules/patient-diagnosis/models/patient-diagnosis.model';
import {PatientMedicationModel} from 'infrastructure/modules/patient-medication/models/patient-medication.model';
import {PatientStatusModel} from 'infrastructure/modules/patient-status/models/patient-status.model';
import {UserRoleEnum} from 'domain/constants/user.const';
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
    ) {}

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
