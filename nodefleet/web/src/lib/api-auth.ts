import { NextRequest } from 'next/server';
import { auth } from './auth';
import { db } from './db';
import { apiKeys, orgMembers } from './db/schema';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';

/**
 * Authenticate a request via session cookie OR API key.
 * Returns { userId, orgId } or null if unauthorized.
 *
 * API keys are passed as: Authorization: Bearer nf_XXXXXXXX_YYYYYYYY
 * The key is hashed with SHA-256 and compared against stored key_hash.
 */
export async function authenticateRequest(
  request?: NextRequest
): Promise<{ userId: string; orgId: string; via: 'session' | 'apikey' } | null> {
  // Try session first
  const session = await auth();
  if (session?.user?.id && session?.user?.orgId) {
    return { userId: session.user.id, orgId: session.user.orgId, via: 'session' };
  }

  // Try API key from Authorization header
  if (request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer nf_')) {
      const key = authHeader.slice(7); // Remove "Bearer "
      const keyHash = createHash('sha256').update(key).digest('hex');

      const [found] = await db
        .select({
          id: apiKeys.id,
          userId: apiKeys.userId,
          orgId: apiKeys.orgId,
          expiresAt: apiKeys.expiresAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, keyHash))
        .limit(1);

      if (found) {
        // Check expiry
        if (found.expiresAt && new Date() > found.expiresAt) {
          return null;
        }

        // Update last used
        await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, found.id));

        return { userId: found.userId, orgId: found.orgId, via: 'apikey' };
      }
    }
  }

  return null;
}
