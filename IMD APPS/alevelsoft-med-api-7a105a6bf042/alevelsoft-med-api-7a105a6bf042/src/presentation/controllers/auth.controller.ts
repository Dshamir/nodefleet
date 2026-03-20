import {NotFoundException, BadRequestException, ConflictException, Body, Controller, HttpCode, HttpStatus, Post} from '@nestjs/common';
import {ApiBearerAuth, ApiResponse, ApiTags} from '@nestjs/swagger';
import {
    ConfirmSignUpUserView,
    SignInUserView,
    SignUpDoctorView,
    SignUpPatientView,
    ForgotPasswordView,
    ConfirmForgotPasswordView,
    ResendSignUpCodeView,
    RefreshTokenView,
} from 'presentation/views/request/auth';
import {
    AccessTokenView,
    ForgotPasswordResponseView,
    ResendSignUpCodeResponseView,
    UserSignedInView,
} from 'presentation/views/response/auth';
import {AuthUseCasesFactory} from 'infrastructure/modules/auth/factories/auth-use-cases.factory';
import {SignUpCaregiverView} from 'views/request/auth/sign-up-caregiver.view';
import {ConfirmEmailResentDto, ForgotPasswordMailSentDto, UserSignedInDto} from 'domain/dtos/response/auth';
import {AccessTokenDto} from 'domain/dtos/response/auth/access-token.dto';
import {Auth} from 'presentation/guards';
import {TrimPipe} from 'presentation/pipes/trim.pipe';
import {EntityNotFoundError} from 'app/errors';

@Controller()
@ApiTags('Auth')
export class AuthController {
    public constructor(private readonly authUseCasesFactory: AuthUseCasesFactory) {}

    @Post('sign-in')
    @HttpCode(HttpStatus.OK)
    @ApiResponse({status: HttpStatus.OK, type: UserSignedInView})
    public async signIn(@Body() requestBody: SignInUserView): Promise<UserSignedInDto> {
        const useCase = this.authUseCasesFactory.createSignInUseCase();

        return await useCase.signInUser(requestBody);
    }

    @Post('refresh-token')
    @HttpCode(HttpStatus.OK)
    @ApiResponse({status: HttpStatus.OK, type: AccessTokenView})
    public async refreshToken(@Body() requestBody: RefreshTokenView): Promise<AccessTokenDto> {
        const useCase = this.authUseCasesFactory.createRefreshTokenUseCase();

        return await useCase.refresh(requestBody.refreshToken);
    }

    @ApiBearerAuth()
    @Auth()
    @Post('sign-out')
    @HttpCode(HttpStatus.OK)
    @ApiResponse({status: HttpStatus.OK})
    public async signOut(@Body() requestBody: RefreshTokenView): Promise<void> {
        const useCase = this.authUseCasesFactory.createSignOutUseCase();

        await useCase.signOut(requestBody);
    }

    @Post('doctor/sign-up')
    @HttpCode(HttpStatus.CREATED)
    @ApiResponse({status: HttpStatus.CREATED})
    public async signUpDoctor(@Body(TrimPipe) requestBody: SignUpDoctorView): Promise<void> {
        const useCase = this.authUseCasesFactory.createDoctorSignUpUseCase();

        try {
            await useCase.signUp(requestBody);
        } catch (error) {
            throw this.mapSignUpError(error);
        }
    }

    @Post('patient/sign-up')
    @HttpCode(HttpStatus.CREATED)
    @ApiResponse({status: HttpStatus.CREATED})
    public async signUpPatient(@Body(TrimPipe) requestBody: SignUpPatientView): Promise<void> {
        const useCase = this.authUseCasesFactory.createPatientSignUpUseCase();

        try {
            await useCase.signUp(requestBody);
        } catch (error) {
            throw this.mapSignUpError(error);
        }
    }

    @Post('caregiver/sign-up')
    @HttpCode(HttpStatus.CREATED)
    @ApiResponse({status: HttpStatus.CREATED})
    public async signUpCaregiver(@Body(TrimPipe) requestBody: SignUpCaregiverView): Promise<void> {
        const useCase = this.authUseCasesFactory.createCaregiverSignUpUseCase();

        try {
            await useCase.signUp(requestBody);
        } catch (error) {
            throw this.mapSignUpError(error);
        }
    }

    private mapSignUpError(error: any) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('exists with same') || msg.includes('already associated') || msg.includes('already exists')) {
            return new ConflictException('An account with this email already exists. Please sign in or use a different email.');
        }
        return new BadRequestException(error.message);
    }

    @Post('sign-up/confirm')
    @HttpCode(HttpStatus.OK)
    @ApiResponse({status: HttpStatus.OK})
    public async confirmSignUp(@Body(TrimPipe) requestBody: ConfirmSignUpUserView): Promise<void> {
        const useCase = this.authUseCasesFactory.createConfirmSignUpUseCase();

        await useCase.confirmSignUpUser(requestBody);
    }

    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    @HttpCode(HttpStatus.NOT_FOUND)
    @HttpCode(HttpStatus.BAD_REQUEST)
    @ApiResponse({status: HttpStatus.OK, type: ForgotPasswordResponseView})
    public async forgotPassword(@Body(TrimPipe) requestBody: ForgotPasswordView): Promise<ForgotPasswordMailSentDto> {
        const useCase = this.authUseCasesFactory.createForgotPasswordUseCase();

        try {
            return await useCase.initiateForgotPasswordProcess(requestBody);
        } catch (error) {
            if (error instanceof EntityNotFoundError) {
                throw new NotFoundException(error.message);
            }
            throw new BadRequestException(error.message);
        }
    }

    @Post('forgot-password/confirm')
    @HttpCode(HttpStatus.OK)
    @ApiResponse({status: HttpStatus.OK})
    public async confirmForgotPassword(@Body(TrimPipe) requestBody: ConfirmForgotPasswordView): Promise<void> {
        const useCase = this.authUseCasesFactory.createConfirmForgotPasswordUseCase();

        await useCase.confirm(requestBody);
    }

    @Post('sign-up/resend-code')
    @HttpCode(HttpStatus.OK)
    @ApiResponse({status: HttpStatus.OK, type: ResendSignUpCodeResponseView})
    public async resendSignUpCode(@Body(TrimPipe) requestBody: ResendSignUpCodeView): Promise<ConfirmEmailResentDto> {
        const useCase = this.authUseCasesFactory.createResendSignUpCodeUseCase();

        return await useCase.resendCode(requestBody);
    }
}
