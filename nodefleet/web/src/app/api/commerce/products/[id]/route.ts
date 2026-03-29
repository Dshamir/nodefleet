import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { products } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export const GET = withAuth(async (_request: NextRequest, ctx: AuthContext & { params?: Record<string, string> }) => {
  const id = ctx.params?.id
  if (!id) return NextResponse.json({ error: 'Product ID required' }, { status: 400 })

  const [product] = await db.select().from(products).where(and(eq(products.id, id), eq(products.orgId, ctx.orgId))).limit(1)
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  return NextResponse.json(product)
}, { resource: 'commerce', action: 'read' })

export const PUT = withAuth(async (request: NextRequest, ctx: AuthContext & { params?: Record<string, string> }) => {
  const id = ctx.params?.id
  if (!id) return NextResponse.json({ error: 'Product ID required' }, { status: 400 })

  const body = await request.json()
  const [updated] = await db.update(products).set({ ...body, updatedAt: new Date() }).where(and(eq(products.id, id), eq(products.orgId, ctx.orgId))).returning()
  if (!updated) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  return NextResponse.json(updated)
}, { resource: 'commerce', action: 'update' })

export const DELETE = withAuth(async (_request: NextRequest, ctx: AuthContext & { params?: Record<string, string> }) => {
  const id = ctx.params?.id
  if (!id) return NextResponse.json({ error: 'Product ID required' }, { status: 400 })

  await db.delete(products).where(and(eq(products.id, id), eq(products.orgId, ctx.orgId)))
  return NextResponse.json({ success: true })
}, { resource: 'commerce', action: 'delete' })
