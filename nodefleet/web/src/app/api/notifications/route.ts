import { NextRequest, NextResponse } from 'next/server'
import { withAuthOnly, type AuthContext } from '@/lib/with-auth'
import { getUserNotifications, sendNotification } from '@/lib/notifications'

export const GET = withAuthOnly(async (request: NextRequest, ctx: AuthContext) => {
  const url = new URL(request.url)
  const unreadOnly = url.searchParams.get('unread') === 'true'
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = parseInt(url.searchParams.get('offset') || '0')

  const result = await getUserNotifications(ctx.userId, { unreadOnly, limit, offset })
  return NextResponse.json(result)
})

export const POST = withAuthOnly(async (request: NextRequest, ctx: AuthContext) => {
  const body = await request.json()
  const { type, channel, title, body: notifBody, metadata } = body

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const id = await sendNotification({
    orgId: ctx.orgId,
    userId: ctx.userId,
    type: type || 'info',
    channel: channel || 'in_app',
    title,
    body: notifBody,
    metadata,
  })

  return NextResponse.json({ id }, { status: 201 })
})
