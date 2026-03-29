import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { userOtpSecrets } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateTotpSecret, generateBackupCodes } from '@/lib/otp'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if OTP already enabled
  const [existing] = await db
    .select()
    .from(userOtpSecrets)
    .where(eq(userOtpSecrets.userId, session.user.id))
    .limit(1)

  if (existing?.enabled) {
    return NextResponse.json({ error: '2FA is already enabled' }, { status: 409 })
  }

  const { secret, uri } = generateTotpSecret(session.user.email)
  const { plaintext: backupCodes, hashed: hashedBackupCodes } = generateBackupCodes()

  // Upsert OTP secret (not yet enabled — user must verify first)
  if (existing) {
    await db
      .update(userOtpSecrets)
      .set({ secret, backupCodes: hashedBackupCodes, enabled: false, verifiedAt: null })
      .where(eq(userOtpSecrets.id, existing.id))
  } else {
    await db.insert(userOtpSecrets).values({
      userId: session.user.id,
      secret,
      backupCodes: hashedBackupCodes,
      enabled: false,
    })
  }

  return NextResponse.json({
    uri, // for QR code generation on client
    backupCodes, // show once, user must save
  })
}
