import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { desc, sql, ilike, or } from 'drizzle-orm'

export const GET = withAuth(async (request: NextRequest, _ctx: AuthContext) => {
  const url = new URL(request.url)
  const search = url.searchParams.get('search') || ''
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25')))
  const offset = (page - 1) * limit

  const conditions = search
    ? or(
        ilike(users.email, `%${search}%`),
        ilike(users.name, `%${search}%`)
      )
    : undefined

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(users)
    .where(conditions)

  const data = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(conditions)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset)

  return NextResponse.json({
    data,
    pagination: { page, limit, total: Number(total) },
  })
}, { resource: 'admin', action: 'read' })
