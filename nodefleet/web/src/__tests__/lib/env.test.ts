import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Test the schema directly (not the module-level side effect)
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  S3_ENDPOINT: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_PUBLIC_ENDPOINT: z.string().optional(),
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().optional(),
  DEVICE_TOKEN_SECRET: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRO_PRICE_ID: z.string().optional(),
  WS_SERVER_URL: z.string().optional(),
  MQTT_BROKER_URL: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

describe('environment validation schema', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    S3_ENDPOINT: 'http://minio:9000',
    S3_ACCESS_KEY: 'access',
    S3_SECRET_KEY: 'secret',
    S3_BUCKET: 'media',
    NEXTAUTH_SECRET: 'supersecret',
    DEVICE_TOKEN_SECRET: 'devicesecret',
  }

  it('accepts valid environment variables', () => {
    const result = serverEnvSchema.safeParse(validEnv)
    expect(result.success).toBe(true)
  })

  it('rejects missing DATABASE_URL', () => {
    const { DATABASE_URL, ...rest } = validEnv
    const result = serverEnvSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects empty NEXTAUTH_SECRET', () => {
    const result = serverEnvSchema.safeParse({ ...validEnv, NEXTAUTH_SECRET: '' })
    expect(result.success).toBe(false)
  })

  it('defaults NODE_ENV to development', () => {
    const result = serverEnvSchema.parse(validEnv)
    expect(result.NODE_ENV).toBe('development')
  })

  it('rejects invalid NODE_ENV', () => {
    const result = serverEnvSchema.safeParse({ ...validEnv, NODE_ENV: 'staging' })
    expect(result.success).toBe(false)
  })

  it('accepts optional fields as undefined', () => {
    const result = serverEnvSchema.safeParse(validEnv)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.STRIPE_SECRET_KEY).toBeUndefined()
      expect(result.data.MQTT_BROKER_URL).toBeUndefined()
    }
  })
})
