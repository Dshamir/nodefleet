import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { aiProviders } from '@/lib/db/schema'
import { eq, desc, ilike, and, sql } from 'drizzle-orm'
import { z } from 'zod'

const createProviderSchema = z.object({
  name: z.string().min(1).max(255),
  vendor: z.string().min(1).max(100),
  baseUrl: z.string().max(500).optional(),
  model: z.string().max(100).optional(),
  apiKeyEncrypted: z.string().optional(),
  isActive: z.boolean().default(true),
})

export const GET = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const url = new URL(request.url)
  const search = url.searchParams.get('search') || ''
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  const conditions: ReturnType<typeof eq>[] = [eq(aiProviders.orgId, ctx.orgId)]
  if (search) conditions.push(ilike(aiProviders.name, `%${search}%`))

  const data = await db
    .select()
    .from(aiProviders)
    .where(and(...conditions))
    .orderBy(desc(aiProviders.createdAt))
    .limit(limit)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(aiProviders)
    .where(and(...conditions))

  // Strip API keys from response
  const safeData = data.map(({ apiKeyEncrypted, ...rest }) => ({
    ...rest,
    hasApiKey: !!apiKeyEncrypted,
  }))

  return NextResponse.json({ data: safeData, pagination: { page, limit, total: Number(count) } })
}, { resource: 'ai', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createProviderSchema.parse(body)

  const [provider] = await db.insert(aiProviders).values({
    orgId: ctx.orgId,
    name: validated.name,
    vendor: validated.vendor,
    baseUrl: validated.baseUrl || null,
    model: validated.model || null,
    apiKeyEncrypted: validated.apiKeyEncrypted || null,
    isActive: validated.isActive,
  }).returning()

  // Strip API key from response
  const { apiKeyEncrypted, ...safe } = provider
  return NextResponse.json({ ...safe, hasApiKey: !!apiKeyEncrypted }, { status: 201 })
}, { resource: 'ai', action: 'create' })
