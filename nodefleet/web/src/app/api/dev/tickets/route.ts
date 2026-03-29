import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { devTickets } from '@/lib/db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { z } from 'zod'

const createTicketSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  assignedTo: z.string().uuid().optional(),
  labels: z.array(z.string()).optional(),
})

export const GET = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const url = new URL(request.url)
  const status = url.searchParams.get('status') || ''
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  const conditions = [eq(devTickets.orgId, ctx.orgId)]
  if (status && status !== 'all') conditions.push(eq(devTickets.status, status as any))

  const data = await db.select().from(devTickets).where(and(...conditions)).orderBy(desc(devTickets.createdAt)).limit(limit).offset(offset)
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(devTickets).where(and(...conditions))

  return NextResponse.json({ data, pagination: { page, limit, total: Number(count) } })
}, { resource: 'development', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createTicketSchema.parse(body)

  const [ticket] = await db.insert(devTickets).values({
    orgId: ctx.orgId,
    title: validated.title,
    description: validated.description || null,
    priority: validated.priority,
    assignedTo: validated.assignedTo || null,
    labels: validated.labels || null,
  }).returning()

  return NextResponse.json(ticket, { status: 201 })
}, { resource: 'development', action: 'create' })
