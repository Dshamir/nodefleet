import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { emailTemplates } from '@/lib/db/schema'
import { eq, desc, ilike, and, sql } from 'drizzle-orm'
import { z } from 'zod'

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  subject: z.string().max(255).optional(),
  htmlBody: z.string().optional(),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
})

export const GET = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const url = new URL(request.url)
  const search = url.searchParams.get('search') || ''
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  const conditions: ReturnType<typeof eq>[] = [eq(emailTemplates.orgId, ctx.orgId)]
  if (search) conditions.push(ilike(emailTemplates.name, `%${search}%`))

  const data = await db
    .select()
    .from(emailTemplates)
    .where(and(...conditions))
    .orderBy(desc(emailTemplates.createdAt))
    .limit(limit)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailTemplates)
    .where(and(...conditions))

  return NextResponse.json({ data, pagination: { page, limit, total: Number(count) } })
}, { resource: 'settings', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createTemplateSchema.parse(body)

  // Check slug uniqueness within org
  const existing = await db
    .select({ id: emailTemplates.id })
    .from(emailTemplates)
    .where(and(eq(emailTemplates.orgId, ctx.orgId), eq(emailTemplates.slug, validated.slug)))
    .limit(1)

  if (existing.length > 0) {
    return NextResponse.json({ error: 'A template with this slug already exists' }, { status: 409 })
  }

  const [template] = await db.insert(emailTemplates).values({
    orgId: ctx.orgId,
    name: validated.name,
    slug: validated.slug,
    subject: validated.subject || null,
    htmlBody: validated.htmlBody || null,
    variables: validated.variables || null,
    isActive: validated.isActive,
  }).returning()

  return NextResponse.json(template, { status: 201 })
}, { resource: 'settings', action: 'update' })
