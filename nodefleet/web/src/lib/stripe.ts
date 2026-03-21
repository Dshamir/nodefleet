import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-04-10',
})

export interface PlanConfig {
  id: string
  name: string
  displayName: string
  price: number
  currency: string
  billingInterval: 'month' | 'year'
  devices: number
  storage: number // in GB
  stripePriceId?: string
  features: string[]
}

export const PLANS: Record<string, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    displayName: 'Free',
    price: 0,
    currency: 'USD',
    billingInterval: 'month',
    devices: 3,
    storage: 1,
    features: [
      'Up to 3 devices',
      '1 GB storage',
      'Basic monitoring',
      'Email support',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    displayName: 'Pro',
    price: 1999, // $19.99 in cents
    currency: 'USD',
    billingInterval: 'month',
    devices: 25,
    storage: 50,
    stripePriceId: process.env.STRIPE_PRICE_PRO_MONTHLY,
    features: [
      'Up to 25 devices',
      '50 GB storage',
      'Advanced monitoring',
      'Priority email support',
      'Device groups',
      'Custom alerts',
    ],
  },
  team: {
    id: 'team',
    name: 'Team',
    displayName: 'Team',
    price: 4999, // $49.99 in cents
    currency: 'USD',
    billingInterval: 'month',
    devices: 100,
    storage: 500,
    stripePriceId: process.env.STRIPE_PRICE_TEAM_MONTHLY,
    features: [
      'Up to 100 devices',
      '500 GB storage',
      'Real-time monitoring',
      '24/7 phone & email support',
      'Advanced device groups',
      'Custom alerts & webhooks',
      'Team management',
      'Audit logs',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    displayName: 'Enterprise',
    price: 0,
    currency: 'USD',
    billingInterval: 'month',
    devices: 99999,
    storage: 99999,
    features: [
      'Unlimited devices',
      'Unlimited storage',
      'Custom SLA',
      'Dedicated account manager',
      'White-label options',
      'API access',
      'Custom integrations',
      'On-premise deployment available',
    ],
  },
}

export async function createSubscription(
  customerId: string,
  priceId: string,
  metadata?: Record<string, string>
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    metadata,
  })
}

export async function updateSubscription(
  subscriptionId: string,
  priceId: string
): Promise<Stripe.Subscription> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  return stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: priceId,
      },
    ],
    proration_behavior: 'create_prorations',
  })
}

export async function cancelSubscription(
  subscriptionId: string,
  immediately = false
): Promise<Stripe.Subscription> {
  if (immediately) {
    return stripe.subscriptions.del(subscriptionId)
  }

  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  })
}

export async function createCustomer(
  email: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  return stripe.customers.create({
    email,
    metadata,
  })
}

export async function updateCustomer(
  customerId: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  return stripe.customers.update(customerId, {
    metadata,
  })
}

export async function retrieveCustomer(customerId: string): Promise<Stripe.Customer> {
  return stripe.customers.retrieve(customerId)
}

export async function retrieveSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  })
}

export function getPlanFromPrice(priceId: string): PlanConfig | undefined {
  return Object.values(PLANS).find((plan) => plan.stripePriceId === priceId)
}

export function formatPrice(price: number, currency: string = 'USD'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  })

  return formatter.format(price / 100)
}
