import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { orders, orderItems } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export const GET = withAuth(async (_request: NextRequest, ctx: AuthContext & { params?: Record<string, string> }) => {
  const id = ctx.params?.id
  if (!id) return NextResponse.json({ error: 'Order ID required' }, { status: 400 })

  const [order] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.orgId, ctx.orgId))).limit(1)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id))

  return NextResponse.json({ ...order, items })
}, { resource: 'commerce', action: 'read' })

export const PUT = withAuth(async (request: NextRequest, ctx: AuthContext & { params?: Record<string, string> }) => {
  const id = ctx.params?.id
  if (!id) return NextResponse.json({ error: 'Order ID required' }, { status: 400 })

  const body = await request.json()
  const [updated] = await db.update(orders).set({ ...body, updatedAt: new Date() }).where(and(eq(orders.id, id), eq(orders.orgId, ctx.orgId))).returning()
  if (!updated) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  return NextResponse.json(updated)
}, { resource: 'commerce', action: 'update' })
