import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { orders, orderItems } from '@/lib/db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { z } from 'zod'

const createOrderSchema = z.object({
  customerId: z.string().uuid().optional(),
  items: z.array(z.object({
    productId: z.string().uuid().optional(),
    variantId: z.string().uuid().optional(),
    name: z.string(),
    sku: z.string().optional(),
    quantity: z.number().int().min(1),
    unitPrice: z.number().int().min(0),
  })),
  shippingAddress: z.record(z.unknown()).optional(),
  billingAddress: z.record(z.unknown()).optional(),
  shippingAmount: z.number().int().min(0).default(0),
  taxAmount: z.number().int().min(0).default(0),
  discountAmount: z.number().int().min(0).default(0),
  notes: z.string().optional(),
  currency: z.string().length(3).default('USD'),
})

export const GET = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const url = new URL(request.url)
  const status = url.searchParams.get('status') || ''
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  const conditions = [eq(orders.orgId, ctx.orgId)]
  if (status && status !== 'all') conditions.push(eq(orders.status, status as any))

  const data = await db.select().from(orders).where(and(...conditions)).orderBy(desc(orders.createdAt)).limit(limit).offset(offset)
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(orders).where(and(...conditions))

  return NextResponse.json({ data, pagination: { page, limit, total: Number(count) } })
}, { resource: 'commerce', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createOrderSchema.parse(body)

  const subtotal = validated.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const total = subtotal + validated.taxAmount + validated.shippingAmount - validated.discountAmount

  // Generate order number
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.orgId, ctx.orgId))
  const orderNumber = `ORD-${String(Number(count) + 1).padStart(6, '0')}`

  const [order] = await db.insert(orders).values({
    orgId: ctx.orgId,
    customerId: validated.customerId || null,
    orderNumber,
    status: 'pending',
    subtotal,
    taxAmount: validated.taxAmount,
    shippingAmount: validated.shippingAmount,
    discountAmount: validated.discountAmount,
    total,
    currency: validated.currency,
    shippingAddress: validated.shippingAddress || null,
    billingAddress: validated.billingAddress || null,
    notes: validated.notes || null,
  }).returning()

  // Insert order items
  if (validated.items.length > 0) {
    await db.insert(orderItems).values(
      validated.items.map((item) => ({
        orderId: order.id,
        productId: item.productId || null,
        variantId: item.variantId || null,
        name: item.name,
        sku: item.sku || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.unitPrice * item.quantity,
      }))
    )
  }

  return NextResponse.json(order, { status: 201 })
}, { resource: 'commerce', action: 'create' })
