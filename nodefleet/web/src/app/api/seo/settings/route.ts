import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { seoSettings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const updateSchema = z.object({
  defaultTitle: z.string().max(255).optional().nullable(),
  defaultDescription: z.string().optional().nullable(),
  ogImage: z.string().max(500).optional().nullable(),
  robots: z.string().optional().nullable(),
  googleAnalyticsId: z.string().max(50).optional().nullable(),
  sitemap: z.any().optional().nullable(),
})

export const GET = withAuth(async (_request: NextRequest, ctx: AuthContext) => {
  const [settings] = await db
    .select()
    .from(seoSettings)
    .where(eq(seoSettings.orgId, ctx.orgId))
    .limit(1)

  return NextResponse.json(settings || {
    defaultTitle: '',
    defaultDescription: '',
    ogImage: '',
    robots: '',
    googleAnalyticsId: '',
    sitemap: null,
  })
}, { resource: 'settings', action: 'read' })

export const PUT = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = updateSchema.parse(body)

  const [existing] = await db
    .select({ id: seoSettings.id })
    .from(seoSettings)
    .where(eq(seoSettings.orgId, ctx.orgId))
    .limit(1)

  if (existing) {
    const [updated] = await db
      .update(seoSettings)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(seoSettings.id, existing.id))
      .returning()
    return NextResponse.json(updated)
  }

  const [created] = await db
    .insert(seoSettings)
    .values({ ...validated, orgId: ctx.orgId })
    .returning()
  return NextResponse.json(created, { status: 201 })
}, { resource: 'settings', action: 'update' })
