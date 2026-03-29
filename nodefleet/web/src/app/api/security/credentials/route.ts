import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { credentialVault } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(255),
  envKey: z.string().max(100).optional(),
  type: z.enum(['api_key', 'token', 'password', 'certificate']).default('api_key'),
  service: z.string().max(100).optional(),
  description: z.string().optional(),
  value: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
})

export const GET = withAuth(async (_request: NextRequest, ctx: AuthContext) => {
  const data = await db
    .select({
      id: credentialVault.id,
      name: credentialVault.name,
      envKey: credentialVault.envKey,
      type: credentialVault.type,
      service: credentialVault.service,
      description: credentialVault.description,
      expiresAt: credentialVault.expiresAt,
      isActive: credentialVault.isActive,
      createdAt: credentialVault.createdAt,
      updatedAt: credentialVault.updatedAt,
    })
    .from(credentialVault)
    .where(eq(credentialVault.orgId, ctx.orgId))
    .orderBy(desc(credentialVault.createdAt))

  return NextResponse.json({ data })
}, { resource: 'security', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createSchema.parse(body)

  // In production, encrypt the value before storing
  const [created] = await db
    .insert(credentialVault)
    .values({
      orgId: ctx.orgId,
      name: validated.name,
      envKey: validated.envKey || null,
      type: validated.type,
      service: validated.service || null,
      description: validated.description || null,
      valueEncrypted: validated.value, // TODO: encrypt with AES-256
      expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
    })
    .returning({
      id: credentialVault.id,
      name: credentialVault.name,
      envKey: credentialVault.envKey,
      type: credentialVault.type,
      service: credentialVault.service,
      description: credentialVault.description,
      expiresAt: credentialVault.expiresAt,
      isActive: credentialVault.isActive,
      createdAt: credentialVault.createdAt,
    })

  return NextResponse.json(created, { status: 201 })
}, { resource: 'security', action: 'create' })
