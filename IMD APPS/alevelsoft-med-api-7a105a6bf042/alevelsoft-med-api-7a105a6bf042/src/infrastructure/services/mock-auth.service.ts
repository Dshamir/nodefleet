import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Mock Authentication Service for LOCAL DEVELOPMENT ONLY
 * Simple local authentication for development
 * Production auth uses Keycloak OIDC
 */
@Injectable()
export class MockAuthService {
  /**
   * Mock user sign up - stores user in PostgreSQL only
   */
  async signUp(email: string, password: string, firstName: string, lastName: string, phone: string, role: string): Promise<any> {
    // Generate mock user ID
    const userId = crypto.randomUUID();

    // Hash password (simple hash for local dev)
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    return {
      userId,
      email,
      passwordHash,
      firstName,
      lastName,
      phone,
      role,
      confirmed: true, // Auto-confirm for local dev
    };
  }

  /**
   * Mock user sign in - validates against PostgreSQL
   */
  async signIn(email: string, password: string): Promise<any> {
    // Password will be validated by use case against database
    // Return mock JWT token
    const token = this.generateMockJWT(email);

    return {
      accessToken: token,
      refreshToken: token,
      idToken: token,
    };
  }

  /**
   * Mock confirm sign up - auto-confirms for local dev
   */
  async confirmSignUp(email: string, code: string): Promise<void> {
    // In local dev, users are auto-confirmed
    return;
  }

  /**
   * Mock resend confirmation code - no-op for local dev
   */
  async resendConfirmationCode(email: string): Promise<void> {
    // No confirmation needed in local dev
    return;
  }

  /**
   * Mock forgot password
   */
  async forgotPassword(email: string): Promise<void> {
    // Would need to implement email sending via Mailhog
    return;
  }

  /**
   * Mock confirm forgot password
   */
  async confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void> {
    // Would update password in database
    return;
  }

  /**
   * Mock change password
   */
  async changePassword(accessToken: string, previousPassword: string, proposedPassword: string): Promise<void> {
    // Would validate old password and update in database
    return;
  }

  /**
   * Mock refresh token
   */
  async refreshToken(refreshToken: string): Promise<any> {
    // Return same token (mock)
    return {
      accessToken: refreshToken,
      idToken: refreshToken,
    };
  }

  /**
   * Mock get user from token
   */
  async getUserFromToken(token: string): Promise<any> {
    try {
      // Decode mock JWT
      const payload = this.decodeMockJWT(token);
      return {
        email: payload.email,
        userId: payload.sub,
      };
    } catch {
      throw new Error('Invalid token');
    }
  }

  /**
   * Mock delete user
   */
  async deleteUser(userId: string): Promise<void> {
    // User will be soft-deleted in database
    return;
  }

  /**
   * Generate mock JWT token (NOT SECURE - LOCAL DEV ONLY)
   */
  private generateMockJWT(email: string): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({
      sub: crypto.randomUUID(),
      email: email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
    })).toString('base64');
    const signature = crypto.createHash('sha256').update(`${header}.${payload}`).digest('base64');

    return `${header}.${payload}.${signature}`;
  }

  /**
   * Decode mock JWT token
   */
  private decodeMockJWT(token: string): any {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    return payload;
  }

  /**
   * Hash password for storage
   */
  hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  /**
   * Verify password against hash
   */
  verifyPassword(password: string, hash: string): boolean {
    const passwordHash = this.hashPassword(password);
    return passwordHash === hash;
  }
}
