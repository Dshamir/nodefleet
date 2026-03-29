import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { pageViews, analyticsEvents } from '@/lib/db/schema'
import { eq, sql, desc } from 'drizzle-orm'

export const GET = withAuth(async (_request: NextRequest, ctx: AuthContext) => {
  // Total page views
  const [pvCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pageViews)
    .where(eq(pageViews.orgId, ctx.orgId))

  // Total events
  const [evCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(analyticsEvents)
    .where(eq(analyticsEvents.orgId, ctx.orgId))

  // Unique sessions (page views)
  const [sessionCount] = await db
    .select({ count: sql<number>`count(distinct ${pageViews.sessionId})` })
    .from(pageViews)
    .where(eq(pageViews.orgId, ctx.orgId))

  // Top pages (last 30 days)
  const topPages = await db
    .select({
      path: pageViews.path,
      views: sql<number>`count(*)`,
    })
    .from(pageViews)
    .where(eq(pageViews.orgId, ctx.orgId))
    .groupBy(pageViews.path)
    .orderBy(desc(sql`count(*)`))
    .limit(10)

  // Top events
  const topEvents = await db
    .select({
      name: analyticsEvents.name,
      count: sql<number>`count(*)`,
    })
    .from(analyticsEvents)
    .where(eq(analyticsEvents.orgId, ctx.orgId))
    .groupBy(analyticsEvents.name)
    .orderBy(desc(sql`count(*)`))
    .limit(10)

  return NextResponse.json({
    totalPageViews: Number(pvCount?.count || 0),
    totalEvents: Number(evCount?.count || 0),
    uniqueSessions: Number(sessionCount?.count || 0),
    topPages,
    topEvents,
  })
}, { resource: 'analytics', action: 'read' })
