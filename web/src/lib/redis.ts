import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

// Handle connection events
redis.on('error', (err) => {
  console.error('Redis error:', err)
})

redis.on('connect', () => {
  console.log('Connected to Redis')
})

redis.on('ready', () => {
  console.log('Redis is ready')
})

// Create a pub/sub instance
export const pubsub = redis.duplicate()

export async function publishEvent(channel: string, data: unknown): Promise<number> {
  try {
    const message = JSON.stringify(data)
    return await redis.publish(channel, message)
  } catch (error) {
    console.error(`Failed to publish to ${channel}:`, error)
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
        console.error(`Failed to subscribe to ${channel}:`, err)
        throw err
      }
    })

    pubsub.on('message', (subscribedChannel, message) => {
      if (subscribedChannel === channel) {
        try {
          const data = JSON.parse(message)
          callback(data)
        } catch (error) {
          console.error('Failed to parse message:', error)
        }
      }
    })
  } catch (error) {
    console.error(`Subscription error for ${channel}:`, error)
    throw error
  }
}

export async function unsubscribeFromChannel(channel: string): Promise<void> {
  try {
    await pubsub.unsubscribe(channel)
  } catch (error) {
    console.error(`Failed to unsubscribe from ${channel}:`, error)
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
    console.error(`Failed to set cache value for ${key}:`, error)
    throw error
  }
}

export async function getCacheValue(key: string): Promise<unknown | null> {
  try {
    const value = await redis.get(key)
    if (!value) return null
    return JSON.parse(value)
  } catch (error) {
    console.error(`Failed to get cache value for ${key}:`, error)
    return null
  }
}

export async function deleteCacheValue(key: string): Promise<void> {
  try {
    await redis.del(key)
  } catch (error) {
    console.error(`Failed to delete cache value for ${key}:`, error)
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
    console.error(`Failed to clear cache with pattern ${pattern}:`, error)
    throw error
  }
}

export { redis }
export default redis
