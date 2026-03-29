import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { fraudEvents, fraudBlocklist } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'

const blocklistSchema = z.object({
  type: z.enum(['ip', 'user', 'email']),
  value: z.string().min(1).max(255),
  reason: z.string().optional(),
})

export const GET = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view') || 'events'

  if (view === 'blocklist') {
    const data = await db
      .select()
      .from(fraudBlocklist)
      .where(eq(fraudBlocklist.orgId, ctx.orgId))
      .orderBy(desc(fraudBlocklist.createdAt))

    return NextResponse.json({ data })
  }

  const data = await db
    .select()
    .from(fraudEvents)
    .where(eq(fraudEvents.orgId, ctx.orgId))
    .orderBy(desc(fraudEvents.createdAt))
    .limit(200)

  return NextResponse.json({ data })
}, { resource: 'security', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = blocklistSchema.parse(body)

  const [created] = await db
    .insert(fraudBlocklist)
    .values({
      orgId: ctx.orgId,
      type: validated.type,
      value: validated.value,
      reason: validated.reason || null,
      createdBy: ctx.userId,
    })
    .returning()

  return NextResponse.json(created, { status: 201 })
}, { resource: 'security', action: 'create' })
