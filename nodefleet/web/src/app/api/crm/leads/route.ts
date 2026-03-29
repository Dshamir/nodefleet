import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { leads } from '@/lib/db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { z } from 'zod'

const createLeadSchema = z.object({
  contactId: z.string().uuid().optional(),
  source: z.string().max(100).optional(),
  value: z.number().int().min(0).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
})

export const GET = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const url = new URL(request.url)
  const status = url.searchParams.get('status') || ''
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  const conditions = [eq(leads.orgId, ctx.orgId)]
  if (status && status !== 'all') conditions.push(eq(leads.status, status as any))

  const data = await db.select().from(leads).where(and(...conditions)).orderBy(desc(leads.createdAt)).limit(limit).offset(offset)
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(leads).where(and(...conditions))

  return NextResponse.json({ data, pagination: { page, limit, total: Number(count) } })
}, { resource: 'crm', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createLeadSchema.parse(body)

  const [lead] = await db.insert(leads).values({
    orgId: ctx.orgId,
    contactId: validated.contactId || null,
    source: validated.source || null,
    value: validated.value || null,
    probability: validated.probability || null,
    expectedCloseDate: validated.expectedCloseDate ? new Date(validated.expectedCloseDate) : null,
    assignedTo: validated.assignedTo || null,
  }).returning()

  return NextResponse.json(lead, { status: 201 })
}, { resource: 'crm', action: 'create' })
