import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { leadForms } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'

const createFormSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  fields: z.array(z.object({
    name: z.string(),
    type: z.string(),
    label: z.string(),
    required: z.boolean().default(false),
  })),
  redirectUrl: z.string().max(500).optional(),
  active: z.boolean().default(true),
})

export const GET = withAuth(async (_request: NextRequest, ctx: AuthContext) => {
  const data = await db.select().from(leadForms).where(eq(leadForms.orgId, ctx.orgId)).orderBy(desc(leadForms.createdAt))
  return NextResponse.json({ data })
}, { resource: 'crm', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createFormSchema.parse(body)

  const [form] = await db.insert(leadForms).values({
    orgId: ctx.orgId,
    name: validated.name,
    slug: validated.slug,
    fields: validated.fields,
    redirectUrl: validated.redirectUrl || null,
    active: validated.active,
  }).returning()

  return NextResponse.json(form, { status: 201 })
}, { resource: 'crm', action: 'create' })
