import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiKeys, users, organizations } from '@/lib/db/schema';
import { auth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';

/**
 * Generate a deterministic API key based on org + user + random salt.
 * Format: nf_<prefix>_<hash>
 * The key is shown once to the user, then only the hash is stored.
 */
function generateApiKey(orgId: string, userId: string, orgName: string, userName: string): { key: string; hash: string; prefix: string } {
  const salt = randomBytes(16).toString('hex');
  const payload = `${orgId}:${userId}:${orgName}:${userName}:${salt}:${Date.now()}`;
  const hash = createHash('sha256').update(payload).digest('hex');
  const key = `nf_${hash.slice(0, 8)}_${hash.slice(8, 40)}`;
  const keyHash = createHash('sha256').update(key).digest('hex');
  const prefix = `nf_${hash.slice(0, 8)}`;
  return { key, hash: keyHash, prefix };
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const keys = await db.select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    }).from(apiKeys).where(
      and(eq(apiKeys.userId, session.user.id), eq(apiKeys.orgId, session.user.orgId))
    );

    return NextResponse.json({ data: keys });
  } catch (error) {
    console.error('List API keys error:', error);
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const keyName = body.name || 'API Key';

    // Get org and user names for key generation
    const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, session.user.id));
    const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, session.user.orgId));

    const { key, hash, prefix } = generateApiKey(
      session.user.orgId,
      session.user.id,
      org?.name || 'org',
      user?.name || 'user',
    );

    await db.insert(apiKeys).values({
      userId: session.user.id,
      orgId: session.user.orgId,
      name: keyName,
      keyHash: hash,
      keyPrefix: prefix,
    });

    // Return the full key ONCE — it won't be retrievable again
    return NextResponse.json({
      key,
      prefix,
      name: keyName,
      message: 'Save this key now. It will not be shown again.',
    }, { status: 201 });
  } catch (error) {
    console.error('Create API key error:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}
