import { createHmac } from 'crypto';
import { db } from './db';
import { webhooks } from './db/schema';
import { eq, and } from 'drizzle-orm';
import { createLogger } from './logger';

const logger = createLogger('webhooks');

/**
 * Triggers all matching webhooks for an organization and event type.
 * Queries enabled webhooks whose event list includes the specified event,
 * then fires each in a fire-and-forget manner (errors are logged, not thrown).
 * @param orgId - Organization ID that owns the webhooks
 * @param event - Event name to match (e.g. `"device.created"`, `"fleet.updated"`)
 * @param payload - Event payload object to deliver in the webhook body
 */
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
        logger.error(`Webhook ${wh.id} failed`, { error: String(err) });
      });
    }
  } catch (error) {
    logger.error('Error triggering webhooks', { error: String(error) });
  }
}

/**
 * Sends a single webhook HTTP POST request with HMAC-SHA256 signature.
 * The request body includes the event name, payload, and ISO timestamp.
 * The signature is sent in the `X-NodeFleet-Signature` header so
 * receivers can verify payload authenticity.
 * Updates `lastTriggeredAt` on the webhook record after delivery.
 * @param webhookId - Database ID of the webhook record
 * @param url - Target URL to POST the webhook to
 * @param secret - HMAC secret used to sign the payload
 * @param event - Event name being delivered
 * @param payload - Event payload object
 */
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
    logger.error(`Failed to POST webhook ${webhookId} to ${url}`, { error: String(error) });
  }
}
