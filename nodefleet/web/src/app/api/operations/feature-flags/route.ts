import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { featureFlags } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'

const updateSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean().optional(),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
})

export const GET = withAuth(async (_request: NextRequest, _ctx: AuthContext) => {
  const data = await db
    .select()
    .from(featureFlags)
    .orderBy(desc(featureFlags.createdAt))

  return NextResponse.json({ data })
}, { resource: 'operations', action: 'read' })

export const PUT = withAuth(async (request: NextRequest, _ctx: AuthContext) => {
  const body = await request.json()
  const validated = updateSchema.parse(body)

  const [updated] = await db
    .update(featureFlags)
    .set({
      ...(validated.enabled !== undefined && { enabled: validated.enabled }),
      ...(validated.rolloutPercentage !== undefined && { rolloutPercentage: validated.rolloutPercentage }),
      updatedAt: new Date(),
    })
    .where(eq(featureFlags.id, validated.id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'Flag not found' }, { status: 404 })
  }

  return NextResponse.json(updated)
}, { resource: 'operations', action: 'update' })
