import { z } from 'zod'

/**
 * Server-side environment variable validation.
 * Validates all required env vars at module load time so misconfiguration
 * is caught at startup rather than at first request.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  S3_ENDPOINT: z.string().min(1, 'S3_ENDPOINT is required'),
  S3_ACCESS_KEY: z.string().min(1, 'S3_ACCESS_KEY is required'),
  S3_SECRET_KEY: z.string().min(1, 'S3_SECRET_KEY is required'),
  S3_BUCKET: z.string().min(1, 'S3_BUCKET is required'),
  S3_PUBLIC_ENDPOINT: z.string().optional(),
  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET is required'),
  NEXTAUTH_URL: z.string().optional(),
  DEVICE_TOKEN_SECRET: z.string().min(1, 'DEVICE_TOKEN_SECRET is required'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRO_PRICE_ID: z.string().optional(),
  WS_SERVER_URL: z.string().optional(),
  MQTT_BROKER_URL: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const clientEnvSchema = z.object({
  NEXT_PUBLIC_WS_URL: z.string().optional(),
  NEXT_PUBLIC_URL: z.string().optional(),
})

function validateEnv() {
  // Skip validation during build time (Next.js builds with dummy env vars)
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return process.env as unknown as z.infer<typeof serverEnvSchema>
  }

  const parsed = serverEnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors
    const missing = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${msgs?.join(', ')}`)
      .join('\n')
    console.error(`\n❌ Invalid environment variables:\n${missing}\n`)

    // In production, fail hard. In dev, warn but continue.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing required environment variables')
    }
  }

  return (parsed.success ? parsed.data : process.env) as z.infer<typeof serverEnvSchema>
}

/** Validated server environment variables */
export const env = validateEnv()

/** Client-side environment variables (safe to expose) */
export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
})
