import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'
import { PLANS } from '@/lib/stripe'

export const GET = withAuth(async (_request: NextRequest, _ctx: AuthContext) => {
  return NextResponse.json({ plans: PLANS })
}, { resource: 'commerce', action: 'read' })
