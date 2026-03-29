import { NextRequest, NextResponse } from 'next/server'
import { withAuthOnly, type AuthContext } from '@/lib/with-auth'
import { markNotificationRead } from '@/lib/notifications'

export const PUT = withAuthOnly(async (
  _request: NextRequest,
  ctx: AuthContext & { params?: Record<string, string> }
) => {
  const id = ctx.params?.id
  if (!id) {
    return NextResponse.json({ error: 'Notification ID required' }, { status: 400 })
  }

  await markNotificationRead(id, ctx.userId)
  return NextResponse.json({ success: true })
})
