import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { promoCodes } from '@/lib/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { z } from 'zod'

const createPromoSchema = z.object({
  code: z.string().min(1).max(50),
  type: z.enum(['percentage', 'fixed', 'free_shipping']),
  value: z.number().int().min(0),
  minOrderAmount: z.number().int().min(0).optional(),
  maxUses: z.number().int().min(1).optional(),
  startsAt: z.string().optional(),
  expiresAt: z.string().optional(),
  enabled: z.boolean().default(true),
})

export const GET = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  const data = await db.select().from(promoCodes).where(eq(promoCodes.orgId, ctx.orgId)).orderBy(desc(promoCodes.createdAt)).limit(limit).offset(offset)
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(promoCodes).where(eq(promoCodes.orgId, ctx.orgId))

  return NextResponse.json({ data, pagination: { page, limit, total: Number(count) } })
}, { resource: 'commerce', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createPromoSchema.parse(body)

  const [promo] = await db.insert(promoCodes).values({
    orgId: ctx.orgId,
    code: validated.code.toUpperCase(),
    type: validated.type,
    value: validated.value,
    minOrderAmount: validated.minOrderAmount || null,
    maxUses: validated.maxUses || null,
    startsAt: validated.startsAt ? new Date(validated.startsAt) : null,
    expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
    enabled: validated.enabled,
  }).returning()

  return NextResponse.json(promo, { status: 201 })
}, { resource: 'commerce', action: 'create' })
