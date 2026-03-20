import {
    Injectable,
    ExecutionContext,
    SetMetadata,
    UseGuards,
    applyDecorators,
    UnauthorizedException,
    CanActivate,
    Inject,
    ForbiddenException,
} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {UserRequest} from 'presentation/middlewares/assign-user.middleware';
import {isNullOrUndefined} from 'support/type.helper';
import {IAuthedUserService} from 'app/modules/auth/services/authed-user.service';

@Injectable()
export class RolesGuard implements CanActivate {
    public constructor(
        @Inject(Reflector) private readonly reflector: Reflector,
        @Inject(IAuthedUserService) private readonly authedUserService: IAuthedUserService,
    ) {}

    public async canActivate(context: ExecutionContext): Promise<boolean> {
        const request: UserRequest = context.switchToHttp().getRequest();

        if (isNullOrUndefined(request.user) || isNullOrUndefined(request.user.accessTokenClaims)) {
            throw new UnauthorizedException();
        }

        try {
            await this.authedUserService.getActiveUserOrFail();
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error; // preserve 401 for missing DB users
            }
            throw new ForbiddenException(error.message);
        }

        // Validate JWT realm_access.roles against @Roles() metadata
        const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const jwtRoles: string[] = request.user.accessTokenClaims.getRoles();
        const normalizedJwtRoles = jwtRoles.map((r: string) => r.toLowerCase());
        const hasRole = requiredRoles.some((role) => normalizedJwtRoles.includes(role.toLowerCase()));

        if (!hasRole) {
            throw new ForbiddenException('Insufficient role permissions');
        }

        return true;
    }
}

export const Roles = (...roles: string[]) => applyDecorators(SetMetadata('roles', roles), UseGuards(RolesGuard));
