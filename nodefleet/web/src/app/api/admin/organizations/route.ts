import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { organizations, users, devices } from '@/lib/db/schema'
import { desc, sql, ilike, eq } from 'drizzle-orm'

export const GET = withAuth(async (request: NextRequest, _ctx: AuthContext) => {
  const url = new URL(request.url)
  const search = url.searchParams.get('search') || ''
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25')))
  const offset = (page - 1) * limit

  const conditions = search
    ? ilike(organizations.name, `%${search}%`)
    : undefined

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(organizations)
    .where(conditions)

  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      plan: organizations.plan,
      deviceLimit: organizations.deviceLimit,
      storageLimit: organizations.storageLimit,
      createdAt: organizations.createdAt,
      ownerEmail: users.email,
      ownerName: users.name,
    })
    .from(organizations)
    .leftJoin(users, eq(organizations.ownerId, users.id))
    .where(conditions)
    .orderBy(desc(organizations.createdAt))
    .limit(limit)
    .offset(offset)

  // Get device counts per org
  const deviceCounts = await db
    .select({
      orgId: devices.orgId,
      count: sql<number>`count(*)`,
    })
    .from(devices)
    .groupBy(devices.orgId)

  const countMap = new Map(deviceCounts.map(d => [d.orgId, Number(d.count)]))

  const data = rows.map(row => ({
    ...row,
    deviceCount: countMap.get(row.id) || 0,
  }))

  return NextResponse.json({
    data,
    pagination: { page, limit, total: Number(total) },
  })
}, { resource: 'admin', action: 'read' })
