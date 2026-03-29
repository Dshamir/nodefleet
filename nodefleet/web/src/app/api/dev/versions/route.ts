import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { versionReleases } from '@/lib/db/schema'
import { desc, sql } from 'drizzle-orm'
import { z } from 'zod'

const createVersionSchema = z.object({
  version: z.string().min(1).max(50),
  releaseNotes: z.string().optional(),
  changelog: z.record(z.unknown()).optional(),
})

export const GET = withAuth(async (request: NextRequest, _ctx: AuthContext) => {
  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  const data = await db.select().from(versionReleases).orderBy(desc(versionReleases.createdAt)).limit(limit).offset(offset)
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(versionReleases)

  return NextResponse.json({ data, pagination: { page, limit, total: Number(count) } })
}, { resource: 'development', action: 'read' })

export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = createVersionSchema.parse(body)

  const [release] = await db.insert(versionReleases).values({
    version: validated.version,
    releaseNotes: validated.releaseNotes || null,
    changelog: validated.changelog || null,
    releasedBy: ctx.userId,
  }).returning()

  return NextResponse.json(release, { status: 201 })
}, { resource: 'development', action: 'create' })
