import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { customers } from '@/lib/db/schema'
import { eq, desc, ilike, and, sql } from 'drizzle-orm'
import { z } from 'zod'

const createCustomerSchema = z.object({
  email: z.string().email(),
  name: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  company: z.string().max(255).optional(),
  address: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
})

export const GET = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const url = new URL(request.url)
  const search = url.searchParams.get('search') || ''
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  const conditions = [eq(customers.orgId, ctx.orgId)]
  if (search) conditions.push(ilike(customers.email, `%${search}%`))

  const data = await db.select().from(customers).where(and(...conditions)).orderBy(desc(customers.createdAt)).limit(limit).offset(offset)
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(customers).where(and(...conditions))

  return NextResponse.json({ data, pagination: { page, limit, total: Number(count) } })
}, { resource: 'commerce', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createCustomerSchema.parse(body)

  const [customer] = await db.insert(customers).values({
    orgId: ctx.orgId,
    email: validated.email,
    name: validated.name || null,
    phone: validated.phone || null,
    company: validated.company || null,
    address: validated.address || null,
    tags: validated.tags || null,
    notes: validated.notes || null,
  }).returning()

  return NextResponse.json(customer, { status: 201 })
}, { resource: 'commerce', action: 'create' })
