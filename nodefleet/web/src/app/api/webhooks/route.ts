import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { webhooks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';

const VALID_EVENTS = [
  'device_online',
  'device_offline',
  'command_completed',
  'alert_triggered',
  'low_battery',
] as const;

const createWebhookSchema = z.object({
  url: z.string().url().max(500),
  events: z
    .array(z.enum(VALID_EVENTS))
    .min(1, 'At least one event is required'),
  secret: z.string().max(255).optional(),
  enabled: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.orgId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const orgWebhooks = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.orgId, session.user.orgId));

    return NextResponse.json(orgWebhooks);
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json(
      { message: 'Failed to fetch webhooks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.orgId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = createWebhookSchema.parse(body);

    // Auto-generate secret if not provided
    const secret = validated.secret || randomBytes(32).toString('hex');

    const [newWebhook] = await db
      .insert(webhooks)
      .values({
        orgId: session.user.orgId,
        url: validated.url,
        events: validated.events,
        secret,
        enabled: validated.enabled ?? true,
      })
      .returning();

    return NextResponse.json(newWebhook, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Error creating webhook:', error);
    return NextResponse.json(
      { message: 'Failed to create webhook' },
      { status: 500 }
    );
  }
}
