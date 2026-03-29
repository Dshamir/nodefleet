import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { promptTemplates } from '@/lib/db/schema'
import { eq, desc, ilike, and, sql } from 'drizzle-orm'
import { z } from 'zod'

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  category: z.string().max(100).optional(),
  content: z.string().min(1),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
})

export const GET = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const url = new URL(request.url)
  const search = url.searchParams.get('search') || ''
  const category = url.searchParams.get('category') || ''
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  const conditions: ReturnType<typeof eq>[] = [eq(promptTemplates.orgId, ctx.orgId)]
  if (search) conditions.push(ilike(promptTemplates.name, `%${search}%`))
  if (category && category !== 'all') conditions.push(eq(promptTemplates.category, category))

  const data = await db
    .select()
    .from(promptTemplates)
    .where(and(...conditions))
    .orderBy(desc(promptTemplates.createdAt))
    .limit(limit)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(promptTemplates)
    .where(and(...conditions))

  return NextResponse.json({ data, pagination: { page, limit, total: Number(count) } })
}, { resource: 'ai', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createTemplateSchema.parse(body)

  // Check slug uniqueness within org
  const existing = await db
    .select({ id: promptTemplates.id })
    .from(promptTemplates)
    .where(and(eq(promptTemplates.orgId, ctx.orgId), eq(promptTemplates.slug, validated.slug)))
    .limit(1)

  if (existing.length > 0) {
    return NextResponse.json({ error: 'A template with this slug already exists' }, { status: 409 })
  }

  // Auto-extract variables from content if not provided
  const variables = validated.variables || extractVariables(validated.content)

  const [template] = await db.insert(promptTemplates).values({
    orgId: ctx.orgId,
    name: validated.name,
    slug: validated.slug,
    category: validated.category || null,
    content: validated.content,
    variables,
    isActive: validated.isActive,
  }).returning()

  return NextResponse.json(template, { status: 201 })
}, { resource: 'ai', action: 'create' })

/** Extract {{variable}} patterns from template content */
function extractVariables(content: string): string[] {
  const matches = content.match(/\{\{(\w+)\}\}/g) || []
  const vars = matches.map((m) => m.replace(/\{\{|\}\}/g, ''))
  return [...new Set(vars)]
}
