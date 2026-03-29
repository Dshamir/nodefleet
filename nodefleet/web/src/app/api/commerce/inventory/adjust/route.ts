import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { products, inventoryMovements } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'

const adjustSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  type: z.enum(['in', 'out', 'adjustment']),
  quantity: z.number().int(),
  reason: z.string().max(255).optional(),
  reference: z.string().max(255).optional(),
})

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = adjustSchema.parse(body)

  // Record movement
  const [movement] = await db.insert(inventoryMovements).values({
    productId: validated.productId,
    variantId: validated.variantId || null,
    type: validated.type,
    quantity: validated.quantity,
    reason: validated.reason || null,
    reference: validated.reference || null,
    createdBy: ctx.userId,
  }).returning()

  // Update stock quantity
  const delta = validated.type === 'out' ? -validated.quantity : validated.quantity
  await db.update(products).set({
    stockQuantity: sql`${products.stockQuantity} + ${delta}`,
    updatedAt: new Date(),
  }).where(eq(products.id, validated.productId))

  return NextResponse.json(movement, { status: 201 })
}, { resource: 'commerce', action: 'update' })
