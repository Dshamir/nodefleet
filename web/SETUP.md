# NodeFleet Web - Setup Guide

This is the Next.js 14 web application for NodeFleet, a device fleet management SaaS platform.

## Project Structure

```
nodefleet/web/
├── src/
│   ├── lib/
│   │   ├── auth.ts              # NextAuth v5 configuration
│   │   ├── db.ts                # Drizzle ORM database client
│   │   ├── schema.ts            # Database schema definitions
│   │   ├── s3.ts                # MinIO S3 operations
│   │   ├── redis.ts             # Redis client & pub/sub
│   │   ├── stripe.ts            # Stripe client & payment plans
│   │   └── utils.ts             # Utility functions
│   ├── middleware.ts            # NextAuth middleware for route protection
│   ├── app/
│   │   ├── (auth)/              # Authentication pages
│   │   ├── (dashboard)/         # Protected dashboard routes
│   │   └── api/                 # API routes
│   └── components/              # React components
├── package.json                 # Dependencies
├── tsconfig.json                # TypeScript configuration
├── next.config.js               # Next.js configuration
├── tailwind.config.ts           # Tailwind CSS configuration
├── postcss.config.js            # PostCSS configuration
├── .eslintrc.json               # ESLint configuration
├── .env.example                 # Environment variables template
└── .gitignore                   # Git ignore rules
```

## Core Files Created

### 1. Configuration Files

#### `package.json`
- Next.js 14 with React 18.3
- NextAuth v5 with Credentials provider
- Database: Drizzle ORM + PostgreSQL
- Storage: AWS S3 / MinIO
- Redis for caching and pub/sub
- Stripe for payments
- Tailwind CSS + Radix UI components
- Charting with Recharts
- Date utilities with date-fns

#### `tsconfig.json`
- Strict TypeScript mode enabled
- Path alias: `@/*` for `src/*`
- Target: ES2020

#### `next.config.js`
- Output: standalone (production-ready)
- Image remote patterns for MinIO

#### `tailwind.config.ts`
- CSS variables for theming
- Radix UI compatible color system

#### `postcss.config.js`
- Tailwind CSS + Autoprefixer

### 2. Authentication (`src/lib/auth.ts`)

- **Provider**: NextAuth v5 Credentials
- **Strategy**: JWT sessions
- **Features**:
  - Email + password authentication
  - Password hashing with bcryptjs
  - DrizzleAdapter for session persistence
  - JWT callbacks that include userId, orgId, role in tokens/sessions
  - Session refresh support
  - Protected auth pages (/login, /register)

### 3. Database (`src/lib/db.ts` + `src/lib/schema.ts`)

- **ORM**: Drizzle ORM with PostgreSQL
- **Tables**:
  - `users` - User accounts
  - `organizations` - Tenant organizations
  - `organization_memberships` - User org roles
  - `devices` - IoT devices
  - `device_groups` - Device grouping
  - `locations` - Device locations with GPS
  - `device_metrics` - Time-series metrics
  - `alerts` - Device alerts
  - `api_keys` - API authentication
  - `file_uploads` - S3 file tracking
  - `audit_logs` - Activity logging

- **Features**:
  - Full relationships with cascading deletes
  - Indexes for performance
  - Timestamps (createdAt, updatedAt)
  - JSONB for flexible data
  - Decimal for precise numbers (GPS, temps)

### 4. Storage (`src/lib/s3.ts`)

- **Client**: AWS SDK v3 S3Client
- **Configuration**: MinIO compatible (forcePathStyle: true)
- **Functions**:
  - `uploadFile(key, body, contentType)` - Upload to S3
  - `getPresignedUrl(key, expiresIn)` - Generate download URL
  - `getPresignedUploadUrl(key, contentType, expiresIn)` - Generate upload URL
  - `deleteFile(key)` - Remove from S3

### 5. Caching (`src/lib/redis.ts`)

- **Client**: ioredis with connection pooling
- **Features**:
  - Pub/Sub for real-time updates
  - Cache operations with TTL
  - Connection event handlers
  - Pattern-based cache clearing

### 6. Payments (`src/lib/stripe.ts`)

- **Payment Plans**:
  - **Free**: 3 devices, 1 GB
  - **Pro**: $19.99/mo, 25 devices, 50 GB
  - **Team**: $49.99/mo, 100 devices, 500 GB
  - **Enterprise**: Custom (unlimited)

- **Functions**:
  - Create/update/cancel subscriptions
  - Customer management
  - Price formatting

### 7. Utilities (`src/lib/utils.ts`)

- `cn()` - Merge Tailwind classes
- `formatDate()` - Format dates
- `formatBytes()` - Format file sizes
- `generatePairingCode()` - 6-char alphanumeric
- `generateId()` - UUID generation
- `slugify()` - URL-safe slugs
- `validateEmail()` - Email validation
- `truncate()` - Text truncation
- `parseJSON()` - Safe JSON parsing
- `delay()` - Promise delay
- `retry()` - Exponential backoff retry
- `debounce()` / `throttle()` - Rate limiting
- `capitalize()` - String capitalization
- `pluralize()` - Plural handling
- `range()` - Number ranges
- `getInitials()` - Avatar initials
- `getStatusColor()` - Status styling

### 8. Middleware (`src/middleware.ts`)

- **Protected Routes**: `/dashboard/*`, `/api/protected/*`
- **Public Routes**: `/login`, `/register`, `/forgot-password`, `/api/auth/*`
- **Behavior**:
  - Redirects unauthenticated users to /login
  - Preserves callbackUrl for post-auth redirect
  - Redirects already-authenticated users away from login/register

## Environment Variables

Create `.env.local` from `.env.example`:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/nodefleet

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=min-32-chars-random-secret

# S3 / MinIO
S3_ENDPOINT=http://minio:9000
S3_BUCKET=nodefleet
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin

# Redis
REDIS_URL=redis://localhost:6379

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_TEAM_MONTHLY=price_...
```

## Installation & Running

```bash
# Install dependencies
npm install

# Generate database migrations
npm run db:generate

# Push schema to database
npm run db:push

# Run development server
npm run dev

# Open http://localhost:3000
```

## Key Features

### Authentication
- Email + password login/registration
- Session-based with JWT tokens
- User roles: owner, admin, member, viewer
- Organization multi-tenancy

### Device Management
- Device pairing codes (6 alphanumeric)
- Real-time status tracking (online/offline/error)
- GPS location tracking
- Device grouping and locations
- Firmware versioning

### Monitoring
- Time-series metrics (CPU, memory, disk, network)
- Alert system with severity levels
- Status tracking (open, acknowledged, resolved)
- Customizable alert rules

### File Management
- S3/MinIO integration
- Presigned URLs for secure uploads/downloads
- File lifecycle management

### Billing
- Stripe payment processing
- Device and storage quotas
- Plan upgrades with proration
- Subscription management

### Audit & Security
- API key management
- Audit logs for all actions
- Rate limiting support
- Input validation with Zod

## Database Seeding

To seed initial data, create a migration or use a seed script:

```typescript
import { db } from './src/lib/db'
import { users, organizations } from './src/lib/schema'

async function seed() {
  // Create test user
  const user = await db.insert(users).values({
    email: 'test@example.com',
    password: await bcrypt.hash('password123', 10),
    name: 'Test User',
  }).returning()

  // Create organization
  const org = await db.insert(organizations).values({
    name: 'Test Org',
    slug: 'test-org',
  }).returning()
}

seed()
```

## Deployment

The application is configured for production deployment with:
- Standalone output (no Node.js installation required in container)
- Minified JavaScript
- Source maps for debugging
- Environment-based configuration

### Docker

```dockerfile
FROM node:18-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY .next/standalone ./
COPY public ./public
COPY .next/static ./.next/static

EXPOSE 3000
ENV NODE_ENV production
CMD ["node", "server.js"]
```

## Next Steps

1. Set up PostgreSQL database
2. Configure MinIO/S3 storage
3. Set up Redis cache
4. Configure Stripe API keys
5. Create auth pages and dashboard components
6. Implement API routes for device management
7. Build real-time features with WebSockets
8. Set up monitoring and logging

## Type Safety

All files use strict TypeScript with:
- No implicit any
- No unused variables
- Full type coverage for functions
- Auth types extended for custom fields
- Database schema validation

## Development

```bash
# Format code
npm run lint

# Type check
npx tsc --noEmit

# Watch mode
npm run dev

# Database studio (Drizzle UI)
npm run db:studio
```
