import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { customAgents, aiProviders } from '@/lib/db/schema'
import { eq, desc, ilike, and, sql } from 'drizzle-orm'
import { z } from 'zod'

const createAgentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.enum(['system', 'support', 'chat', 'workflow', 'custom']).default('custom'),
  providerId: z.string().uuid().optional(),
  systemPrompt: z.string().optional(),
  isActive: z.boolean().default(true),
  config: z.record(z.unknown()).optional(),
})

export const GET = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const url = new URL(request.url)
  const search = url.searchParams.get('search') || ''
  const category = url.searchParams.get('category') || ''
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  const conditions: ReturnType<typeof eq>[] = [eq(customAgents.orgId, ctx.orgId)]
  if (search) conditions.push(ilike(customAgents.name, `%${search}%`))
  if (category && category !== 'all') conditions.push(eq(customAgents.category, category as any))

  const data = await db
    .select({
      id: customAgents.id,
      orgId: customAgents.orgId,
      name: customAgents.name,
      description: customAgents.description,
      category: customAgents.category,
      providerId: customAgents.providerId,
      systemPrompt: customAgents.systemPrompt,
      isActive: customAgents.isActive,
      config: customAgents.config,
      createdAt: customAgents.createdAt,
      updatedAt: customAgents.updatedAt,
      providerName: aiProviders.name,
      providerVendor: aiProviders.vendor,
    })
    .from(customAgents)
    .leftJoin(aiProviders, eq(customAgents.providerId, aiProviders.id))
    .where(and(...conditions))
    .orderBy(desc(customAgents.createdAt))
    .limit(limit)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(customAgents)
    .where(and(...conditions))

  return NextResponse.json({ data, pagination: { page, limit, total: Number(count) } })
}, { resource: 'ai', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createAgentSchema.parse(body)

  // Verify provider belongs to org if provided
  if (validated.providerId) {
    const [provider] = await db
      .select({ id: aiProviders.id })
      .from(aiProviders)
      .where(and(eq(aiProviders.id, validated.providerId), eq(aiProviders.orgId, ctx.orgId)))
      .limit(1)

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }
  }

  const [agent] = await db.insert(customAgents).values({
    orgId: ctx.orgId,
    name: validated.name,
    description: validated.description || null,
    category: validated.category,
    providerId: validated.providerId || null,
    systemPrompt: validated.systemPrompt || null,
    isActive: validated.isActive,
    config: validated.config || null,
  }).returning()

  return NextResponse.json(agent, { status: 201 })
}, { resource: 'ai', action: 'create' })
