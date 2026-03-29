import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { desc, sql } from 'drizzle-orm'

export const GET = withAuth(async (request: NextRequest, _ctx: AuthContext) => {
  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')))
  const offset = (page - 1) * limit

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(auditLogs)

  const data = await db
    .select({
      id: auditLogs.id,
      orgId: auditLogs.orgId,
      userId: auditLogs.userId,
      deviceId: auditLogs.deviceId,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      details: auditLogs.details,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset)

  return NextResponse.json({
    data,
    pagination: { page, limit, total: Number(total) },
  })
}, { resource: 'admin', action: 'read' })
