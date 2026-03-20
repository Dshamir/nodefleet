import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {
    ConfirmSignUpModel,
    SignInModel,
    SignUpModel,
    IAuthModel,
    AuthResultModel,
    ChangeEmailModel,
    ChangePasswordModel,
    ConfirmForgotPasswordModel,
    ConfirmChangeEmailModel,
    UserAttributesModel,
} from 'app/modules/auth/models';
import {IAuthService} from 'app/modules/auth/services/auth.service';
import {AuthServiceError} from 'app/errors';
import {ChangeEmailResultDto, ConfirmEmailResentDto, ForgotPasswordMailSentDto} from 'domain/dtos/response/auth';
import * as jwt from 'jsonwebtoken';
import * as jwksRsa from 'jwks-rsa';

interface KeycloakConfig {
    url: string;
    issuerUrl: string;
    realm: string;
    clientId: string;
    clientSecret: string;
    adminUser: string;
    adminPassword: string;
}

class KeycloakAuthModel implements IAuthModel {
    constructor(private readonly userId: string) {}

    public getUserId(): string {
        return this.userId;
    }
}

@Injectable()
export class KeycloakService implements IAuthService {
    private readonly config: KeycloakConfig;
    private readonly jwksClient: jwksRsa.JwksClient;
    private adminAccessToken: string | null = null;
    private adminTokenExpiry: number = 0;

    public constructor(private readonly configService: ConfigService) {
        this.config = {
            url: configService.get<string>('KEYCLOAK_URL'),
            issuerUrl: configService.get<string>('KEYCLOAK_ISSUER_URL') || configService.get<string>('KEYCLOAK_URL'),
            realm: configService.get<string>('KEYCLOAK_REALM'),
            clientId: configService.get<string>('KEYCLOAK_CLIENT_ID'),
            clientSecret: configService.get<string>('KEYCLOAK_CLIENT_SECRET'),
            adminUser: configService.get<string>('KEYCLOAK_ADMIN_USER'),
            adminPassword: configService.get<string>('KEYCLOAK_ADMIN_PASSWORD'),
        };

        this.jwksClient = jwksRsa({
            jwksUri: `${this.config.url}/realms/${this.config.realm}/protocol/openid-connect/certs`,
            cache: true,
            rateLimit: true,
        });
    }

    public async signIn(user: SignInModel): Promise<AuthResultModel> {
        const tokenUrl = `${this.config.url}/realms/${this.config.realm}/protocol/openid-connect/token`;

        const body = new URLSearchParams({
            grant_type: 'password',
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            username: user.email,
            password: user.password,
            scope: 'openid',
        });

        try {
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: body.toString(),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error_description || 'Invalid email or password.');
            }

            const data = await response.json();

            const authResult = new AuthResultModel();
            authResult.accessToken = data.access_token;
            authResult.accessTokenExpireTime = data.expires_in;
            if (user.rememberMe) {
                authResult.refreshToken = data.refresh_token;
            }

            return authResult;
        } catch (error) {
            if (error instanceof AuthServiceError) {
                throw error;
            }
            throw new AuthServiceError(error.message || 'Sign in failed.');
        }
    }

    public async refreshAuthToken(refreshToken: string): Promise<AuthResultModel> {
        const tokenUrl = `${this.config.url}/realms/${this.config.realm}/protocol/openid-connect/token`;

        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            refresh_token: refreshToken,
        });

        try {
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: body.toString(),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error_description || 'Token refresh failed.');
            }

            const data = await response.json();

            const authResult = new AuthResultModel();
            authResult.accessToken = data.access_token;
            authResult.accessTokenExpireTime = data.expires_in;

            return authResult;
        } catch (error) {
            if (error instanceof AuthServiceError) {
                throw error;
            }
            throw new AuthServiceError(error.message || 'Token refresh failed.');
        }
    }

    public async signOut(refreshToken: string): Promise<void> {
        const logoutUrl = `${this.config.url}/realms/${this.config.realm}/protocol/openid-connect/logout`;

        const body = new URLSearchParams({
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            refresh_token: refreshToken,
        });

        try {
            const response = await fetch(logoutUrl, {
                method: 'POST',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: body.toString(),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error_description || 'Sign out failed.');
            }
        } catch (error) {
            if (error instanceof AuthServiceError) {
                throw error;
            }
            throw new AuthServiceError(error.message || 'Sign out failed.');
        }
    }

    public async signUp(signUpModel: SignUpModel): Promise<IAuthModel> {
        try {
            const adminToken = await this.getAdminAccessToken();

            const usersUrl = `${this.config.url}/admin/realms/${this.config.realm}/users`;
            const createResponse = await fetch(usersUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify({
                    username: signUpModel.email,
                    email: signUpModel.email,
                    enabled: true,
                    emailVerified: false,
                    credentials: [
                        {
                            type: 'password',
                            value: signUpModel.password,
                            temporary: false,
                        },
                    ],
                }),
            });

            if (!createResponse.ok) {
                const error = await createResponse.json().catch(() => ({}));
                throw new Error(error.errorMessage || 'User registration failed.');
            }

            const locationHeader = createResponse.headers.get('Location');
            const userId = locationHeader ? locationHeader.split('/').pop() : '';

            if (!userId) {
                throw new Error('User ID is absent.');
            }

            await this.assignRealmRole(adminToken, userId, signUpModel.role);

            return new KeycloakAuthModel(userId);
        } catch (error) {
            console.error(error.message);
            if (error instanceof AuthServiceError) {
                throw error;
            }
            throw new AuthServiceError(error.message || 'Sign up failed.');
        }
    }

    public async confirmSignUp(user: ConfirmSignUpModel): Promise<void> {
        try {
            const adminToken = await this.getAdminAccessToken();
            const userId = await this.getUserIdByEmail(adminToken, user.email);

            const updateUrl = `${this.config.url}/admin/realms/${this.config.realm}/users/${userId}`;
            const response = await fetch(updateUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify({
                    emailVerified: true,
                }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.errorMessage || 'Email confirmation failed.');
            }
        } catch (error) {
            console.error(error.message);
            if (error instanceof AuthServiceError) {
                throw error;
            }
            throw new AuthServiceError(error.message || 'Confirm sign up failed.');
        }
    }

    public async resendConfirmSignUpCode(email: string): Promise<ConfirmEmailResentDto> {
        try {
            const adminToken = await this.getAdminAccessToken();
            const userId = await this.getUserIdByEmail(adminToken, email);

            const actionsUrl = `${this.config.url}/admin/realms/${this.config.realm}/users/${userId}/execute-actions-email`;
            const response = await fetch(actionsUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify(['VERIFY_EMAIL']),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.errorMessage || 'Resend confirmation failed.');
            }

            return {
                destination: email,
                attributeName: 'email',
                deliveryMedium: 'EMAIL',
            };
        } catch (error) {
            console.error(error.message);
            if (error instanceof AuthServiceError) {
                throw error;
            }
            throw new AuthServiceError(error.message || 'Resend confirmation failed.');
        }
    }

    public async getAccessTokenClaimsByAccessToken(accessToken: string): Promise<any> {
        return await new Promise((resolve, reject) => {
            const getKey = (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) => {
                this.jwksClient.getSigningKey(header.kid, (err, key) => {
                    if (err) {
                        callback(err);
                        return;
                    }
                    const signingKey = key.getPublicKey();
                    callback(null, signingKey);
                });
            };

            jwt.verify(accessToken, getKey, {algorithms: ['RS256']}, (err, decodedToken) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (this.isTokenValid(decodedToken as Record<string, any>)) {
                    resolve(decodedToken);
                } else {
                    reject(new Error('Invalid token.'));
                }
            });
        });
    }

    public async getUserAttributes(accessToken: string): Promise<UserAttributesModel> {
        const userInfoUrl = `${this.config.url}/realms/${this.config.realm}/protocol/openid-connect/userinfo`;

        try {
            const response = await fetch(userInfoUrl, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to retrieve user info.');
            }

            const data = await response.json();

            const userAttributes = new UserAttributesModel();
            userAttributes.sub = data.sub;
            userAttributes.email = data.email;
            userAttributes.emailVerified = String(data.email_verified ?? false);
            userAttributes.updatedAt = data.updated_at ? String(data.updated_at) : '';

            return userAttributes;
        } catch (error) {
            console.error(error.message);
            throw new AuthServiceError(error.message || 'Failed to get user attributes.');
        }
    }

    public async deleteUser(email: string): Promise<void> {
        try {
            const adminToken = await this.getAdminAccessToken();
            const userId = await this.getUserIdByEmail(adminToken, email);

            const deleteUrl = `${this.config.url}/admin/realms/${this.config.realm}/users/${userId}`;
            const response = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                },
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.errorMessage || 'Delete user failed.');
            }
        } catch (error) {
            console.log(error.message);
            if (error instanceof AuthServiceError) {
                throw error;
            }
            throw new AuthServiceError(error.message || 'Delete user failed.');
        }
    }

    public async forgotPassword(email: string): Promise<ForgotPasswordMailSentDto> {
        try {
            const adminToken = await this.getAdminAccessToken();
            const userId = await this.getUserIdByEmail(adminToken, email);

            const actionsUrl = `${this.config.url}/admin/realms/${this.config.realm}/users/${userId}/execute-actions-email`;
            const response = await fetch(actionsUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify(['UPDATE_PASSWORD']),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.errorMessage || 'Forgot password request failed.');
            }

            return {
                destination: email,
                attributeName: 'email',
                deliveryMedium: 'EMAIL',
            };
        } catch (error) {
            console.error(error.message);
            if (error instanceof AuthServiceError) {
                throw error;
            }
            throw new AuthServiceError(error.message || 'Forgot password failed.');
        }
    }

    public async confirmForgotPassword(confirmForgotPasswordModel: ConfirmForgotPasswordModel): Promise<void> {
        try {
            const adminToken = await this.getAdminAccessToken();
            const userId = await this.getUserIdByEmail(adminToken, confirmForgotPasswordModel.email);

            const resetUrl = `${this.config.url}/admin/realms/${this.config.realm}/users/${userId}/reset-password`;
            const response = await fetch(resetUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify({
                    type: 'password',
                    value: confirmForgotPasswordModel.password,
                    temporary: false,
                }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.errorMessage || 'Password reset failed.');
            }
        } catch (error) {
            console.error(error.message);
            if (error instanceof AuthServiceError) {
                throw error;
            }
            throw new AuthServiceError(error.message || 'Confirm forgot password failed.');
        }
    }

    public async changePassword(changePasswordModel: ChangePasswordModel): Promise<void> {
        try {
            // Verify current password by attempting a token exchange
            const userInfo = await this.getUserAttributes(changePasswordModel.accessToken);
            const adminToken = await this.getAdminAccessToken();
            const userId = await this.getUserIdByEmail(adminToken, userInfo.email);

            // Verify current password by attempting sign-in
            const tokenUrl = `${this.config.url}/realms/${this.config.realm}/protocol/openid-connect/token`;
            const verifyBody = new URLSearchParams({
                grant_type: 'password',
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                username: userInfo.email,
                password: changePasswordModel.currentPassword,
                scope: 'openid',
            });

            const verifyResponse = await fetch(tokenUrl, {
                method: 'POST',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: verifyBody.toString(),
            });

            if (!verifyResponse.ok) {
                throw new Error('Incorrect current password.');
            }

            // Set the new password
            const resetUrl = `${this.config.url}/admin/realms/${this.config.realm}/users/${userId}/reset-password`;
            const response = await fetch(resetUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify({
                    type: 'password',
                    value: changePasswordModel.newPassword,
                    temporary: false,
                }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.errorMessage || 'Password change failed.');
            }
        } catch (error) {
            if (error instanceof AuthServiceError) {
                throw error;
            }
            throw new AuthServiceError(error.message || 'Change password failed.');
        }
    }

    public async changeEmail(changeEmailModel: ChangeEmailModel): Promise<ChangeEmailResultDto> {
        try {
            const userInfo = await this.getUserAttributes(changeEmailModel.accessToken);
            const adminToken = await this.getAdminAccessToken();
            const userId = await this.getUserIdByEmail(adminToken, userInfo.email);

            const updateUrl = `${this.config.url}/admin/realms/${this.config.realm}/users/${userId}`;
            const response = await fetch(updateUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify({
                    email: changeEmailModel.newEmail,
                    emailVerified: false,
                }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.errorMessage || 'Email change failed.');
            }

            // Send verification email for new address
            const actionsUrl = `${this.config.url}/admin/realms/${this.config.realm}/users/${userId}/execute-actions-email`;
            await fetch(actionsUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify(['VERIFY_EMAIL']),
            });

            return {
                destination: changeEmailModel.newEmail,
                attributeName: 'email',
                deliveryMedium: 'EMAIL',
            };
        } catch (error) {
            console.error(error.message);
            if (error instanceof AuthServiceError) {
                throw error;
            }
            throw new AuthServiceError(error.message || 'Change email failed.');
        }
    }

    public async confirmChangeEmail(confirmChangeEmailModel: ConfirmChangeEmailModel): Promise<void> {
        try {
            const userInfo = await this.getUserAttributes(confirmChangeEmailModel.accessToken);
            const adminToken = await this.getAdminAccessToken();
            const userId = await this.getUserIdByEmail(adminToken, userInfo.email);

            const updateUrl = `${this.config.url}/admin/realms/${this.config.realm}/users/${userId}`;
            const response = await fetch(updateUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify({
                    emailVerified: true,
                }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.errorMessage || 'Email confirmation failed.');
            }
        } catch (error) {
            console.error(error.message);
            if (error instanceof AuthServiceError) {
                throw error;
            }
            throw new AuthServiceError(error.message || 'Confirm email change failed.');
        }
    }

    public async createUserWithoutConfirmationProcess(signUpModel: SignUpModel): Promise<IAuthModel> {
        try {
            const adminToken = await this.getAdminAccessToken();

            const usersUrl = `${this.config.url}/admin/realms/${this.config.realm}/users`;
            const createResponse = await fetch(usersUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify({
                    username: signUpModel.email,
                    email: signUpModel.email,
                    enabled: true,
                    emailVerified: true,
                    credentials: [
                        {
                            type: 'password',
                            value: signUpModel.password,
                            temporary: false,
                        },
                    ],
                }),
            });

            if (!createResponse.ok) {
                const error = await createResponse.json().catch(() => ({}));
                throw new Error(error.errorMessage || 'User creation failed.');
            }

            const locationHeader = createResponse.headers.get('Location');
            const userId = locationHeader ? locationHeader.split('/').pop() : '';

            if (!userId) {
                throw new Error('User ID is absent.');
            }

            try {
                await this.assignRealmRole(adminToken, userId, signUpModel.role);
            } catch (roleError) {
                await this.deleteUser(signUpModel.email);
                throw roleError;
            }

            return new KeycloakAuthModel(userId);
        } catch (error) {
            console.error(error.message);
            if (error instanceof AuthServiceError) {
                throw error;
            }
            throw new AuthServiceError(error.message || 'Create user failed.');
        }
    }

    // --- Private helpers ---

    private async getAdminAccessToken(): Promise<string> {
        if (this.adminAccessToken && Date.now() < this.adminTokenExpiry) {
            return this.adminAccessToken;
        }

        const tokenUrl = `${this.config.url}/realms/master/protocol/openid-connect/token`;
        const body = new URLSearchParams({
            grant_type: 'password',
            client_id: 'admin-cli',
            username: this.config.adminUser,
            password: this.config.adminPassword,
        });

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: body.toString(),
        });

        if (!response.ok) {
            throw new AuthServiceError('Failed to obtain Keycloak admin token.');
        }

        const data = await response.json();
        this.adminAccessToken = data.access_token;
        // Expire 30 seconds before actual expiry to avoid edge cases
        this.adminTokenExpiry = Date.now() + (data.expires_in - 30) * 1000;

        return this.adminAccessToken;
    }

    private async getUserIdByEmail(adminToken: string, email: string): Promise<string> {
        const searchUrl = `${this.config.url}/admin/realms/${this.config.realm}/users?email=${encodeURIComponent(email)}&exact=true`;
        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${adminToken}`,
            },
        });

        if (!response.ok) {
            throw new AuthServiceError('Failed to look up user.');
        }

        const users = await response.json();
        if (!Array.isArray(users) || users.length === 0) {
            throw new AuthServiceError('User not found.');
        }

        return users[0].id;
    }

    private async assignRealmRole(adminToken: string, userId: string, roleName: string): Promise<void> {
        // Ensure realm role exists, create if not
        await this.ensureRealmRoleExists(adminToken, roleName);

        // Get the role representation
        const roleUrl = `${this.config.url}/admin/realms/${this.config.realm}/roles/${encodeURIComponent(roleName)}`;
        const roleResponse = await fetch(roleUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${adminToken}`,
            },
        });

        if (!roleResponse.ok) {
            throw new Error(`Failed to get role: ${roleName}`);
        }

        const roleRepresentation = await roleResponse.json();

        // Assign role to user
        const assignUrl = `${this.config.url}/admin/realms/${this.config.realm}/users/${userId}/role-mappings/realm`;
        const assignResponse = await fetch(assignUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify([roleRepresentation]),
        });

        if (!assignResponse.ok) {
            const error = await assignResponse.json().catch(() => ({}));
            throw new Error(error.errorMessage || `Failed to assign role ${roleName} to user.`);
        }
    }

    private async ensureRealmRoleExists(adminToken: string, roleName: string): Promise<void> {
        const roleUrl = `${this.config.url}/admin/realms/${this.config.realm}/roles/${encodeURIComponent(roleName)}`;
        const response = await fetch(roleUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${adminToken}`,
            },
        });

        if (response.ok) {
            return; // Role already exists
        }

        if (response.status === 404) {
            // Create the role
            const createRoleUrl = `${this.config.url}/admin/realms/${this.config.realm}/roles`;
            const createResponse = await fetch(createRoleUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify({
                    name: roleName,
                }),
            });

            if (!createResponse.ok) {
                const error = await createResponse.json().catch(() => ({}));
                throw new Error(error.errorMessage || `Failed to create role: ${roleName}`);
            }
            return;
        }

        throw new Error(`Failed to check role existence: ${roleName}`);
    }

    private isTokenValid(decodedToken: Record<string, any>): boolean {
        return (
            decodedToken &&
            this.isTokenNotExpired(decodedToken) &&
            this.isTokenIssuerValid(decodedToken)
        );
    }

    private isTokenNotExpired(decodedToken: Record<string, any>): boolean {
        const tokenExpireDate = new Date(decodedToken.exp * 1000);
        return new Date() < tokenExpireDate;
    }

    private isTokenIssuerValid(decodedToken: Record<string, any>): boolean {
        const expectedIssuer = `${this.config.issuerUrl}/realms/${this.config.realm}`;
        return decodedToken.iss === expectedIssuer;
    }
}
