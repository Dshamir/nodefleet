import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { organizations, users, devices } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

export const GET = withAuth(async (_request: NextRequest, _ctx: AuthContext) => {
  const [orgs] = await db.select({ count: sql<number>`count(*)` }).from(organizations)
  const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users)
  const [deviceCount] = await db.select({ count: sql<number>`count(*)` }).from(devices)
  const [onlineCount] = await db.select({ count: sql<number>`count(*)` }).from(devices).where(eq(devices.status, 'online'))

  return NextResponse.json({
    totalOrgs: Number(orgs.count),
    totalUsers: Number(userCount.count),
    totalDevices: Number(deviceCount.count),
    onlineDevices: Number(onlineCount.count),
    mrr: '$0.00', // TODO: calculate from active subscriptions
    systemHealth: 'healthy',
  })
}, { resource: 'admin', action: 'read' })
