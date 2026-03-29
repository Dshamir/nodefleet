import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { domains } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'

const createSchema = z.object({
  domain: z.string().min(1).max(255),
  primary: z.boolean().optional().default(false),
})

export const GET = withAuth(async (_request: NextRequest, ctx: AuthContext) => {
  const data = await db
    .select()
    .from(domains)
    .where(eq(domains.orgId, ctx.orgId))
    .orderBy(desc(domains.createdAt))

  return NextResponse.json({ data })
}, { resource: 'settings', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createSchema.parse(body)

  const [domain] = await db
    .insert(domains)
    .values({
      ...validated,
      orgId: ctx.orgId,
      verified: false,
      sslStatus: 'pending',
      dnsRecords: {
        cname: { name: validated.domain, value: `proxy.nodefleet.io`, status: 'pending' },
        txt: { name: `_nodefleet.${validated.domain}`, value: `nf-verify=${ctx.orgId.slice(0, 8)}`, status: 'pending' },
      },
    })
    .returning()

  return NextResponse.json(domain, { status: 201 })
}, { resource: 'settings', action: 'create' })
