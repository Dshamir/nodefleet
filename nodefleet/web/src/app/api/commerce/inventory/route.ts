import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { products } from '@/lib/db/schema'
import { eq, desc, sql } from 'drizzle-orm'

export const GET = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  // Get products with stock info
  const data = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      stockQuantity: products.stockQuantity,
      trackInventory: products.trackInventory,
      status: products.status,
    })
    .from(products)
    .where(eq(products.orgId, ctx.orgId))
    .orderBy(desc(products.updatedAt))
    .limit(limit)
    .offset(offset)

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(products).where(eq(products.orgId, ctx.orgId))

  return NextResponse.json({ data, pagination: { page, limit, total: Number(count) } })
}, { resource: 'commerce', action: 'read' })
