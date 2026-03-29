import redis from './redis'
import { createLogger } from './logger'

const logger = createLogger('account-lockout')

const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

/**
 * Check if an account is locked due to too many failed login attempts.
 * Uses Redis to track attempts across instances.
 */
export async function isAccountLocked(email: string): Promise<boolean> {
  try {
    const key = `lockout:${email}`
    const locked = await redis.get(key)
    return locked === 'locked'
  } catch {
    return false // fail open
  }
}

/**
 * Record a failed login attempt. Locks the account after MAX_ATTEMPTS.
 */
export async function recordFailedAttempt(email: string): Promise<{ locked: boolean; attemptsRemaining: number }> {
  try {
    const attemptsKey = `login_attempts:${email}`
    const lockKey = `lockout:${email}`

    const attempts = await redis.incr(attemptsKey)
    await redis.pexpire(attemptsKey, LOCKOUT_DURATION_MS)

    if (attempts >= MAX_ATTEMPTS) {
      await redis.set(lockKey, 'locked', 'PX', LOCKOUT_DURATION_MS)
      logger.warn('Account locked due to too many failed attempts', { email, attempts })
      return { locked: true, attemptsRemaining: 0 }
    }

    return { locked: false, attemptsRemaining: MAX_ATTEMPTS - attempts }
  } catch {
    return { locked: false, attemptsRemaining: MAX_ATTEMPTS }
  }
}

/**
 * Clear failed attempts after successful login.
 */
export async function clearFailedAttempts(email: string): Promise<void> {
  try {
    await redis.del(`login_attempts:${email}`, `lockout:${email}`)
  } catch {
    // non-critical
  }
}
