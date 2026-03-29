import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { shippingMethods } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'

const createShippingSchema = z.object({
  name: z.string().min(1).max(255),
  carrier: z.string().max(100).optional(),
  estimatedDays: z.number().int().min(0).optional(),
  price: z.number().int().min(0),
  freeAbove: z.number().int().min(0).optional(),
  enabled: z.boolean().default(true),
})

export const GET = withAuth(async (_request: NextRequest, ctx: AuthContext) => {
  const data = await db.select().from(shippingMethods).where(eq(shippingMethods.orgId, ctx.orgId)).orderBy(desc(shippingMethods.createdAt))
  return NextResponse.json({ data })
}, { resource: 'commerce', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createShippingSchema.parse(body)

  const [method] = await db.insert(shippingMethods).values({
    orgId: ctx.orgId,
    name: validated.name,
    carrier: validated.carrier || null,
    estimatedDays: validated.estimatedDays || null,
    price: validated.price,
    freeAbove: validated.freeAbove || null,
    enabled: validated.enabled,
  }).returning()

  return NextResponse.json(method, { status: 201 })
}, { resource: 'commerce', action: 'create' })
