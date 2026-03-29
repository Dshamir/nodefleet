import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { contentPolicies } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  policyType: z.string().min(1).max(50),
  action: z.enum(['flag', 'reject', 'quarantine', 'log']).default('flag'),
  rules: z.array(z.string()).optional(),
  enabled: z.boolean().default(true),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  action: z.enum(['flag', 'reject', 'quarantine', 'log']).optional(),
  rules: z.array(z.string()).optional(),
})

export const GET = withAuth(async (_request: NextRequest, ctx: AuthContext) => {
  const data = await db
    .select()
    .from(contentPolicies)
    .where(eq(contentPolicies.orgId, ctx.orgId))
    .orderBy(desc(contentPolicies.createdAt))

  return NextResponse.json({ data })
}, { resource: 'security', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createSchema.parse(body)

  const [created] = await db
    .insert(contentPolicies)
    .values({
      orgId: ctx.orgId,
      name: validated.name,
      description: validated.description || null,
      policyType: validated.policyType,
      action: validated.action,
      rules: validated.rules || [],
      enabled: validated.enabled,
    })
    .returning()

  return NextResponse.json(created, { status: 201 })
}, { resource: 'security', action: 'create' })

export const PUT = withAuth(async (request: NextRequest, _ctx: AuthContext) => {
  const body = await request.json()
  const validated = updateSchema.parse(body)

  const [updated] = await db
    .update(contentPolicies)
    .set({
      ...(validated.enabled !== undefined && { enabled: validated.enabled }),
      ...(validated.name && { name: validated.name }),
      ...(validated.description !== undefined && { description: validated.description }),
      ...(validated.action && { action: validated.action }),
      ...(validated.rules && { rules: validated.rules }),
      updatedAt: new Date(),
    })
    .where(eq(contentPolicies.id, validated.id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'Policy not found' }, { status: 404 })
  }

  return NextResponse.json(updated)
}, { resource: 'security', action: 'update' })
