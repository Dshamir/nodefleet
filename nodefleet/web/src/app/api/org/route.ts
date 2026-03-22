import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizations, devices, mediaFiles, orgMembers, users } from '@/lib/db/schema';
import { auth } from '@/lib/auth';
import { eq, sql, and } from 'drizzle-orm';
import { createHash } from 'crypto';

/**
 * Generate a readable org identifier from org + owner data.
 * Format: NF-<ORG_PREFIX>-<HASH_6>
 * Example: NF-TESTORG-A1B2C3
 */
function generateOrgIdentifier(orgId: string, orgName: string, ownerEmail: string): string {
  const prefix = orgName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  const payload = `${orgId}:${orgName}:${ownerEmail}`;
  const hash = createHash('sha256').update(payload).digest('hex').toUpperCase().slice(0, 6);
  return `NF-${prefix}-${hash}`;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [org] = await db.select().from(organizations).where(eq(organizations.id, session.user.orgId));
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get owner info
    const [owner] = await db.select({ name: users.name, email: users.email })
      .from(users).where(eq(users.id, org.ownerId));

    // Get counts
    const [deviceCount] = await db.select({ count: sql<number>`count(*)` })
      .from(devices).where(eq(devices.orgId, org.id));
    const [mediaCount] = await db.select({ count: sql<number>`count(*)` })
      .from(mediaFiles).where(eq(mediaFiles.orgId, org.id));
    const [memberCount] = await db.select({ count: sql<number>`count(*)` })
      .from(orgMembers).where(eq(orgMembers.orgId, org.id));

    const orgIdentifier = generateOrgIdentifier(org.id, org.name, owner?.email || '');

    return NextResponse.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      deviceLimit: org.deviceLimit,
      storageLimit: org.storageLimit,
      orgIdentifier,
      owner: { name: owner?.name, email: owner?.email },
      stats: {
        devices: Number(deviceCount?.count || 0),
        media: Number(mediaCount?.count || 0),
        members: Number(memberCount?.count || 0),
      },
      createdAt: org.createdAt,
    });
  } catch (error) {
    console.error('Org fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch organization' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.orgId || !session?.user?.role || !['owner', 'admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Only org owners/admins can update organization' }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (body.name) updates.name = body.name;

    await db.update(organizations).set(updates).where(eq(organizations.id, session.user.orgId));

    return NextResponse.json({ message: 'Organization updated' });
  } catch (error) {
    console.error('Org update error:', error);
    return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
  }
}
