import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, organizations, orgMembers } from '@/lib/db/schema';
import { auth } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { password } = await request.json();
    if (!password) {
      return NextResponse.json({ error: 'Password confirmation required' }, { status: 400 });
    }

    // Verify password
    const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 403 });
    }

    // Remove org memberships
    await db.delete(orgMembers).where(eq(orgMembers.userId, session.user.id));

    // If user is sole owner of any org, delete those orgs (cascade deletes devices, etc.)
    if (session.user.orgId) {
      const [org] = await db.select().from(organizations).where(eq(organizations.ownerId, session.user.id));
      if (org) {
        await db.delete(organizations).where(eq(organizations.id, org.id));
      }
    }

    // Delete the user (cascades to sessions, accounts, api_keys)
    await db.delete(users).where(eq(users.id, session.user.id));

    return NextResponse.json({ message: 'Account deleted' });
  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
