import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { z } from 'zod'

const createCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['email', 'sms', 'push']).default('email'),
  subject: z.string().max(255).optional(),
  content: z.string().optional(),
  audience: z.record(z.unknown()).optional(),
  scheduledAt: z.string().optional(),
})

export const GET = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const url = new URL(request.url)
  const status = url.searchParams.get('status') || ''
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  const conditions = [eq(campaigns.orgId, ctx.orgId)]
  if (status && status !== 'all') conditions.push(eq(campaigns.status, status as any))

  const data = await db.select().from(campaigns).where(and(...conditions)).orderBy(desc(campaigns.createdAt)).limit(limit).offset(offset)
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(campaigns).where(and(...conditions))

  return NextResponse.json({ data, pagination: { page, limit, total: Number(count) } })
}, { resource: 'marketing', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createCampaignSchema.parse(body)

  const [campaign] = await db.insert(campaigns).values({
    orgId: ctx.orgId,
    name: validated.name,
    type: validated.type,
    subject: validated.subject || null,
    content: validated.content || null,
    audience: validated.audience || null,
    scheduledAt: validated.scheduledAt ? new Date(validated.scheduledAt) : null,
  }).returning()

  return NextResponse.json(campaign, { status: 201 })
}, { resource: 'marketing', action: 'create' })
