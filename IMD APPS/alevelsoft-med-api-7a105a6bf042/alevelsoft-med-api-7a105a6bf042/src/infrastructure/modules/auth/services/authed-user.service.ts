import {User} from 'domain/entities';
import {IAuthedUserService} from 'app/modules/auth/services/authed-user.service';
import {Inject, Injectable, UnauthorizedException, Scope} from '@nestjs/common';
import {IUserRepository} from 'app/modules/auth/repositories';
import {REQUEST} from '@nestjs/core';
import {KeycloakAccessTokenClaimsModel} from 'infrastructure/keycloak/keycloak-claims.model';
import {UserSignedInDto} from 'domain/dtos/response/auth';
import {UserNotActiveError} from 'app/errors/user-not-active.error';
import {UserDtoMapper} from 'app/modules/profile/mappers/user-dto.mapper';

@Injectable({scope: Scope.REQUEST})
export class AuthedUserService implements IAuthedUserService {
    public constructor(
        @Inject(REQUEST) private readonly request: any,
        @Inject(IUserRepository) private readonly userRepository: IUserRepository,
        @Inject(UserDtoMapper) private readonly userDtoMapper: UserDtoMapper,
    ) {}

    public async getUser(): Promise<User> {
        if (!('accessTokenClaims' in this.request.user)) {
            throw new UnauthorizedException();
        }

        const {accessTokenClaims} = this.request.user;
        const user = await this.userRepository.getOneById(accessTokenClaims.getUserId());

        if (!user) {
            throw new UnauthorizedException('User account not found. Please sign up first.');
        }

        return user;
    }

    public async getActiveUserOrFail(): Promise<User> {
        const user = await this.getUser();
        if (user.deletedAt !== null) {
            throw new UserNotActiveError('User is not active.');
        }

        return user;
    }

    public async getUserByTokensAndAccessTokenClaims(
        accessToken: string,
        refreshToken: string,
        accessTokenClaims: object,
    ): Promise<UserSignedInDto> {
        const accessTokenClaimsModel = KeycloakAccessTokenClaimsModel.fromKeycloakToken(accessTokenClaims as Record<string, any>);
        const user = await this.userRepository.getOneById(accessTokenClaimsModel.getUserId());

        if (!user) {
            throw new UnauthorizedException('User account not found. Please sign up first.');
        }

        const userDto = this.userDtoMapper.mapUserDtoByUser(user);

        const userSignedInDto = UserSignedInDto.fromTokenData(accessToken, refreshToken, userDto);
        userSignedInDto.accessTokenExpireTime = accessTokenClaimsModel.getAccessTokenExpireTime();

        return userSignedInDto;
    }
}
