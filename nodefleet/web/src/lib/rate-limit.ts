import redis from './redis'
import { createLogger } from './logger'

const logger = createLogger('rate-limit')

interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

/**
 * Redis-backed sliding window rate limiter.
 * Works across multiple instances unlike in-memory Maps.
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number = 10,
  windowMs: number = 3600000 // 1 hour
): Promise<RateLimitResult> {
  const redisKey = `ratelimit:${key}`
  const now = Date.now()
  const windowStart = now - windowMs

  try {
    // Remove old entries outside the window
    await redis.zremrangebyscore(redisKey, 0, windowStart)
    // Count current entries in window
    const count = await redis.zcard(redisKey)

    if (count >= maxAttempts) {
      const oldestEntry = await redis.zrange(redisKey, 0, 0, 'WITHSCORES')
      const resetAt = oldestEntry.length >= 2
        ? parseInt(oldestEntry[1]) + windowMs
        : now + windowMs

      logger.warn('Rate limit exceeded', { key, count, maxAttempts })
      return { success: false, remaining: 0, resetAt }
    }

    // Add current request
    await redis.zadd(redisKey, now, `${now}:${Math.random()}`)
    // Set TTL on the key
    await redis.pexpire(redisKey, windowMs)

    return {
      success: true,
      remaining: maxAttempts - count - 1,
      resetAt: now + windowMs,
    }
  } catch (error) {
    // If Redis is down, fail open (allow the request)
    logger.error('Rate limit check failed, allowing request', {
      error: error instanceof Error ? error.message : 'unknown',
    })
    return { success: true, remaining: maxAttempts, resetAt: now + windowMs }
  }
}
