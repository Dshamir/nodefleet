import Redis from 'ioredis'
import { createLogger } from './logger'

const logger = createLogger('redis')

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

// Handle connection events
redis.on('error', (err) => {
  logger.error('Redis error', { error: String(err) })
})

redis.on('connect', () => {
  logger.info('Connected to Redis')
})

redis.on('ready', () => {
  logger.info('Redis is ready')
})

// Create a pub/sub instance
export const pubsub = redis.duplicate()

export async function publishEvent(channel: string, data: unknown): Promise<number> {
  try {
    const message = JSON.stringify(data)
    return await redis.publish(channel, message)
  } catch (error) {
    logger.error(`Failed to publish to ${channel}`, { error: String(error) })
    throw error
  }
}

export async function subscribeToChannel(
  channel: string,
  callback: (data: unknown) => void
): Promise<void> {
  try {
    pubsub.subscribe(channel, (err) => {
      if (err) {
        logger.error(`Failed to subscribe to ${channel}`, { error: String(err) })
        throw err
      }
    })

    pubsub.on('message', (subscribedChannel, message) => {
      if (subscribedChannel === channel) {
        try {
          const data = JSON.parse(message)
          callback(data)
        } catch (error) {
          logger.error('Failed to parse message', { error: String(error) })
        }
      }
    })
  } catch (error) {
    logger.error(`Subscription error for ${channel}`, { error: String(error) })
    throw error
  }
}

export async function unsubscribeFromChannel(channel: string): Promise<void> {
  try {
    await pubsub.unsubscribe(channel)
  } catch (error) {
    logger.error(`Failed to unsubscribe from ${channel}`, { error: String(error) })
    throw error
  }
}

export async function setCacheValue(
  key: string,
  value: unknown,
  ttlSeconds?: number
): Promise<void> {
  try {
    const serialized = JSON.stringify(value)
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, serialized)
    } else {
      await redis.set(key, serialized)
    }
  } catch (error) {
    logger.error(`Failed to set cache value for ${key}`, { error: String(error) })
    throw error
  }
}

export async function getCacheValue(key: string): Promise<unknown | null> {
  try {
    const value = await redis.get(key)
    if (!value) return null
    return JSON.parse(value)
  } catch (error) {
    logger.error(`Failed to get cache value for ${key}`, { error: String(error) })
    return null
  }
}

export async function deleteCacheValue(key: string): Promise<void> {
  try {
    await redis.del(key)
  } catch (error) {
    logger.error(`Failed to delete cache value for ${key}`, { error: String(error) })
    throw error
  }
}

export async function clearCache(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch (error) {
    logger.error(`Failed to clear cache with pattern ${pattern}`, { error: String(error) })
    throw error
  }
}

export { redis }
export default redis
