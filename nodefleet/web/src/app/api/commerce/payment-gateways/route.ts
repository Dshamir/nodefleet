import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/with-auth'

export const GET = withAuth(async (_request: NextRequest, _ctx: AuthContext) => {
  // Return configured payment gateway status
  const gateways = {
    stripe: {
      enabled: !!process.env.STRIPE_SECRET_KEY,
      testMode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || false,
      webhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
    },
  }

  return NextResponse.json({ gateways })
}, { resource: 'commerce', action: 'read' })
