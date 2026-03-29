import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { organizations } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'

const PLAN_PRICES: Record<string, number> = {
  free: 0,
  pro: 29,
  team: 79,
  enterprise: 199,
}

export const GET = withAuth(async (_request: NextRequest, _ctx: AuthContext) => {
  // Plan distribution
  const planDist = await db
    .select({
      plan: organizations.plan,
      count: sql<number>`count(*)`,
    })
    .from(organizations)
    .groupBy(organizations.plan)

  const distribution = planDist.map(row => ({
    plan: row.plan,
    count: Number(row.count),
  }))

  // Active subscriptions (non-free plans)
  const [{ activeCount }] = await db
    .select({ activeCount: sql<number>`count(*)` })
    .from(organizations)
    .where(sql`${organizations.plan} != 'free'`)

  // Total orgs
  const [{ totalOrgs }] = await db
    .select({ totalOrgs: sql<number>`count(*)` })
    .from(organizations)

  // Estimate MRR
  const mrr = distribution.reduce((sum, d) => {
    return sum + (PLAN_PRICES[d.plan] || 0) * d.count
  }, 0)

  return NextResponse.json({
    distribution,
    activeSubscriptions: Number(activeCount),
    totalOrganizations: Number(totalOrgs),
    estimatedMRR: mrr,
  })
}, { resource: 'admin', action: 'read' })
