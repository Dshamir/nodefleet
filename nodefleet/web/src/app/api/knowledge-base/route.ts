import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { kbArticles, kbCategories } from '@/lib/db/schema'
import { eq, desc, ilike, and, sql } from 'drizzle-orm'
import { z } from 'zod'

const createArticleSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  content: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
})

const createCategorySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  sortOrder: z.number().int().default(0),
})

export const GET = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const url = new URL(request.url)
  const type = url.searchParams.get('type') || 'articles' // articles | categories
  const search = url.searchParams.get('search') || ''
  const status = url.searchParams.get('status') || ''
  const categoryId = url.searchParams.get('categoryId') || ''
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  // Return categories
  if (type === 'categories') {
    const categories = await db
      .select()
      .from(kbCategories)
      .where(eq(kbCategories.orgId, ctx.orgId))
      .orderBy(kbCategories.sortOrder)

    return NextResponse.json({ data: categories })
  }

  // Return articles with category name joined
  const conditions: ReturnType<typeof eq>[] = [eq(kbArticles.orgId, ctx.orgId)]
  if (search) conditions.push(ilike(kbArticles.title, `%${search}%`))
  if (status && status !== 'all') conditions.push(eq(kbArticles.status, status as any))
  if (categoryId && categoryId !== 'all') conditions.push(eq(kbArticles.categoryId, categoryId))

  const data = await db
    .select({
      id: kbArticles.id,
      orgId: kbArticles.orgId,
      title: kbArticles.title,
      slug: kbArticles.slug,
      content: kbArticles.content,
      categoryId: kbArticles.categoryId,
      status: kbArticles.status,
      views: kbArticles.views,
      createdAt: kbArticles.createdAt,
      updatedAt: kbArticles.updatedAt,
      categoryName: kbCategories.name,
    })
    .from(kbArticles)
    .leftJoin(kbCategories, eq(kbArticles.categoryId, kbCategories.id))
    .where(and(...conditions))
    .orderBy(desc(kbArticles.createdAt))
    .limit(limit)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(kbArticles)
    .where(and(...conditions))

  // Compute stats
  const [stats] = await db
    .select({
      total: sql<number>`count(*)`,
      published: sql<number>`count(*) filter (where ${kbArticles.status} = 'published')`,
      draft: sql<number>`count(*) filter (where ${kbArticles.status} = 'draft')`,
      totalViews: sql<number>`coalesce(sum(${kbArticles.views}), 0)`,
    })
    .from(kbArticles)
    .where(eq(kbArticles.orgId, ctx.orgId))

  return NextResponse.json({
    data,
    stats: {
      total: Number(stats?.total || 0),
      published: Number(stats?.published || 0),
      draft: Number(stats?.draft || 0),
      totalViews: Number(stats?.totalViews || 0),
    },
    pagination: { page, limit, total: Number(count) },
  })
}, { resource: 'knowledge_base', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()

  // Detect if creating a category or article
  if (body._type === 'category') {
    const validated = createCategorySchema.parse(body)
    const [category] = await db.insert(kbCategories).values({
      orgId: ctx.orgId,
      name: validated.name,
      slug: validated.slug,
      sortOrder: validated.sortOrder,
    }).returning()
    return NextResponse.json(category, { status: 201 })
  }

  // Create article
  const validated = createArticleSchema.parse(body)

  // Check slug uniqueness within org
  const existing = await db
    .select({ id: kbArticles.id })
    .from(kbArticles)
    .where(and(eq(kbArticles.orgId, ctx.orgId), eq(kbArticles.slug, validated.slug)))
    .limit(1)

  if (existing.length > 0) {
    return NextResponse.json({ error: 'An article with this slug already exists' }, { status: 409 })
  }

  // Verify category belongs to org if provided
  if (validated.categoryId) {
    const [cat] = await db
      .select({ id: kbCategories.id })
      .from(kbCategories)
      .where(and(eq(kbCategories.id, validated.categoryId), eq(kbCategories.orgId, ctx.orgId)))
      .limit(1)

    if (!cat) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }
  }

  const [article] = await db.insert(kbArticles).values({
    orgId: ctx.orgId,
    title: validated.title,
    slug: validated.slug,
    content: validated.content || null,
    categoryId: validated.categoryId || null,
    status: validated.status,
  }).returning()

  return NextResponse.json(article, { status: 201 })
}, { resource: 'knowledge_base', action: 'create' })
