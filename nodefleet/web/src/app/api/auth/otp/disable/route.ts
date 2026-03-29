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
    return NextResponse.json({ error: 'Current TOTP code required to disable 2FA' }, { status: 400 })
  }

  const [otpRecord] = await db
    .select()
    .from(userOtpSecrets)
    .where(eq(userOtpSecrets.userId, session.user.id))
    .limit(1)

  if (!otpRecord || !otpRecord.enabled) {
    return NextResponse.json({ error: '2FA is not enabled' }, { status: 404 })
  }

  const valid = verifyTotpCode(otpRecord.secret, code)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  // Delete the OTP record entirely
  await db.delete(userOtpSecrets).where(eq(userOtpSecrets.id, otpRecord.id))

  return NextResponse.json({ success: true, enabled: false })
}
