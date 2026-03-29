import { z } from 'zod'

/** Device creation form schema */
export const createDeviceSchema = z.object({
  name: z.string().min(1, 'Device name is required').max(100, 'Name must be under 100 characters'),
  hwModel: z.string().min(1, 'Hardware model is required').max(100),
  serialNumber: z.string().max(100).optional(),
  fleetId: z.string().uuid().optional().nullable(),
})

/** Device update schema */
export const updateDeviceSchema = createDeviceSchema.partial()

/** Fleet creation schema */
export const createFleetSchema = z.object({
  name: z.string().min(1, 'Fleet name is required').max(100),
  description: z.string().max(500).optional(),
})

/** Schedule creation schema */
export const createScheduleSchema = z.object({
  name: z.string().min(1, 'Schedule name is required').max(100),
  repeatType: z.enum(['once', 'daily', 'weekly', 'monthly', 'cron']),
  cronExpression: z.string().optional(),
  isActive: z.boolean().default(true),
})

/** User registration schema */
export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

/** Login schema */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

/** Change password schema */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

/** Webhook creation schema */
export const createWebhookSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  events: z.array(z.string()).min(1, 'Select at least one event'),
  isActive: z.boolean().default(true),
})

/** API key creation schema */
export const createApiKeySchema = z.object({
  name: z.string().min(1, 'Key name is required').max(100),
  expiresAt: z.string().optional(),
})

/** Organization update schema */
export const updateOrgSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(100),
})

/** Protocol routing schema */
export const protocolRoutingSchema = z.object({
  telemetry: z.enum(['websocket', 'mqtt', 'http']),
  gps: z.enum(['websocket', 'mqtt', 'http']),
  media: z.enum(['websocket', 'mqtt', 'http']),
  commands: z.enum(['websocket', 'mqtt', 'http']),
  status: z.enum(['websocket', 'mqtt', 'http']),
  alerts: z.enum(['websocket', 'mqtt', 'http']),
})

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>
export type CreateFleetInput = z.infer<typeof createFleetSchema>
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>
export type ProtocolRoutingInput = z.infer<typeof protocolRoutingSchema>
