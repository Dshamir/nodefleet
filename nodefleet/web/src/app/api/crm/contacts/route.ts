import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { eq, desc, ilike, and, sql } from 'drizzle-orm'
import { z } from 'zod'

const createContactSchema = z.object({
  email: z.string().email(),
  name: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  company: z.string().max(255).optional(),
  title: z.string().max(255).optional(),
  source: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
})

export const GET = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const url = new URL(request.url)
  const search = url.searchParams.get('search') || ''
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  const conditions = [eq(contacts.orgId, ctx.orgId)]
  if (search) conditions.push(ilike(contacts.email, `%${search}%`))

  const data = await db.select().from(contacts).where(and(...conditions)).orderBy(desc(contacts.createdAt)).limit(limit).offset(offset)
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(contacts).where(and(...conditions))

  return NextResponse.json({ data, pagination: { page, limit, total: Number(count) } })
}, { resource: 'crm', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createContactSchema.parse(body)

  const [contact] = await db.insert(contacts).values({
    orgId: ctx.orgId,
    email: validated.email,
    name: validated.name || null,
    phone: validated.phone || null,
    company: validated.company || null,
    title: validated.title || null,
    source: validated.source || null,
    tags: validated.tags || null,
    customFields: validated.customFields || null,
  }).returning()

  return NextResponse.json(contact, { status: 201 })
}, { resource: 'crm', action: 'create' })
