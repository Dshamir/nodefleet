import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { invoices } from '@/lib/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { z } from 'zod'

const createInvoiceSchema = z.object({
  customerId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  subtotal: z.number().int().min(0),
  taxAmount: z.number().int().min(0).default(0),
  total: z.number().int().min(0),
  currency: z.string().length(3).default('USD'),
  dueDate: z.string().optional(),
  lineItems: z.array(z.object({ description: z.string(), quantity: z.number(), unitPrice: z.number(), total: z.number() })),
})

export const GET = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  const data = await db.select().from(invoices).where(eq(invoices.orgId, ctx.orgId)).orderBy(desc(invoices.createdAt)).limit(limit).offset(offset)
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(invoices).where(eq(invoices.orgId, ctx.orgId))

  return NextResponse.json({ data, pagination: { page, limit, total: Number(count) } })
}, { resource: 'commerce', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createInvoiceSchema.parse(body)

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(invoices).where(eq(invoices.orgId, ctx.orgId))
  const invoiceNumber = `INV-${String(Number(count) + 1).padStart(6, '0')}`

  const [invoice] = await db.insert(invoices).values({
    orgId: ctx.orgId,
    orderId: validated.orderId || null,
    customerId: validated.customerId || null,
    invoiceNumber,
    subtotal: validated.subtotal,
    taxAmount: validated.taxAmount,
    total: validated.total,
    currency: validated.currency,
    dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
    lineItems: validated.lineItems,
  }).returning()

  return NextResponse.json(invoice, { status: 201 })
}, { resource: 'commerce', action: 'create' })
