import { db } from './db'
import { auditLogs } from './db/schema'
import { createLogger } from './logger'

const logger = createLogger('audit')

type AuditAction =
  | 'device_created'
  | 'device_updated'
  | 'device_deleted'
  | 'device_paired'
  | 'device_connected'
  | 'device_disconnected'
  | 'command_sent'
  | 'command_completed'
  | 'command_failed'
  | 'command_timeout'
  | 'settings_changed'
  | 'user_login'
  | 'user_logout'
  | 'firmware_updated'
  | 'config_changed'
  | 'alert_triggered'
  | 'media_uploaded'
  | 'device_rebooted'
  | 'factory_reset'

interface AuditOptions {
  orgId?: string
  userId?: string
  deviceId?: string
  action: AuditAction
  entityType?: string
  entityId?: string
  details?: Record<string, unknown>
  ipAddress?: string
}

export async function logAudit(opts: AuditOptions): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      orgId: opts.orgId || null,
      userId: opts.userId || null,
      deviceId: opts.deviceId || null,
      action: opts.action,
      entityType: opts.entityType || null,
      entityId: opts.entityId || null,
      details: opts.details || null,
      ipAddress: opts.ipAddress || null,
    })
  } catch (error) {
    logger.error('Failed to write audit log', { error: String(error) })
  }
}
