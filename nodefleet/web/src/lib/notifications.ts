/**
 * Internal notification system — in-app + email channels.
 * No external service dependencies.
 */

import { db } from './db'
import { notifications, users } from './db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { sendEmail } from './email'
import { createLogger } from './logger'

const logger = createLogger('notifications')

interface SendNotificationOptions {
  orgId: string
  userId: string
  type: 'info' | 'warning' | 'error' | 'success'
  channel: 'in_app' | 'email' | 'both'
  title: string
  body?: string
  metadata?: Record<string, unknown>
}

/**
 * Send a notification to a user via the specified channel(s).
 */
export async function sendNotification(options: SendNotificationOptions): Promise<string> {
  // Always create in-app notification record
  const [notification] = await db
    .insert(notifications)
    .values({
      orgId: options.orgId,
      userId: options.userId,
      type: options.type,
      channel: options.channel,
      title: options.title,
      body: options.body || null,
      metadata: options.metadata || null,
    })
    .returning({ id: notifications.id })

  // Send email if channel includes email
  if (options.channel === 'email' || options.channel === 'both') {
    try {
      const [user] = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, options.userId))
        .limit(1)

      if (user?.email) {
        await sendEmail({
          to: user.email,
          subject: `[NodeFleet] ${options.title}`,
          html: `<h2>${options.title}</h2>${options.body ? `<p>${options.body}</p>` : ''}`,
        })
      }
    } catch (error) {
      logger.error('Failed to send email notification', { error: String(error), userId: options.userId })
    }
  }

  return notification.id
}

/**
 * Get notifications for a user.
 */
export async function getUserNotifications(
  userId: string,
  opts: { unreadOnly?: boolean; limit?: number; offset?: number } = {}
) {
  const { unreadOnly = false, limit = 50, offset = 0 } = opts

  const conditions = [eq(notifications.userId, userId)]
  if (unreadOnly) {
    conditions.push(eq(notifications.read, false))
  }

  const data = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(...conditions))

  const [{ unread }] = await db
    .select({ unread: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))

  return { data, total: Number(count), unread: Number(unread) }
}

/**
 * Mark a notification as read.
 */
export async function markNotificationRead(id: string, userId: string): Promise<boolean> {
  await db
    .update(notifications)
    .set({ read: true, readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))

  return true
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ read: true, readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
}
