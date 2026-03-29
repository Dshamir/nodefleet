import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { rateLimitRules } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(255),
  scope: z.enum(['global', 'per-tenant', 'per-user', 'per-endpoint']).default('global'),
  endpoint: z.string().max(255).optional(),
  maxRequests: z.number().int().min(1).max(100000).default(100),
  windowSeconds: z.number().int().min(1).max(86400).default(60),
  enabled: z.boolean().default(true),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean().optional(),
  maxRequests: z.number().int().min(1).max(100000).optional(),
  windowSeconds: z.number().int().min(1).max(86400).optional(),
})

export const GET = withAuth(async (_request: NextRequest, ctx: AuthContext) => {
  const data = await db
    .select()
    .from(rateLimitRules)
    .where(eq(rateLimitRules.orgId, ctx.orgId))
    .orderBy(desc(rateLimitRules.createdAt))

  return NextResponse.json({ data })
}, { resource: 'security', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createSchema.parse(body)

  const [created] = await db
    .insert(rateLimitRules)
    .values({
      orgId: ctx.orgId,
      name: validated.name,
      scope: validated.scope,
      endpoint: validated.endpoint || null,
      maxRequests: validated.maxRequests,
      windowSeconds: validated.windowSeconds,
      enabled: validated.enabled,
    })
    .returning()

  return NextResponse.json(created, { status: 201 })
}, { resource: 'security', action: 'create' })

export const PUT = withAuth(async (request: NextRequest, _ctx: AuthContext) => {
  const body = await request.json()
  const validated = updateSchema.parse(body)

  const [updated] = await db
    .update(rateLimitRules)
    .set({
      ...(validated.enabled !== undefined && { enabled: validated.enabled }),
      ...(validated.maxRequests !== undefined && { maxRequests: validated.maxRequests }),
      ...(validated.windowSeconds !== undefined && { windowSeconds: validated.windowSeconds }),
      updatedAt: new Date(),
    })
    .where(eq(rateLimitRules.id, validated.id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  return NextResponse.json(updated)
}, { resource: 'security', action: 'update' })
