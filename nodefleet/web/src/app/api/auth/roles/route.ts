import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { customRoles } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'

const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  permissions: z.record(z.array(z.string())),
})

export const GET = withAuth(async (_request: NextRequest, ctx: AuthContext) => {
  const data = await db
    .select()
    .from(customRoles)
    .where(eq(customRoles.orgId, ctx.orgId))
    .orderBy(desc(customRoles.createdAt))

  return NextResponse.json({ data })
}, { resource: 'settings', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createRoleSchema.parse(body)

  const [created] = await db
    .insert(customRoles)
    .values({
      orgId: ctx.orgId,
      name: validated.name,
      description: validated.description || null,
      permissions: validated.permissions,
    })
    .returning()

  return NextResponse.json(created, { status: 201 })
}, { resource: 'settings', action: 'update' })
