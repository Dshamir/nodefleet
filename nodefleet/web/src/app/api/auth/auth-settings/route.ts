import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { authSettings } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

const updateSchema = z.object({
  settings: z.record(z.unknown()),
})

export const GET = withAuth(async (_request: NextRequest, ctx: AuthContext) => {
  const rows = await db
    .select()
    .from(authSettings)
    .where(eq(authSettings.orgId, ctx.orgId))

  // Convert rows to key-value map
  const data: Record<string, unknown> = {}
  for (const row of rows) {
    data[row.settingKey] = row.settingValue
  }

  return NextResponse.json({ data })
}, { resource: 'settings', action: 'read' })

export const PUT = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const validated = updateSchema.parse(body)

  const results: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(validated.settings)) {
    // Upsert each setting
    const existing = await db
      .select()
      .from(authSettings)
      .where(and(eq(authSettings.orgId, ctx.orgId), eq(authSettings.settingKey, key)))
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(authSettings)
        .set({ settingValue: value as any, updatedAt: new Date() })
        .where(and(eq(authSettings.orgId, ctx.orgId), eq(authSettings.settingKey, key)))
    } else {
      await db
        .insert(authSettings)
        .values({
          orgId: ctx.orgId,
          settingKey: key,
          settingValue: value as any,
        })
    }
    results[key] = value
  }

  return NextResponse.json({ data: results })
}, { resource: 'settings', action: 'update' })
