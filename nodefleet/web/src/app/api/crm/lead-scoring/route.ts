import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { leadScoringRules } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

export const GET = withAuth(async (_request: NextRequest, ctx: AuthContext) => {
  const data = await db.select().from(leadScoringRules).where(eq(leadScoringRules.orgId, ctx.orgId))
  return NextResponse.json({ data })
}, { resource: 'crm', action: 'read' })

export const PUT = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const rules = z.array(z.object({
    id: z.string().uuid().optional(),
    name: z.string(),
    condition: z.record(z.unknown()),
    points: z.number().int(),
    enabled: z.boolean(),
  })).parse(body.rules || [])

  // Delete existing and re-insert
  await db.delete(leadScoringRules).where(eq(leadScoringRules.orgId, ctx.orgId))

  if (rules.length > 0) {
    await db.insert(leadScoringRules).values(
      rules.map((r) => ({
        orgId: ctx.orgId,
        name: r.name,
        condition: r.condition,
        points: r.points,
        enabled: r.enabled,
      }))
    )
  }

  return NextResponse.json({ success: true })
}, { resource: 'crm', action: 'update' })
