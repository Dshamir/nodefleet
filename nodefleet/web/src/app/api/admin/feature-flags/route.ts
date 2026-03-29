import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { featureFlags } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export const GET = withAuth(async (_request: NextRequest, _ctx: AuthContext) => {
  const data = await db
    .select()
    .from(featureFlags)
    .orderBy(desc(featureFlags.createdAt))

  return NextResponse.json({ data })
}, { resource: 'admin', action: 'read' })

export const PUT = withAuth(async (request: NextRequest, _ctx: AuthContext) => {
  const body = await request.json()
  const { id, enabled, rolloutPercentage } = body

  if (!id) {
    return NextResponse.json(
      { error: { message: 'Feature flag id is required' } },
      { status: 400 }
    )
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  }
  if (typeof enabled === 'boolean') updates.enabled = enabled
  if (typeof rolloutPercentage === 'number') {
    updates.rolloutPercentage = Math.min(100, Math.max(0, rolloutPercentage))
  }

  const [updated] = await db
    .update(featureFlags)
    .set(updates)
    .where(eq(featureFlags.id, id))
    .returning()

  if (!updated) {
    return NextResponse.json(
      { error: { message: 'Feature flag not found' } },
      { status: 404 }
    )
  }

  return NextResponse.json({ data: updated })
}, { resource: 'admin', action: 'update' })
