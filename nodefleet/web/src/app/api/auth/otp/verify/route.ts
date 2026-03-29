import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { userOtpSecrets } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { verifyTotpCode } from '@/lib/otp'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { code } = await request.json()
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 })
  }

  const [otpRecord] = await db
    .select()
    .from(userOtpSecrets)
    .where(eq(userOtpSecrets.userId, session.user.id))
    .limit(1)

  if (!otpRecord) {
    return NextResponse.json({ error: '2FA not set up' }, { status: 404 })
  }

  const valid = verifyTotpCode(otpRecord.secret, code)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  // Enable OTP if not already
  if (!otpRecord.enabled) {
    await db
      .update(userOtpSecrets)
      .set({ enabled: true, verifiedAt: new Date() })
      .where(eq(userOtpSecrets.id, otpRecord.id))
  }

  return NextResponse.json({ success: true, enabled: true })
}
