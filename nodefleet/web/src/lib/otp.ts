/**
 * TOTP (Time-based One-Time Password) implementation for 2FA.
 * Uses the otpauth library — no external service dependencies.
 */

import * as OTPAuth from 'otpauth'
import { randomBytes, createHash } from 'crypto'

const ISSUER = 'NodeFleet'
const DIGITS = 6
const PERIOD = 30 // seconds
const ALGORITHM = 'SHA1'

/**
 * Generate a new TOTP secret and provisioning URI (for QR code).
 */
export function generateTotpSecret(userEmail: string): {
  secret: string
  uri: string
} {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: userEmail,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret: new OTPAuth.Secret({ size: 20 }),
  })

  return {
    secret: totp.secret.base32,
    uri: totp.toString(),
  }
}

/**
 * Verify a TOTP code against a secret.
 * Allows 1 step of time drift (30 seconds window on each side).
 */
export function verifyTotpCode(secret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  })

  // delta returns null if invalid, or the time step difference
  const delta = totp.validate({ token: code, window: 1 })
  return delta !== null
}

/**
 * Generate backup codes (one-time use recovery codes).
 * Returns plaintext codes and their hashes for storage.
 */
export function generateBackupCodes(count: number = 8): {
  plaintext: string[]
  hashed: string[]
} {
  const plaintext: string[] = []
  const hashed: string[] = []

  for (let i = 0; i < count; i++) {
    const code = randomBytes(4).toString('hex').toUpperCase()
    const formatted = `${code.slice(0, 4)}-${code.slice(4)}`
    plaintext.push(formatted)
    hashed.push(hashBackupCode(formatted))
  }

  return { plaintext, hashed }
}

/**
 * Hash a backup code for storage comparison.
 */
export function hashBackupCode(code: string): string {
  return createHash('sha256').update(code.replace('-', '').toUpperCase()).digest('hex')
}

/**
 * Verify a backup code against stored hashes. Returns the index if valid, -1 if not.
 */
export function verifyBackupCode(code: string, hashedCodes: string[]): number {
  const hash = hashBackupCode(code)
  return hashedCodes.indexOf(hash)
}
