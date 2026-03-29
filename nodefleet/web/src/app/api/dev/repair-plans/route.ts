import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { repairPlans } from '@/lib/db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { z } from 'zod'

const createRepairPlanSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  deviceId: z.string().uuid().optional(),
  steps: z.array(z.object({
    order: z.number().int().min(1),
    title: z.string(),
    description: z.string().optional(),
    estimatedMinutes: z.number().int().optional(),
  })).optional(),
  assignedTo: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
})

export const GET = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const url = new URL(request.url)
  const status = url.searchParams.get('status') || ''
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  const conditions = [eq(repairPlans.orgId, ctx.orgId)]
  if (status && status !== 'all') conditions.push(eq(repairPlans.status, status as any))

  const data = await db.select().from(repairPlans).where(and(...conditions)).orderBy(desc(repairPlans.createdAt)).limit(limit).offset(offset)
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(repairPlans).where(and(...conditions))

  return NextResponse.json({ data, pagination: { page, limit, total: Number(count) } })
}, { resource: 'development', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createRepairPlanSchema.parse(body)

  const [plan] = await db.insert(repairPlans).values({
    orgId: ctx.orgId,
    title: validated.title,
    description: validated.description || null,
    deviceId: validated.deviceId || null,
    steps: validated.steps || null,
    assignedTo: validated.assignedTo || null,
    dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
  }).returning()

  return NextResponse.json(plan, { status: 201 })
}, { resource: 'development', action: 'create' })
