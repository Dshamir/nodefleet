import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { products } from '@/lib/db/schema'
import { eq, desc, ilike, and, sql } from 'drizzle-orm'
import { z } from 'zod'

const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().optional(),
  sku: z.string().max(100).optional(),
  price: z.number().int().min(0),
  compareAtPrice: z.number().int().min(0).optional(),
  currency: z.string().length(3).default('USD'),
  categoryId: z.string().uuid().optional().nullable(),
  images: z.array(z.string()).optional(),
  status: z.enum(['active', 'draft', 'archived']).default('draft'),
  stockQuantity: z.number().int().min(0).default(0),
  trackInventory: z.boolean().default(true),
  weight: z.number().optional(),
  dimensions: z.object({ length: z.number(), width: z.number(), height: z.number() }).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const GET = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const url = new URL(request.url)
  const search = url.searchParams.get('search') || ''
  const status = url.searchParams.get('status') || ''
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  const conditions = [eq(products.orgId, ctx.orgId)]
  if (search) conditions.push(ilike(products.name, `%${search}%`))
  if (status && status !== 'all') conditions.push(eq(products.status, status as 'active' | 'draft' | 'archived'))

  const data = await db.select().from(products).where(and(...conditions)).orderBy(desc(products.createdAt)).limit(limit).offset(offset)
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(products).where(and(...conditions))

  return NextResponse.json({ data, pagination: { page, limit, total: Number(count) } })
}, { resource: 'commerce', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createProductSchema.parse(body)

  const [product] = await db.insert(products).values({ ...validated, orgId: ctx.orgId }).returning()
  return NextResponse.json(product, { status: 201 })
}, { resource: 'commerce', action: 'create' })
