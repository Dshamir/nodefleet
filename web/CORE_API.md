# NodeFleet Web - Core API Reference

Complete reference for all exported functions and types from core library files.

## Authentication (`src/lib/auth.ts`)

### Exports
- `authConfig` - NextAuth configuration object
- `handlers` - NextAuth route handlers
- `auth()` - Get session in server components
- `signIn()` - Redirect to sign in
- `signOut()` - Invalidate session

### Types Extended
```typescript
// User type
interface User {
  id: string
  email: string
  name?: string | null
  image?: string | null
}

// Session type (with custom fields)
interface Session {
  user: User & {
    orgId?: string
    role?: string
  }
}

// JWT token type
interface JWT {
  id: string
  email: string
  name?: string | null
  image?: string | null
  orgId?: string
  role?: string
}
```

### Features
- Credentials provider (email + password)
- JWT session strategy (30-day expiry)
- DrizzleAdapter for persistence
- Automatic org/role injection
- Callback customization

## Database (`src/lib/db.ts` + `src/lib/schema.ts`)

### Database Client
```typescript
export const db: Database // Drizzle ORM instance
```

### Tables & Relations
| Table | Key Fields | Relations |
|-------|-----------|-----------|
| `users` | id, email, password | memberships, fileUploads, auditLogs |
| `organizations` | id, name, slug | memberships, devices, groups, locations, alerts, etc |
| `organization_memberships` | id, organizationId, userId, role | org, user |
| `devices` | id, serialNumber, status, pairingCode | org, metrics, alerts, fileUploads |
| `device_groups` | id, organizationId, name | org, devices |
| `locations` | id, organizationId, address | org, devices |
| `device_metrics` | id, deviceId, cpuUsage, memoryUsage | device |
| `alerts` | id, organizationId, deviceId, severity, status | org, device |
| `api_keys` | id, organizationId, key, secret | org |
| `file_uploads` | id, s3Key, uploadedBy | org, device, user |
| `audit_logs` | id, organizationId, userId, action | org, user |

### Schema Features
- UUID primary keys
- Timestamps (createdAt, updatedAt)
- Cascading deletes
- Unique constraints
- Performance indexes
- JSONB for flexible data
- Decimal precision for GPS/temps
- Enum types for statuses

## Storage (`src/lib/s3.ts`)

### Functions

#### `uploadFile(key: string, body: Buffer | string, contentType: string): Promise<string>`
Upload file to S3/MinIO, returns public URL.

#### `getPresignedUrl(key: string, expiresIn?: number): Promise<string>`
Generate time-limited download URL (default 1 hour).

#### `getPresignedUploadUrl(key: string, contentType: string, expiresIn?: number): Promise<string>`
Generate time-limited upload URL for client-side uploads.

#### `deleteFile(key: string): Promise<void>`
Delete file from S3/MinIO.

### Configuration
- Endpoint: `S3_ENDPOINT` env (e.g., http://minio:9000)
- Bucket: `S3_BUCKET` env (default: nodefleet)
- Credentials: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- ForcePathStyle: true (MinIO compatible)

## Caching (`src/lib/redis.ts`)

### Functions

#### `publishEvent(channel: string, data: unknown): Promise<number>`
Publish JSON data to Redis channel, returns subscriber count.

#### `subscribeToChannel(channel: string, callback: (data: unknown) => void): Promise<void>`
Subscribe to channel and handle incoming messages.

#### `unsubscribeFromChannel(channel: string): Promise<void>`
Unsubscribe from channel.

#### `setCacheValue(key: string, value: unknown, ttlSeconds?: number): Promise<void>`
Store value with optional expiration.

#### `getCacheValue(key: string): Promise<unknown | null>`
Retrieve cached value.

#### `deleteCacheValue(key: string): Promise<void>`
Remove cached value.

#### `clearCache(pattern: string): Promise<void>`
Delete all keys matching pattern (e.g., "user:*").

### Exports
```typescript
export const redis: Redis  // ioredis instance
export const pubsub: Redis // Duplicate for pub/sub
```

## Payments (`src/lib/stripe.ts`)

### Plans Configuration
```typescript
interface PlanConfig {
  id: string           // free, pro, team, enterprise
  name: string
  displayName: string
  price: number        // in cents
  currency: string
  billingInterval: 'month' | 'year'
  devices: number
  storage: number      // in GB
  stripePriceId?: string
  features: string[]
}

export const PLANS: Record<string, PlanConfig>
```

### Plan Details
| Plan | Price | Devices | Storage | Features |
|------|-------|---------|---------|----------|
| Free | $0 | 3 | 1 GB | Basic monitoring |
| Pro | $19.99/mo | 25 | 50 GB | Advanced monitoring, alerts |
| Team | $49.99/mo | 100 | 500 GB | Real-time, 24/7 support |
| Enterprise | Custom | Unlimited | Unlimited | White-label, dedicated |

### Functions

#### `createSubscription(customerId: string, priceId: string, metadata?: Record<string, string>): Promise<Subscription>`
Create Stripe subscription.

#### `updateSubscription(subscriptionId: string, priceId: string): Promise<Subscription>`
Change subscription plan with proration.

#### `cancelSubscription(subscriptionId: string, immediately?: boolean): Promise<Subscription>`
Cancel at end of period or immediately.

#### `createCustomer(email: string, metadata?: Record<string, string>): Promise<Customer>`
Create Stripe customer.

#### `updateCustomer(customerId: string, metadata?: Record<string, string>): Promise<Customer>`
Update customer metadata.

#### `retrieveCustomer(customerId: string): Promise<Customer>`
Get customer details.

#### `retrieveSubscription(subscriptionId: string): Promise<Subscription>`
Get subscription with expanded price info.

#### `getPlanFromPrice(priceId: string): PlanConfig | undefined`
Get plan config from Stripe price ID.

#### `formatPrice(price: number, currency?: string): string`
Format price for display (e.g., "$19.99").

## Utilities (`src/lib/utils.ts`)

### Class & Style Utilities

#### `cn(...inputs: ClassValue[]): string`
Merge Tailwind classes with conflict resolution.

### Date/Time

#### `formatDate(date: Date | string, formatStr?: string): string`
Format date (default: "MMM d, yyyy").

#### `formatDateRelative(date: Date | string): string`
Format as relative time ("2 hours ago").

### Size Formatting

#### `formatBytes(bytes: number, decimals?: number): string`
Convert bytes to human-readable (1024 MB, 1.5 GB, etc).

### ID & Code Generation

#### `generatePairingCode(length?: number): string`
Generate random alphanumeric code (default 6 chars).

#### `generateId(): string`
Generate UUID v4.

### Text Processing

#### `slugify(text: string): string`
Convert to URL-safe slug ("hello world" → "hello-world").

#### `validateEmail(email: string): boolean`
Validate email format.

#### `truncate(text: string, length?: number): string`
Truncate with ellipsis (default 50 chars).

#### `capitalize(text: string): string`
Capitalize first letter.

#### `pluralize(word: string, count: number): string`
Return plural if count !== 1.

#### `getInitials(name: string): string`
Extract initials for avatars ("John Doe" → "JD").

### Data Processing

#### `parseJSON<T>(json: string | null): T | null`
Safe JSON parsing with error handling.

#### `safeJsonStringify(obj: unknown, indent?: number): string`
Safe JSON stringification.

### Async Utilities

#### `delay(ms: number): Promise<void>`
Promise-based delay.

#### `retry<T>(fn: () => Promise<T>, retries?: number, delayMs?: number): Promise<T>`
Exponential backoff retry (default: 3 retries, doubling delay).

#### `debounce<T>(fn: T, delayMs: number): (...args: Parameters<T>) => void`
Debounce function calls.

#### `throttle<T>(fn: T, delayMs: number): (...args: Parameters<T>) => void`
Throttle function calls.

### Number Utilities

#### `range(start: number, end: number, step?: number): number[]`
Generate number array.

#### `randomBetween(min: number, max: number): number`
Random integer in range (inclusive).

### UI Utilities

#### `isDarkMode(): boolean`
Check if dark mode preference is enabled.

#### `getStatusColor(status: string): string`
Return Tailwind class for status (active, inactive, pending, error, warning).

## Middleware (`src/middleware.ts`)

### Route Protection
- **Protected**: `/dashboard/*`, `/api/protected/*`
- **Public**: `/login`, `/register`, `/forgot-password`, `/api/auth/*`
- **Default**: Unrestricted access

### Behavior
1. Unauthenticated users → redirect to `/login?callbackUrl=/original`
2. Already authenticated → redirect away from login/register to `/dashboard`
3. All other routes → pass through

### Configuration
```typescript
export const config = {
  matcher: [
    // Matches everything except static files, images, favicon
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
```

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=min-32-random-chars

# S3/MinIO
S3_ENDPOINT=http://minio:9000
S3_BUCKET=nodefleet
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Redis
REDIS_URL=redis://localhost:6379

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_TEAM_MONTHLY=price_...

# Optional
NODE_ENV=development
SMTP_HOST=...
SENTRY_DSN=...
```

## Type Safety

All code is **strict TypeScript** with:
- `noImplicitAny: true`
- `strictNullChecks: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noImplicitReturns: true`

## Testing

Recommended test patterns:

```typescript
// Auth
import { auth } from '@/lib/auth'
const session = await auth()

// Database
import { db } from '@/lib/db'
const users = await db.query.users.findMany()

// Storage
import { uploadFile, getPresignedUrl } from '@/lib/s3'
const url = await uploadFile('key', buffer, 'image/png')

// Cache
import { getCacheValue, setCacheValue } from '@/lib/redis'
await setCacheValue('key', data, 3600)

// Payments
import { PLANS, createSubscription } from '@/lib/stripe'
const plan = PLANS.pro

// Utils
import { cn, formatBytes, generatePairingCode } from '@/lib/utils'
cn('px-2', 'px-4') // → 'px-4'
```
