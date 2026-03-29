import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { devWikiPages } from '@/lib/db/schema'
import { eq, desc, and, sql, asc, isNull } from 'drizzle-orm'
import { z } from 'zod'

const createWikiPageSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  content: z.string().optional(),
  parentId: z.string().uuid().optional(),
  sortOrder: z.number().int().min(0).default(0),
})

export const GET = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const url = new URL(request.url)
  const parentId = url.searchParams.get('parentId')
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '100')
  const offset = (page - 1) * limit

  const conditions = [eq(devWikiPages.orgId, ctx.orgId)]
  if (parentId) {
    conditions.push(eq(devWikiPages.parentId, parentId))
  } else if (url.searchParams.get('root') === 'true') {
    conditions.push(isNull(devWikiPages.parentId))
  }

  const data = await db.select().from(devWikiPages).where(and(...conditions)).orderBy(asc(devWikiPages.sortOrder), desc(devWikiPages.createdAt)).limit(limit).offset(offset)
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(devWikiPages).where(and(...conditions))

  return NextResponse.json({ data, pagination: { page, limit, total: Number(count) } })
}, { resource: 'development', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createWikiPageSchema.parse(body)

  const [wikiPage] = await db.insert(devWikiPages).values({
    orgId: ctx.orgId,
    title: validated.title,
    slug: validated.slug,
    content: validated.content || null,
    parentId: validated.parentId || null,
    sortOrder: validated.sortOrder,
  }).returning()

  return NextResponse.json(wikiPage, { status: 201 })
}, { resource: 'development', action: 'create' })
