import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { cmsPages } from '@/lib/db/schema'
import { eq, desc, ilike, and, sql } from 'drizzle-orm'
import { z } from 'zod'

const createPageSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  pageType: z.enum(['home', 'about', 'contact', 'footer', 'custom']).default('custom'),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  content: z.string().optional(),
})

export const GET = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const url = new URL(request.url)
  const search = url.searchParams.get('search') || ''
  const status = url.searchParams.get('status') || ''
  const pageType = url.searchParams.get('type') || ''
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  const conditions: ReturnType<typeof eq>[] = [eq(cmsPages.orgId, ctx.orgId)]
  if (search) conditions.push(ilike(cmsPages.title, `%${search}%`))
  if (status && status !== 'all') conditions.push(eq(cmsPages.status, status as any))
  if (pageType && pageType !== 'all') conditions.push(eq(cmsPages.pageType, pageType))

  const data = await db
    .select()
    .from(cmsPages)
    .where(and(...conditions))
    .orderBy(desc(cmsPages.createdAt))
    .limit(limit)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(cmsPages)
    .where(and(...conditions))

  return NextResponse.json({ data, pagination: { page, limit, total: Number(count) } })
}, { resource: 'cms', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createPageSchema.parse(body)

  // Check slug uniqueness within org
  const existing = await db
    .select({ id: cmsPages.id })
    .from(cmsPages)
    .where(and(eq(cmsPages.orgId, ctx.orgId), eq(cmsPages.slug, validated.slug)))
    .limit(1)

  if (existing.length > 0) {
    return NextResponse.json({ error: 'A page with this slug already exists' }, { status: 409 })
  }

  const [page] = await db.insert(cmsPages).values({
    orgId: ctx.orgId,
    title: validated.title,
    slug: validated.slug,
    pageType: validated.pageType,
    status: validated.status,
    content: validated.content || null,
    publishedAt: validated.status === 'published' ? new Date() : null,
  }).returning()

  return NextResponse.json(page, { status: 201 })
}, { resource: 'cms', action: 'create' })
