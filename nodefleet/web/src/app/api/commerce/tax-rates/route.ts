import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { taxRates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const createTaxRateSchema = z.object({
  name: z.string().min(1).max(255),
  region: z.string().max(100).optional(),
  rate: z.number().min(0).max(1),
  type: z.enum(['inclusive', 'exclusive']).default('exclusive'),
  enabled: z.boolean().default(true),
})

export const GET = withAuth(async (_request: NextRequest, ctx: AuthContext) => {
  const data = await db.select().from(taxRates).where(eq(taxRates.orgId, ctx.orgId))
  return NextResponse.json({ data })
}, { resource: 'commerce', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createTaxRateSchema.parse(body)

  const [rate] = await db.insert(taxRates).values({
    orgId: ctx.orgId,
    name: validated.name,
    region: validated.region || null,
    rate: validated.rate,
    type: validated.type,
    enabled: validated.enabled,
  }).returning()

  return NextResponse.json(rate, { status: 201 })
}, { resource: 'commerce', action: 'create' })
