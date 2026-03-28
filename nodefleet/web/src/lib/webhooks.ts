import { createHmac } from 'crypto';
import { db } from './db';
import { webhooks } from './db/schema';
import { eq, and } from 'drizzle-orm';

export async function triggerWebhooks(
  orgId: string,
  event: string,
  payload: object
): Promise<void> {
  try {
    // Query all enabled webhooks for this org
    const orgWebhooks = await db
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.orgId, orgId), eq(webhooks.enabled, true)));

    // Filter webhooks that include this event
    const matchingWebhooks = orgWebhooks.filter((wh) => {
      const events = wh.events as string[];
      return Array.isArray(events) && events.includes(event);
    });

    // Fire-and-forget: don't await all, just kick off requests
    for (const wh of matchingWebhooks) {
      fireWebhook(wh.id, wh.url, wh.secret, event, payload).catch((err) => {
        console.error(`Webhook ${wh.id} failed:`, err);
      });
    }
  } catch (error) {
    console.error('Error triggering webhooks:', error);
  }
}

async function fireWebhook(
  webhookId: string,
  url: string,
  secret: string,
  event: string,
  payload: object
): Promise<void> {
  const body = JSON.stringify({
    event,
    payload,
    timestamp: new Date().toISOString(),
  });

  // Create HMAC-SHA256 signature
  const signature = createHmac('sha256', secret).update(body).digest('hex');

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-NodeFleet-Signature': signature,
      },
      body,
    });

    // Update lastTriggeredAt
    await db
      .update(webhooks)
      .set({ lastTriggeredAt: new Date() })
      .where(eq(webhooks.id, webhookId));
  } catch (error) {
    console.error(`Failed to POST webhook ${webhookId} to ${url}:`, error);
  }
}
