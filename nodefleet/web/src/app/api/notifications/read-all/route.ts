import { NextRequest, NextResponse } from 'next/server'
import { withAuthOnly, type AuthContext } from '@/lib/with-auth'
import { markAllNotificationsRead } from '@/lib/notifications'

export const PUT = withAuthOnly(async (_request: NextRequest, ctx: AuthContext) => {
  await markAllNotificationsRead(ctx.userId)
  return NextResponse.json({ success: true })
})
