import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-11-20",
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    // Handle checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.metadata?.orgId) {
        const orgId = session.metadata.orgId;
        const subscriptionId = session.subscription as string;

        // Update organization with subscription info
        await db
          .update(organizations)
          .set({
            stripeSubscriptionId: subscriptionId,
            stripePlan: session.metadata.plan || "pro",
            stripeCustomerId: session.customer as string,
          })
          .where(eq(organizations.id, orgId));
      }
    }

    // Handle customer.subscription.updated
    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      // Find organization by Stripe customer ID
      const org = await db
        .select()
        .from(organizations)
        .where(eq(organizations.stripeCustomerId, customerId))
        .limit(1);

      if (org && org.length > 0) {
        const planId = subscription.items.data[0]?.price.id || "";
        const plan = determinePlanFromPriceId(planId);

        await db
          .update(organizations)
          .set({
            stripePlan: plan,
            stripeSubscriptionId: subscription.id,
          })
          .where(eq(organizations.id, org[0].id));
      }
    }

    // Handle customer.subscription.deleted
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      // Find organization by Stripe customer ID
      const org = await db
        .select()
        .from(organizations)
        .where(eq(organizations.stripeCustomerId, customerId))
        .limit(1);

      if (org && org.length > 0) {
        // Reset organization subscription info
        await db
          .update(organizations)
          .set({
            stripeSubscriptionId: null,
            stripePlan: "free",
          })
          .where(eq(organizations.id, org[0].id));
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

function determinePlanFromPriceId(priceId: string): string {
  // Map Stripe price IDs to plan names
  // This should match your Stripe price configuration
  const priceIdMap: Record<string, string> = {
    [process.env.STRIPE_PRICE_ID_PRO || ""]: "pro",
    [process.env.STRIPE_PRICE_ID_BUSINESS || ""]: "business",
  };

  return priceIdMap[priceId] || "free";
}
