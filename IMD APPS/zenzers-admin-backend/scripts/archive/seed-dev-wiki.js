#!/usr/bin/env node

/**
 * Seed script for Developer Wiki pages.
 *
 * Populates the devWikiPages collection with comprehensive platform
 * documentation covering architecture, security, guides, deployment,
 * and troubleshooting.
 *
 * Idempotent: upserts on `slug` field. Safe to run multiple times.
 *
 * Usage (docker compose):
 *   docker compose run --rm \
 *     -v "$PWD/backend/scripts:/app/scripts" \
 *     backend node /app/scripts/seed-dev-wiki.js
 *
 * Usage (host):
 *   DATABASE_URL=mongodb://mongoadmin:...@localhost/mediastore?authSource=admin \
 *   node backend/scripts/seed-dev-wiki.js
 */

const { MongoClient } = require("mongodb");

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "mongodb://mongoadmin:R48kBvqJb3E5tvzWdcbbc5GkMen7sSVqEgd2Jpvc@mongodb/mediastore?authSource=admin";

const AUTHOR = "dshamir@blucap.ca";
const now = new Date();

// ─── Wiki Pages ──────────────────────────────────────────────────────────────

const PAGES = [

  // ═══════════════════════════════════════════════════════════════════════════
  // GETTING STARTED
  // ═══════════════════════════════════════════════════════════════════════════

  {
    title: "Quick Start Guide",
    slug: "quick-start-guide",
    section: "getting-started",
    sortOrder: 1,
    tags: ["getting-started", "setup", "dev.sh", "docker"],
    body: `# Quick Start Guide

## Prerequisites

- Docker Desktop with Docker Compose v2
- NVIDIA GPU drivers + NVIDIA Container Toolkit (for AI workers)
- Node.js 22+ (for running scripts from host)
- Git

## First Run

\`\`\`bash
# Clone and enter the project
cd /path/to/Exp_dental

# Copy environment file
cp .env.example .env
# Edit .env with your NGROK_AUTHTOKEN and other secrets

# Build and start all 24 services
./dev.sh
\`\`\`

\`dev.sh\` is the single-command orchestrator that:
1. Reads version info from \`version.txt\` and Git metadata
2. Builds backend + admin-console images (with version build-args)
3. Starts all services via \`docker compose up -d\`
4. Waits for backend health check
5. Displays the 24-service status dashboard

## Verify Services

\`\`\`bash
# Check all service health endpoints
./dev.sh health

# Show the full status dashboard
./dev.sh --status
\`\`\`

## Fast Iteration Workflow

After the initial build, use \`rebuild\` for rapid iteration on a single service:

\`\`\`bash
# Hot-rebuild only the backend (keeps other 23 containers running)
./dev.sh rebuild backend

# Rebuild multiple services at once
./dev.sh rebuild backend admin-console
\`\`\`

## Access Points

| Service | URL | Auth |
|---------|-----|------|
| Frontend (patient app) | https://dental.ngrok.dev | Keycloak login |
| Admin Console | https://dental.ngrok.dev/admin | Custom JWT auth (Keycloak OIDC backend) |
| Backend API | https://dental.ngrok.dev/api | JWT Bearer token |
| Keycloak Admin | https://dental.ngrok.dev/auth/admin | Keycloak admin creds |
| Flower (Celery monitor) | https://dental.ngrok.dev/flower | Basic auth |
| Dozzle (container logs) | https://dental.ngrok.dev/dozzle | Basic auth |
| MinIO Console | http://localhost:39001 | MinIO root creds |
| Drydock API | https://dental.ngrok.dev/api/drydock | Internal passkey |
| Local Nginx (direct) | http://localhost:8888 | Same as above |

## Seed Scripts

After first run, populate initial data:

\`\`\`bash
# Seed platform credentials into vault
docker compose run --rm backend node /app/scripts/seed-credentials.js

# Seed admin data (wiki pages, settings, etc.)
docker compose run --rm backend node /app/scripts/seed-admin-data.js

# Seed 41 platform audit tickets
docker compose run --rm \\
  -v "$PWD/review_dental_dev:/review_data" \\
  backend node /app/scripts/seed-audit-tickets.js

# Seed developer wiki documentation
docker compose run --rm backend node /app/scripts/seed-dev-wiki.js
\`\`\`

## Stopping

\`\`\`bash
./dev.sh down              # Stop all containers (volumes preserved)
docker compose down -v     # Stop + remove volumes (full reset)
\`\`\`
`,
  },

  {
    title: "Project Structure & Conventions",
    slug: "project-structure",
    section: "getting-started",
    sortOrder: 2,
    tags: ["getting-started", "structure", "conventions", "directories"],
    body: `# Project Structure & Conventions

## Key Directories

| Directory | Purpose |
|-----------|---------|
| \`backend/\` | Express.js API — 16+ route files, 20+ services, Zod schemas |
| \`backend/src/routes/admin/\` | Admin console API endpoints (support, wiki, credentials, etc.) |
| \`backend/src/schemas/\` | 95 Zod validation schemas for admin APIs |
| \`backend/src/middleware/\` | tenant-scope, authorize (ABAC), rate limiting |
| \`backend/src/migrations/\` | MongoDB migration runner + migration files |
| \`backend/prisma/\` | Prisma schema for PostgreSQL (Tenant, Subscription, AuditLog) |
| \`backend/scripts/\` | Standalone seed and utility scripts |
| \`front-end/\` | React 19 SPA (~40+ components) — patient-facing app |
| \`front-end/tests/e2e/\` | Playwright E2E test suite |
| \`admin-console/\` | React admin SPA — 55 admin modules |
| \`worker/\` | Python Celery workers (segmentation, crown gen, decimation, margin line) |
| \`engines/\` | AI engine Docker containers (11 total: 8 real + 3 mock) |
| \`k8s/\` | Helm charts (13 templates) + environment overrides |
| \`nginx/\` | Nginx config (dynamic DNS, reverse proxy) |
| \`mongodb/\` | MongoDB init scripts |
| \`scripts/\` | Project-level scripts (seed-admin-data.js) |
| \`docs/operator-manual/\` | Operations documentation |
| \`evaluate/\` | Satellite repositories (local only, NOT in git) |
| \`Reconnaissance-Planning/\` | Forensic audit documents |

## Version Info

- **Version:** 0.9.174 (pre-release)
- **Active Branch:** \`poly_updates\`
- **Main Branch:** \`master\`

## Coding Conventions

- **Commit messages:** Imperative mood, concise (e.g., "Add tenant-scope middleware")
- **Backend:** Mixed JS/TS — new files in TypeScript, legacy in JavaScript
- **Frontend:** TypeScript + React 19 functional components
- **Validation:** Zod schemas for all admin API inputs (95 schemas)
- **Auth:** All admin routes require \`requirePlatformOperator\` middleware
- **Soft deletes:** Most collections use \`deleted: boolean\` + \`deletedAt: Date\`
- **Audit trail:** State-changing operations produce audit log entries

## Database Conventions

- **MongoDB:** Primary data store — projects, users, settings, tickets, wiki
- **PostgreSQL:** Tenant management — subscriptions, billing, audit logs (via Prisma)
- **Redis:** Caching, rate limiting, session store
- **MinIO:** Object storage for scan files (S3-compatible)
- **GridFS:** File attachments within MongoDB (bucket: \`main\`)
`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ARCHITECTURE
  // ═══════════════════════════════════════════════════════════════════════════

  {
    title: "Service Map — 24 Services",
    slug: "service-map",
    section: "architecture",
    sortOrder: 1,
    tags: ["architecture", "services", "docker", "infrastructure"],
    body: `# Service Map — 24 Services

The platform runs 24 containerized services orchestrated by Docker Compose.

## Core Application

| Service | Technology | Purpose |
|---------|-----------|---------|
| **backend** | Node.js 22 + Express | REST API server (port 3001 internal) |
| **frontend** | React 19 + Vite 7 | Patient-facing SPA (port 3000 internal) |
| **admin-console** | React + PrimeReact + MUI | Admin SPA — 55 management modules (port 3000 internal) |
| **nginx** | Nginx | Reverse proxy, SSL termination, routing (port 80/8888) |
| **ngrok** | ngrok | HTTPS tunnel to nginx (dental.ngrok.dev) |

## Data Layer

| Service | Technology | Purpose |
|---------|-----------|---------|
| **mongodb** | MongoDB 7 | Primary document store — projects, users, tickets, wiki |
| **postgres** | PostgreSQL 16 | Relational store — tenants, subscriptions, audit (Prisma) |
| **redis** | Redis 7 | Caching, rate limits, session store, Celery result backend |
| **minio** | MinIO | S3-compatible object storage for scan files |

## AI Pipeline

| Service | Technology | Purpose |
|---------|-----------|---------|
| **worker_segmentation** | Python/Celery | Tooth segmentation job processor |
| **worker_crown_generation** | Python/Celery | Crown generation job processor |
| **worker_decimation** (x5) | Python/Celery | Mesh decimation (5 replicas for throughput) |
| **worker_marginline** | Python/Celery | Margin line detection job processor |
| **rabbitmq** | RabbitMQ 3 | Message queue for job dispatch |
| **flower** | Flower | Celery monitoring dashboard |
| **drydock-api** | FastAPI (Python) | 3D mesh analysis API |

## Auth & Identity

| Service | Technology | Purpose |
|---------|-----------|---------|
| **keycloak** | Keycloak 24 | OIDC identity provider, SSO, realm management |

## Monitoring & Tools

| Service | Technology | Purpose |
|---------|-----------|---------|
| **dozzle** | Dozzle | Real-time container log viewer |
| **undercut-detection** | Custom (Python) | Dental undercut analysis engine |
| **thickness-interactive** | Dash (Python) | Interactive thickness visualization |

## Network Topology

\`\`\`
Internet → ngrok (HTTPS) → nginx:80
                              ├── /           → frontend:3000
                              ├── /admin      → admin-console:3000
                              ├── /api        → backend:3001
                              ├── /auth       → keycloak:8080
                              ├── /flower     → flower:5555
                              ├── /dozzle     → dozzle:8080
                              ├── /undercut   → undercut-detection:8050
                              ├── /thickness  → thickness-interactive:8050
                              └── /api/drydock → drydock-api:8002
\`\`\`

## Worker → Engine Flow

Workers use Docker-in-Docker to launch GPU engine containers:

\`\`\`
RabbitMQ → Worker (Celery) → Docker Socket → GPU Engine Container
                                                    ↓
                                              Process scan file
                                                    ↓
                                              Store result → MinIO
\`\`\`

> **Known Risk:** Workers mount \`/var/run/docker.sock\` (CVSS 9.0).
> Phase 5 will migrate to Kubernetes Jobs API to eliminate this.
`,
  },

  {
    title: "AI Pipeline Architecture",
    slug: "ai-pipeline-architecture",
    section: "architecture",
    sortOrder: 2,
    tags: ["architecture", "ai", "workers", "engines", "pipeline"],
    body: `# AI Pipeline Architecture

## Overview

The AI pipeline processes dental 3D scans (STL/PLY) through a chain of operations: decimation → segmentation → margin line detection → crown generation.

## Components

### 1. Job Dispatch (Backend → RabbitMQ)

When a user uploads a scan, the backend:
1. Stores the file in MinIO
2. Creates a project record in MongoDB
3. Publishes a job message to the appropriate RabbitMQ queue

**Queues:**
- \`mesh_decimation\` — reduce polygon count for processing
- \`mesh_segmentation\` — identify individual teeth
- \`margin_line\` — detect preparation margins
- \`crown_generation\` — generate crown geometry

### 2. Workers (Python/Celery)

Four worker types consume from their respective queues:

| Worker | Queue | Replicas | GPU | Timeout |
|--------|-------|----------|-----|---------|
| worker_decimation | mesh_decimation | 5 | No | Default |
| worker_segmentation | mesh_segmentation | 1 | Yes | 300s |
| worker_marginline | margin_line | 1 | Yes | 300s |
| worker_crown_generation | crown_generation | 1 | Yes | 1200s |

### 3. GPU Engine Containers

Workers launch ephemeral Docker containers with GPU access:

\`\`\`
Worker receives job from RabbitMQ
  → Downloads scan file from MinIO via backend API
  → Creates a Docker container with GPU access
  → Mounts work volume with scan data
  → Engine processes the scan
  → Worker reads results from work volume
  → Uploads results to MinIO via backend API
  → Publishes completion event
\`\`\`

### 4. Engine Images (11 total)

| Engine | Type | Purpose |
|--------|------|---------|
| arch-segmentation | Real | Tooth segmentation neural network |
| crown-generation | Real | Crown shape generation |
| crown-generation_adapointr_sap | Real | AdaPoinTr-based crown generation |
| marginlinev2 | Real | Margin line detection v2 |
| + 4 more real engines | Real | Specialized processing |
| + 3 mock engines | Mock | Development/testing stubs |

### 5. Result Backend (Redis)

Celery uses Redis (db 1) as the result backend. Job status and results are stored with TTL for frontend polling.

### 6. Monitoring (Flower)

Flower provides real-time visibility into:
- Active/completed/failed tasks per worker
- Task execution times and retry counts
- Worker resource utilization
- Queue depths

**Access:** https://dental.ngrok.dev/flower (basic auth)

## Drydock Analysis API

Separate FastAPI service for 3D mesh analysis:
- 16 Three.js analysis modules (in dental-drydock-web, pending integration)
- Proxied through nginx at \`/api/drydock/\`
- Health check: \`/api/v1/health\`
- Uses Redis db 2 for caching
`,
  },

  {
    title: "Multi-Tenancy & Authorization",
    slug: "multi-tenancy-auth",
    section: "architecture",
    sortOrder: 3,
    tags: ["architecture", "multi-tenancy", "auth", "keycloak", "abac"],
    body: `# Multi-Tenancy & Authorization

## Authentication Stack

\`\`\`
Client → Keycloak (OIDC) → JWT → Backend (express-jwt) → Route Handler
         ↓ (admin)
Client → Custom Auth Pages → JWT Provider → Backend → Admin Routes
\`\`\`

### Keycloak Configuration
- **Realm:** myrealm
- **Client IDs:** \`react-webapp\` (frontend), \`admin-console-client\` (admin), \`myclient-backend\` (service-to-service)
- **Protocol:** OpenID Connect with Authorization Code flow
- **Token validation:** Backend validates JWTs against Keycloak JWKS endpoint
- **Admin auth:** Custom JWT auth pages replaced Keycloak redirect login (Feb 22)

### Authorization Layers

1. **express-jwt** — Validates JWT signature and expiry
2. **requirePlatformOperator** — Gates admin routes to operator-level users
3. **RBAC (express-rbac)** — Role-based access control for standard routes
4. **ABAC Engine** — Attribute-based access control with tenant-scoped enforcement

## Organization Type Registry

9 extensible organization types with type-specific configurations:

| Type | Description |
|------|-------------|
| \`dental_practice\` | Individual dental practice |
| \`dental_lab\` | Dental laboratory |
| \`dental_school\` | Educational institution |
| \`dental_supplier\` | Equipment/material supplier |
| \`dental_clinic\` | Multi-provider clinic |
| \`dental_hospital\` | Hospital dental department |
| \`dental_research\` | Research institution |
| \`dental_manufacturer\` | Crown/prosthetic manufacturer |
| \`dental_distributor\` | Distribution company |

## Tenant Management Hub

The admin console consolidates tenant management into a unified view:
- **Users, Organizations, Administrators** merged into single Tenant Management page
- **Tenant detail redesign** with full admin control per tenant
- **Approval workflows** with status machines (pending → approved → active → suspended)
- **Feature flags** with tenant-scoped overrides and percentage rollouts
- **Rate limit controls** per-tenant configuration

## Tenant Isolation

### Tenant-Scope Middleware

\`backend/src/middleware/tenant-resolver.ts\` extracts tenant context from the authenticated JWT. Tenant ID comes from the authentication token, **never from client-provided parameters** (Platform Invariant #4).

### ABAC Engine

The ABAC engine evaluates policies based on:
- **Subject:** User role, tenant membership, custom permissions
- **Resource:** Entity type, owner, tenant scope
- **Action:** CRUD operation being performed
- **Environment:** IP address, time, request metadata

**Current state:** ABAC permissions implemented with custom role definitions and tenant-scoped enforcement. Data isolation (Row-Level Security, tenantId on all documents) planned for Phase 2.

### Cross-Tenant Isolation (Planned — Phase 2)

Target test suite:
- Tenant A cannot read Tenant B's data
- Tenant A cannot modify Tenant B's resources
- Global admins can impersonate with explicit scope binding
- API responses never leak cross-tenant data

## Credential Management

- **MongoDB \`credentials\` collection** — 25 secrets managed
- Full CRUD with masked display, reveal/copy, rotation tracking
- Environment variable export for docker-compose consumption
- HashiCorp Vault integration planned (Phase 1)

## Platform Invariants (Governance)

25 architectural invariants govern the platform. Key auth-related invariants:

- **#4:** Tenant isolation is enforced server-side
- **#12:** Backend enforcement is non-negotiable
- **#14:** High-risk actions require step-up authentication
- **#15:** Audit logging is append-only and immutable
- **#17:** Secrets are never exposed
`,
  },

  {
    title: "OTP & Verification System",
    slug: "otp-verification-system",
    section: "architecture",
    sortOrder: 6,
    tags: ["architecture", "otp", "verification", "auth", "registration", "demo"],
    body: `# OTP & Verification System

## Overview

One-Time Password (OTP) codes are used for two flows: **user registration** and **demo access**. The OTP system reads its configuration from the admin-managed \\\`otpSettings\\\` MongoDB collection and logs all activity to the \\\`otpAuditLog\\\` collection.

## Configuration (Admin-Managed)

OTP settings are managed via the Admin Console at \\\`/admin/otp-settings\\\` and stored in the \\\`otpSettings\\\` collection (\\\`_id: 'otp'\\\`).

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| codeFormat | numeric | numeric, alphanumeric | Character set for OTP codes |
| codeLength | 6 | 4-12 | Number of characters in OTP code |
| expirySeconds | 300 | 60-3600 | How long until an OTP expires |
| maxAttempts | 3 | 1-20 | Max failed verification attempts |
| rateLimitPerHour | 3 | 1-10 | Max OTP requests per email per hour |
| verificationWindowMinutes | 30 | 5-120 | Time window for "recently verified" status |

## Code Generation

The \\\`generateOtpCode(context)\\\` function in \\\`backend/src/services/auth.js\\\`:

1. Reads settings from \\\`otpSettings\\\` collection (falls back to numeric 6-digit)
2. Generates the code:
   - **Numeric:** Uses \\\`Math.random()\\\` for a number with the configured digit count
   - **Alphanumeric:** Uses \\\`crypto.randomBytes()\\\` mapped to charset \\\`ABCDEFGHJKLMNPQRSTUVWXYZ23456789\\\` (30 chars — excludes confusing I, O, 1, 0)
3. Logs the OTP to \\\`otpAuditLog\\\` with status \\\`sent\\\`
4. Returns the code as a **string** (important for alphanumeric codes)

## Audit Trail

Every OTP generates an entry in the \\\`otpAuditLog\\\` collection:

\\\`\\\`\\\`json
{
  "code": "A3K9F2",
  "email": "user@example.com",
  "purpose": "registration|demo-access|registration-resend",
  "format": "numeric|alphanumeric",
  "length": 6,
  "createdAt": "2026-02-22T...",
  "expiresAt": "2026-02-22T...",
  "status": "sent|verified|failed|expired",
  "attempts": 0,
  "verifiedAt": null,
  "ip": "1.2.3.4"
}
\\\`\\\`\\\`

**Status transitions:**
- \\\`sent\\\` → \\\`verified\\\` (successful verification, sets \\\`verifiedAt\\\`)
- \\\`sent\\\` → \\\`failed\\\` (wrong code submitted, increments \\\`attempts\\\`)
- \\\`sent\\\` → \\\`expired\\\` (TTL-based, automatic)

**Admin visibility:** \\\`GET /api/admin/auth-settings/otp/history\\\` returns paginated results with **masked codes** (first 2 chars + \\\`****\\\`).

## Registration Flow

\\\`\\\`\\\`
POST /api/registration
  → generateOtpCode({ email, purpose: 'registration', ip })
  → Store code in pendingUsers collection
  → Send verification email with code
  → Log to otpAuditLog (status: 'sent')

POST /api/registration/verify
  → Compare submitted code with pendingUsers.code (String comparison)
  → On match: set emailVerified = true, log 'verified'
  → On mismatch: log 'failed', return error

POST /api/registration/resend
  → generateOtpCode({ email, purpose: 'registration-resend', ip })
  → Update pendingUsers with new code
  → Send new verification email
\\\`\\\`\\\`

**Validation:** Verification code is validated as a string (4-12 chars), not as an integer. This supports both numeric and alphanumeric codes.

## Demo Access Flow

\\\`\\\`\\\`
POST /api/demo/request-otp
  → generateOtpCode({ email, purpose: 'demo-access', ip })
  → Create/update demo user
  → Store code in demoOtps collection (as string)
  → Send OTP email (10 min expiry)
  → Log to otpAuditLog (status: 'sent')

POST /api/demo/verify-otp
  → Look up valid (unused, non-expired) OTP in demoOtps
  → On match: mark OTP as used, generate demo JWT, log 'verified'
  → On mismatch: log 'failed', return error
\\\`\\\`\\\`

**Key detail:** Demo OTP codes are stored as **strings** in the \\\`demoOtps\\\` collection (changed from numeric). The \\\`getValidDemoOtp()\\\` and \\\`markDemoOtpAsUsed()\\\` database functions use \\\`String(code)\\\` for queries.

## MongoDB Collections

| Collection | Purpose | Key Fields |
|-----------|---------|-----------|
| \\\`otpSettings\\\` | Admin-managed config (singleton \\\`_id: 'otp'\\\`) | codeFormat, codeLength, expirySeconds |
| \\\`otpAuditLog\\\` | Audit trail of all OTP activity | code, email, purpose, status, attempts |
| \\\`pendingUsers\\\` | Registration in progress | email, code, emailVerified, passwordSet |
| \\\`demoOtps\\\` | Demo access codes | email, code (string), expiresAt, used |

## Admin Console UI

The OTP Settings page (\\\`/admin/otp-settings\\\`) provides:

1. **General** — Enable/disable OTP verification
2. **Code Configuration** — Length (4-12), format (numeric/alphanumeric), live preview
3. **Security Settings** — Expiry, max attempts, rate limit, verification window
4. **Configuration Summary** — Badge display of current settings
5. **OTP History** — Audit trail table with:
   - Filters: email search, status dropdown, purpose dropdown
   - Columns: Time, Email, Purpose, Code (masked), Format, Status, Attempts, Verified At
   - Status badges: sent (blue), verified (green), expired (gray), failed (red)
   - Pagination and 30-second auto-refresh

## Files

| File | Role |
|------|------|
| \\\`backend/src/services/auth.js\\\` | \\\`generateOtpCode()\\\`, \\\`updateOtpAuditStatus()\\\` |
| \\\`backend/src/routes/registration.ts\\\` | Registration + verify + resend endpoints |
| \\\`backend/src/routes/demo.ts\\\` | Demo request-otp + verify-otp endpoints |
| \\\`backend/src/services/database.js\\\` | \\\`createDemoOtp()\\\`, \\\`getValidDemoOtp()\\\`, \\\`markDemoOtpAsUsed()\\\` |
| \\\`backend/src/routes/admin/auth-settings.ts\\\` | OTP settings CRUD + history endpoint |
| \\\`admin-console/src/pages/otp-settings/OTPSettingsPage.tsx\\\` | Admin UI (settings + history) |
| \\\`admin-console/src/api/admin.ts\\\` | \\\`getOTPSettings()\\\`, \\\`updateOTPSettings()\\\`, \\\`getOTPHistory()\\\` |
`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // API REFERENCE
  // ═══════════════════════════════════════════════════════════════════════════

  {
    title: "Admin API Reference",
    slug: "admin-api-reference",
    section: "api-reference",
    sortOrder: 1,
    tags: ["api", "admin", "endpoints", "reference"],
    body: `# Admin API Reference

**Base URL:** \`/api/admin\`
**Auth:** All endpoints require \`requirePlatformOperator\` middleware (Keycloak JWT with admin role).

## Endpoint Groups

### Dashboard
| Method | Path | Description |
|--------|------|-------------|
| GET | /admin/dashboard | Platform stats, health, recent activity |

### Support Tickets
| Method | Path | Description |
|--------|------|-------------|
| GET | /admin/support | List tickets (paginated, filterable) |
| GET | /admin/support/stats | Ticket statistics |
| GET | /admin/support/config | Support configuration |
| PUT | /admin/support/config | Update support config |
| POST | /admin/support | Create ticket |
| POST | /admin/support/create-with-attachments | Create with files |
| GET | /admin/support/:id | Get ticket |
| PATCH | /admin/support/:id | Update ticket |
| POST | /admin/support/:id/reply | Add reply |
| POST | /admin/support/:id/reply-with-attachments | Reply with files |
| GET | /admin/support/:id/attachments/:fileId | Download attachment |
| DELETE | /admin/support/:id/attachments/:fileId | Soft-delete attachment |
| POST | /admin/support/:id/assign | Assign ticket |
| POST | /admin/support/:id/escalate | Escalate priority |
| DELETE | /admin/support/:id | Soft-delete ticket |

### Developer Wiki
| Method | Path | Description |
|--------|------|-------------|
| GET | /admin/dev-wiki | List pages (paginated, searchable) |
| GET | /admin/dev-wiki/sections | Get distinct sections |
| GET | /admin/dev-wiki/stats | Wiki statistics |
| GET | /admin/dev-wiki/tree | Hierarchical sidebar tree |
| GET | /admin/dev-wiki/:id | Get page |
| GET | /admin/dev-wiki/:id/history | Edit history |
| POST | /admin/dev-wiki | Create page |
| PATCH | /admin/dev-wiki/:id | Update page |
| DELETE | /admin/dev-wiki/:id | Soft-delete page |
| POST | /admin/dev-wiki/reorder | Bulk reorder pages |

### Credentials Vault
| Method | Path | Description |
|--------|------|-------------|
| GET | /admin/credentials | List credentials |
| POST | /admin/credentials | Create credential |
| PATCH | /admin/credentials/:id | Update credential |
| DELETE | /admin/credentials/:id | Delete credential |
| POST | /admin/credentials/:id/rotate | Rotate credential |

### Auth Settings & OTP
| Method | Path | Description |
|--------|------|-------------|
| GET | /admin/auth-settings | Get auth settings (session, password, MFA, etc.) |
| PUT | /admin/auth-settings | Update auth settings |
| GET | /admin/auth-settings/otp | Get OTP configuration (format, length, expiry) |
| PUT | /admin/auth-settings/otp | Update OTP configuration |
| GET | /admin/auth-settings/otp/history | OTP audit trail (paginated, filterable) |
| GET | /admin/auth-settings/mfa/status | Keycloak MFA/TOTP enforcement status |
| PUT | /admin/auth-settings/mfa | Toggle MFA enforcement |
| GET | /admin/auth-settings/password-policy | Keycloak password policy |
| PUT | /admin/auth-settings/password-policy | Update password policy |
| GET | /admin/auth-settings/sessions | Keycloak session settings + active count |
| PUT | /admin/auth-settings/sessions | Update session timeouts |
| POST | /admin/auth-settings/sessions/logout-all | Terminate all realm sessions |

**OTP History query params:** \\\`?page=1&limit=20&status=sent|verified|expired|failed&purpose=registration|demo-access&email=search\\\`

Codes are masked in responses (first 2 chars + \\\`****\\\`).

### Users & Access
| Method | Path | Description |
|--------|------|-------------|
| GET | /admin/users | List users |
| GET | /admin/administrators | List administrators |
| GET | /admin/customers | List customers |
| GET | /admin/organizations | List organizations |
| GET | /admin/access-control | Access control policies |

### AI Providers & Prompts
| Method | Path | Description |
|--------|------|-------------|
| GET | /admin/ai-settings | AI provider config |
| GET | /admin/custom-agents | Custom agent definitions |
| GET | /admin/prompt-templates | Prompt template library |

### Content
| Method | Path | Description |
|--------|------|-------------|
| GET | /admin/cms-pages | CMS content pages |
| GET | /admin/messaging | Messaging config |
| GET | /admin/chat | Chat management |

### Commerce
| Method | Path | Description |
|--------|------|-------------|
| GET | /admin/orders | List orders |
| GET | /admin/pricing | Pricing plans |
| GET | /admin/payment-gateways | Payment gateway config |
| GET | /admin/shop | Shop products |
| GET | /admin/shipping | Shipping config |
| GET | /admin/manufacturing | Manufacturing orders |
| GET | /admin/promo-codes | Promotional codes |
| GET | /admin/inventory | Inventory management |
| GET | /admin/invoices | Invoice records |
| GET | /admin/tax-exemptions | Tax exemption management |
| GET | /admin/cart-abandonment | Cart recovery data |
| GET | /admin/customers | Customer management |

### Ranking & Leads
| Method | Path | Description |
|--------|------|-------------|
| GET | /admin/leads | Lead management |
| GET | /admin/lead-forms | Lead capture forms |
| GET | /admin/lead-campaigns | Campaign management |
| GET | /admin/lead-scoring | Lead scoring rules |
| GET | /admin/seo-settings | SEO configuration |
| GET | /admin/domains | Domain registry |

### Platform Config
| Method | Path | Description |
|--------|------|-------------|
| GET | /admin/settings | Platform settings |
| GET | /admin/feature-flags | Feature flags |
| GET | /admin/tenants | Tenant management |
| GET | /admin/analytics | Analytics data |
| GET | /admin/audit-log | Audit log entries |
| GET | /admin/login-audit | Login audit trail |
| GET | /admin/network | Network settings |
| GET | /admin/version-control | Deployment versions |
| GET | /admin/database | Database admin |
| GET | /admin/repair-plans | Repair plan management |

## Common Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 25, max: 100) |
| sortBy | string | Field to sort by |
| sortOrder | 'asc'/'desc' | Sort direction |
| search | string | Full-text search |

## Error Format

\`\`\`json
{
  "error": "Descriptive error message",
  "code": "ERROR_CODE",
  "details": {}
}
\`\`\`
`,
  },

  {
    title: "Support Ticket API — Detailed Reference",
    slug: "support-ticket-api",
    section: "api-reference",
    sortOrder: 2,
    tags: ["api", "support", "tickets", "gridfs", "attachments"],
    body: `# Support Ticket API — Detailed Reference

## Ticket Document Structure

\`\`\`json
{
  "ticketNumber": "TKT-20260219-1234",
  "subject": "Ticket subject line",
  "status": "open",
  "priority": "high",
  "category": "platform-audit",
  "customerEmail": "user@example.com",
  "customerId": null,
  "assignedTo": "admin@example.com",
  "messages": [{
    "messageId": "uuid-v4",
    "sender": "admin@example.com",
    "senderType": "admin",
    "messageType": "reply",
    "body": "Message content (markdown supported)",
    "attachments": [{
      "fileId": "gridfs-object-id",
      "originalName": "screenshot.png",
      "mimeType": "image/png",
      "size": 12345,
      "uploadedAt": "2026-02-19T00:00:00Z"
    }],
    "createdAt": "2026-02-19T00:00:00Z"
  }],
  "attachmentCount": 1,
  "sla": {
    "responseDeadline": "2026-02-19T04:00:00Z",
    "resolutionDeadline": "2026-02-20T00:00:00Z",
    "breached": false
  },
  "tags": ["platform-audit", "security"],
  "createdAt": "2026-02-19T00:00:00Z",
  "updatedAt": "2026-02-19T00:00:00Z",
  "createdBy": "admin@example.com",
  "deleted": false
}
\`\`\`

## Valid Enum Values

| Field | Values |
|-------|--------|
| status | open, in-progress, waiting-customer, waiting-internal, resolved, closed |
| priority | low, medium, high, urgent |
| senderType | admin, system |
| messageType | reply, internal-note, system-event |

## SLA Defaults (by priority)

| Priority | Response | Resolution |
|----------|----------|------------|
| low | 48 hours | 7 days |
| medium | 24 hours | 3 days |
| high | 4 hours | 1 day |
| urgent | 1 hour | 8 hours |

## Attachment Constraints

- **Max file size:** 10 MB per file
- **Max files per upload:** 5
- **Allowed MIME types:** image/png, image/jpeg, image/gif, image/webp, text/plain, text/markdown, text/csv, text/x-log, application/octet-stream
- **Allowed extensions:** .png, .jpg, .jpeg, .gif, .webp, .txt, .md, .log, .csv
- **Storage:** GridFS bucket \`main\`
- **GridFS filename format:** \`support-{ticketId}-{originalName}\`

## Ticket Number Format

\`TKT-YYYYMMDD-XXXX\` where XXXX is a 4-digit random number (1000-9999).

## Filtering & Search

\`\`\`
GET /api/admin/support?status=open&priority=high&category=platform-audit&search=audit&page=1&limit=25
\`\`\`

Supports filtering by: status, priority, category, assignedTo, search (subject/ticketNumber), breached (SLA).

## Categories

Default: billing, technical, account, feature-request, other, platform-audit
`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GUIDES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    title: "Platform Audit — 41 Observation Tickets",
    slug: "platform-audit-tickets",
    section: "guides",
    sortOrder: 1,
    tags: ["guides", "audit", "tickets", "platform-audit", "observations"],
    body: `# Platform Audit — 41 Observation Tickets

## Background

A comprehensive architectural audit was conducted across all 55 admin console modules plus a master platform invariants document. Each module was reviewed against the 25 platform invariants defined in \`overall.txt\`.

## Review Artifacts

Each module review is stored in \`review_dental_dev/{module_name}/\` containing:
- **Screenshot** (\`screenshot_{module}.png\`) — UI state capture
- **Observation text** (\`{module}_obs.txt\`) — Detailed audit findings

The master document is at \`review_dental_dev/overall.txt\` — 25 platform invariants.

## Ticket Structure

All 41 tickets are in the Support Inbox with:
- **Category:** \`platform-audit\`
- **Assigned to:** dshamir@blucap.ca
- **Status:** open
- **Attachments:** Screenshot + observation text file (in GridFS)
- **Cross-references:** Related tickets linked by cluster

## Priority Classification

### HIGH — 13 tickets (Security + Financial + Master)

| Ticket | Module | Rationale |
|--------|--------|-----------|
| TKT-20260218-7403 | access_control | Security-critical routing defect |
| TKT-20260218-9753 | administrators | Admin access in failed state |
| TKT-20260219-1004 | audit_log | Immutability and compliance gaps |
| TKT-20260219-1005 | authentication | Session enforcement, MFA gaps |
| TKT-20260219-1007 | content_policy | Content governance enforcement |
| TKT-20260219-1008 | credentials | Vault exposure, encryption gaps |
| TKT-20260219-1017 | fraud_detection | Security monitoring blind |
| TKT-20260219-1025 | orders | Financial records integrity |
| TKT-20260219-1027 | payment_gateways | Secret handling, webhook validation |
| TKT-20260219-1028 | pricing_plan | Billing integrity |
| TKT-20260219-1029 | rate_limits | DoS prevention |
| TKT-20260219-1034 | tenants | Multi-tenant isolation |
| TKT-20260219-1039 | overall | Governing design principles |

### MEDIUM — 20 tickets (Core Platform)

dashboard, ai_models, ai_settings, analytics, cms_content, custom_agents, customers, database, drydock_analysis, feature_flags, job_queue, knowledge_base, manufacturing, marketplace, network, settings, support_inbox, users, version_control, workers

### LOW — 8 tickets (Supporting)

dev_wiki, crm, messaging, notifications, organizations, shipping, shop, workflows

## Cross-Reference Clusters

Related tickets share cluster tags and reference each other:

| Cluster | Modules |
|---------|---------|
| \`security\` | access_control, authentication, credentials, fraud_detection, audit_log, rate_limits, content_policy |
| \`commerce\` | orders, payment_gateways, pricing, shipping, shop, manufacturing, customers, promo_codes, inventory, invoices, tax_exemptions, cart_recovery, crm |
| \`ai-prompts\` | ai_settings, custom_agents, prompt_templates |
| \`platform-core\` | dashboard, tenants, settings, feature_flags, analytics, tenant_audit_log, tenant_login_audit |
| \`ranking\` | seo_settings, domains, leads, lead_forms, campaigns, lead_scoring |
| \`infrastructure\` | database, network, version_control, messaging, notifications, repair_plans |
| \`content\` | cms_content, knowledge_base, dev_wiki, chat, otp_settings |

## Seed Script

Tickets were created by \`backend/scripts/seed-audit-tickets.js\`:

\`\`\`bash
docker compose run --rm \\
  -v "$PWD/backend/scripts:/app/scripts" \\
  -v "$PWD/review_dental_dev:/review_data" \\
  backend node /app/scripts/seed-audit-tickets.js
\`\`\`

The script is idempotent — safe to re-run. Existing tickets (access_control, administrators) are updated rather than duplicated.

## Verification

\`\`\`bash
# Check ticket count in MongoDB
docker exec exp_dental-mongodb-1 mongosh --quiet \\
  -u mongoadmin -p <password> --authenticationDatabase admin mediastore \\
  --eval 'db.supportTickets.countDocuments({ category: "platform-audit", deleted: { $ne: true } })'
# Expected: 41
\`\`\`

Filter by category \`platform-audit\` in the admin console Support Inbox to view all audit tickets.
`,
  },

  {
    title: "Seed Scripts Guide",
    slug: "seed-scripts-guide",
    section: "guides",
    sortOrder: 2,
    tags: ["guides", "scripts", "seed", "mongodb", "data"],
    body: `# Seed Scripts Guide

## Available Seed Scripts

| Script | Location | Purpose | Idempotent |
|--------|----------|---------|------------|
| seed-admin-data.js | \`scripts/\` | Admin settings, wiki stubs, sample data | Yes (seedIfEmpty) |
| seed-credentials.js | \`backend/scripts/\` | 19 base credentials (25 total managed) into vault | Yes (upsert on name) |
| seed-audit-tickets.js | \`backend/scripts/\` | 41 platform audit support tickets | Yes (upsert on tags) |
| seed-dev-wiki.js | \`backend/scripts/\` | Developer wiki documentation pages | Yes (upsert on slug) |

## Running Seed Scripts

All scripts connect to MongoDB using the \`DATABASE_URL\` environment variable (defaults to the docker-compose internal URL).

### From Docker Compose (preferred)

\`\`\`bash
# Scripts already in the image (after build)
docker compose run --rm backend node /app/scripts/seed-credentials.js

# Scripts needing volume mounts (e.g., external data)
docker compose run --rm \\
  -v "$PWD/backend/scripts:/app/scripts" \\
  -v "$PWD/review_dental_dev:/review_data" \\
  backend node /app/scripts/seed-audit-tickets.js
\`\`\`

### From Host (requires MongoDB port access)

\`\`\`bash
DATABASE_URL=mongodb://mongoadmin:<password>@localhost:27017/mediastore?authSource=admin \\
  node backend/scripts/seed-credentials.js
\`\`\`

> **Note:** MongoDB port 27017 is not exposed by default. Either add a port mapping to docker-compose.override.yml or use the Docker Compose run method.

## Writing New Seed Scripts

### Template

\`\`\`javascript
#!/usr/bin/env node
const { MongoClient } = require("mongodb");

const DATABASE_URL = process.env.DATABASE_URL ||
  "mongodb://mongoadmin:<password>@mongodb/mediastore?authSource=admin";

async function seed() {
  const client = new MongoClient(DATABASE_URL);
  await client.connect();
  const db = client.db();

  // Your seeding logic here
  const collection = db.collection("yourCollection");

  let created = 0, updated = 0;
  for (const doc of YOUR_DATA) {
    const result = await collection.updateOne(
      { uniqueField: doc.uniqueField },   // match criteria
      { $set: { ...doc, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
    if (result.upsertedCount > 0) created++;
    else if (result.modifiedCount > 0) updated++;
  }

  console.log(\\\`Done: \\\${created} created, \\\${updated} updated\\\`);
  await client.close();
}

seed().catch(err => { console.error(err); process.exit(1); });
\`\`\`

### Best Practices

1. **Always use upsert** — scripts must be idempotent (safe to re-run)
2. **Use a unique key** for matching (slug, name, envKey, etc.)
3. **Log counts** — created, updated, unchanged
4. **Close the client** when done
5. **Handle errors** with process.exit(1)
6. **Use the same DATABASE_URL pattern** as existing scripts
`,
  },

  {
    title: "Satellite Repositories",
    slug: "satellite-repositories",
    section: "guides",
    sortOrder: 3,
    tags: ["guides", "satellites", "drydock", "integration", "repositories"],
    body: `# Satellite Repositories

## Overview

Several companion repositories provide specialized functionality. They live in \`evaluate/\` (local only, not committed to git).

## Repository Status

| Repository | Priority | Integration Status |
|------------|----------|-------------------|
| dental-drydock-api | HIGH | Integrated — proxied via nginx at \`/api/drydock/\`, in docker-compose |
| dental-drydock-web | HIGH | Pending — 16 Three.js analysis modules to integrate |
| Crown-generation SAP | MEDIUM | Integrated via CI/CD pipeline |
| margin-line-editor | MEDIUM | Published as \`@intellident-ai/margin-line-editor\` npm package |
| dental-wordpress | LOW | Separate marketing CMS — keep independent |
| Dental_Implant_Project | LOW | Archive candidate |
| Scan_Marker_Classification | LOW | Archive candidate |

## Drydock API Integration

The Drydock API (FastAPI) provides 3D mesh analysis capabilities:

\`\`\`yaml
# docker-compose.yml
drydock-api:
  build:
    context: ./evaluate/dental-drydock-api-main
  ports:
    - 8002:8002
  environment:
    MEDIASTORE_URL: http://backend:3001/api/medias
    INTERNAL_SERVICES_PASSKEY: \${INTERNAL_SERVICES_PASSKEY}
    REDIS_URL: redis://:password@redis:6379/2
\`\`\`

**Nginx routing:**
\`\`\`
/api/drydock/ → drydock-api:8002
\`\`\`

## Drydock Web (Pending)

16 Three.js modules for browser-based mesh analysis:
- Undercut detection visualization
- Thickness heatmaps
- Margin line overlay
- Crown fit analysis
- And 12 more specialized views

**Integration plan:** Embed as iframe or micro-frontend within admin console's Drydock Analysis module.

## Margin Line Editor

Published npm package: \`@intellident-ai/margin-line-editor\`

Provides interactive 3D margin line editing using VTK.js. Already consumed by the frontend.
`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY
  // ═══════════════════════════════════════════════════════════════════════════

  {
    title: "Security Posture & Remediation",
    slug: "security-posture",
    section: "security",
    sortOrder: 1,
    tags: ["security", "vulnerabilities", "cvss", "remediation", "phase-0"],
    body: `# Security Posture & Remediation

## Current Score

- **Security Score:** 3/10 → target 9/10
- **Open Findings:** 28 (10 CRITICAL, 6 HIGH, 7 MEDIUM, 5 LOW)
- **Mean CVSS:** 8.49
- **Mitigated:** Phase 0 completed, Phases 1-6 scaffolded

## Critical Findings

| # | Finding | CVSS | Status |
|---|---------|------|--------|
| 1 | 19 originally hardcoded credentials in docker-compose.yml (25 now in vault) | 10.0 | Vault operational, rotation pending |
| 2 | Docker socket mounted in workers + dozzle | 9.0 | Removed from backend (Phase 0), workers pending Phase 5 |
| 3 | No input validation on admin APIs | 8.5 | 95 Zod schemas written (Phase 1) |
| 4 | IDOR on projects and medias endpoints | 8.0 | Patched (Phase 0) |
| 5 | OTP leak in response body | 7.5 | Fixed (Phase 0). OTP generation now reads admin settings (format/length). Audit trail added. |
| 6 | \$regex injection (33 occurrences) | 7.0 | Sanitized (Phase 0) |
| 7 | No rate limiting on auth endpoints | 6.5 | Rate limit middleware written (Phase 2) |
| 8 | Missing CORS origin validation | 6.0 | Configured in Phase 0 |
| 9 | No CSP headers | 5.5 | Nginx headers pending |
| 10 | Missing audit logging on admin actions | 5.0 | Audit middleware written (Phase 2) |

## Phase 0 — Emergency Security (Completed)

- OTP leak fixed
- \`$regex\` sanitized across 33 occurrences
- Docker socket removed from backend container
- IDOR patched on projects + medias endpoints
- npm audit + Trivy scanning added to CI
- Pre-commit hooks installed

## Remediation Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| Phase 0 | Emergency security fixes | Completed |
| Phase 1 | Foundation (validation, migrations) | Code complete |
| Phase 2 | Multi-tenancy (Vault, ABAC, isolation) | Code complete |
| Phase 3 | Academic/AI enhancements | Code complete |
| Phase 4 | Commerce (Stripe, subscriptions) | Code complete |
| Phase 5 | Kubernetes migration | Helm charts written |
| Phase 6 | Compliance (retention, E2E tests) | Code complete |

## Human Tasks Pending

- Credential rotation (all 25 secrets)
- npm audit fix (dependency vulnerabilities)
- Prisma migration execution
- K8s cluster provisioning
- Penetration testing
- Legal review of data handling
`,
  },

  {
    title: "Credential Management",
    slug: "credential-management",
    section: "security",
    sortOrder: 2,
    tags: ["security", "credentials", "vault", "secrets", "rotation"],
    body: `# Credential Management

## Architecture

\`\`\`
Application → Vault Client → HashiCorp Vault (KV v2)
                  ↓ (fallback)
              Environment Variables
\`\`\`

The platform uses HashiCorp Vault for secret management with environment variable fallback.

## Managed Credentials (25 total)

| Service | Credentials | Risk |
|---------|------------|------|
| MongoDB | Root username + password | Critical — database access |
| PostgreSQL | User + password | High — Keycloak data |
| RabbitMQ | User + password | High — job queue access |
| Keycloak | Admin password + client secret | Critical — auth bypass |
| Internal Services | Shared passkey | High — service-to-service |
| SMTP | Password | Medium — email sending |
| AWS | Access key + secret key | High — cloud resources |
| reCAPTCHA | Secret key | Low — bot protection |
| Swagger | Admin password | Low — API docs |
| Redis | Password | Medium — cache/sessions |
| MinIO | Root user + password | Medium — object storage |
| Grafana | Admin password | Low — monitoring |
| Flower | Password | Low — task monitoring |

## Admin Console UI

The Credentials module (\`/admin/credentials\`) provides:
- List all credentials with masked values
- Create/update credentials
- Rotation tracking (lastRotatedAt)
- Export capability (restricted, audited)

## Seed Script

\`\`\`bash
docker compose run --rm backend node /app/scripts/seed-credentials.js
\`\`\`

Upserts 19 base credentials (25 total managed) into the \`credentials\` MongoDB collection.

## Platform Invariant #17

> Secrets are never exposed. Secrets are encrypted at rest, masked in UI,
> and treated as write-only after creation. Secrets are referenced by IDs,
> not stored or transported in plaintext. Export is tightly permissioned,
> audited, rate-limited, and scope-restricted.

## Known Gap

19 credentials were originally hardcoded in \`docker-compose.yml\` (CVSS 10.0). Vault is now operational with 25 total credentials managed, but **credential rotation has not been executed** — this is a pending human task.
`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DEPLOYMENT
  // ═══════════════════════════════════════════════════════════════════════════

  {
    title: "Local Development & Deployment",
    slug: "local-development-deployment",
    section: "deployment",
    sortOrder: 1,
    tags: ["deployment", "docker", "dev.sh", "ngrok", "kubernetes"],
    body: `# Local Development & Deployment

## Local Development (Docker Compose)

### dev.sh Orchestrator

\`dev.sh\` is the single-command development tool. It manages building, starting, monitoring, and debugging all 24 platform services.

#### Command Reference

| Command | Description |
|---------|-------------|
| \`./dev.sh\` | Rebuild backend + admin-console, start all, show status |
| \`./dev.sh --all\` | Rebuild ALL services, start all, show status |
| \`./dev.sh --status\` | Show container status table (no build/restart) |
| \`./dev.sh rebuild <svc> [svc...]\` | Hot-rebuild + recreate specific service(s) |
| \`./dev.sh restart <svc> [svc...]\` | Restart service(s) without rebuilding |
| \`./dev.sh logs [svc...]\` | Tail service logs (all if none specified) |
| \`./dev.sh shell <svc>\` | Open shell in a running container |
| \`./dev.sh down\` | Stop and remove all containers (volumes preserved) |
| \`./dev.sh health\` | Probe all service health endpoints |

#### Usage Examples

\`\`\`bash
# Daily development: rebuild backend + admin-console, start everything
./dev.sh

# Hot-rebuild only the backend (keeps other 23 containers running)
./dev.sh rebuild backend

# Rebuild multiple services at once
./dev.sh rebuild backend nginx

# Restart nginx without rebuilding (reuses existing image)
./dev.sh restart nginx

# Tail backend logs
./dev.sh logs backend

# Shell into the backend container (bash → sh fallback)
./dev.sh shell backend

# Check all service health endpoints
./dev.sh health

# Stop everything (volumes preserved for next run)
./dev.sh down
\`\`\`

#### rebuild vs restart

- **\`rebuild\`** builds a new Docker image from the Dockerfile and recreates the container. Use when you've changed source code, dependencies, or Dockerfile.
- **\`restart\`** stops and starts the container using the existing image. Use when you've changed environment variables or just need a fresh process.

#### Version Metadata Pipeline

\`dev.sh\` injects version and deployment metadata into every build:

\`\`\`
version.txt ─→ BUILD_ARGS (GIT_COMMIT, GIT_BRANCH, APP_VERSION, GIT_MESSAGE)
                  │
                  ├─→ docker compose build --build-arg ...
                  │         │
                  │         └─→ Dockerfile ARG → build-info.json
                  │
                  └─→ export DEPLOY_USER (git config user.email)
                           │
                           └─→ docker compose up (env vars in compose file)
\`\`\`

This metadata is visible in the Admin Console → **Version Control** page, showing which commit, branch, message, and user triggered each deployment.

### Docker Compose Files

| File | Purpose |
|------|---------|
| \`docker-compose.yml\` | Production-like base (all 24 services) |
| \`docker-compose.override.yml\` | Local overrides: ngrok tunnel, port mappings, stubs |
| \`docker-compose.staging.yml\` | Staging environment config |

### Override Details

The override file (\`docker-compose.override.yml\`):
- Exposes nginx on port 8888
- Adds ngrok tunnel to \`dental.ngrok.dev\`
- Stubs out private registry images (undercut-detection, thickness-interactive)
- Configures Keycloak for ngrok hostname
- Sets backend auth issuer to ngrok URL
- Builds frontend/admin-console with ngrok URLs

## Kubernetes (Production Target)

### Helm Charts

13 Helm templates in \`k8s/\` covering all services:
- Deployments, Services, ConfigMaps, Secrets
- HPA (Horizontal Pod Autoscaler) for workers
- PVCs for MongoDB, MinIO, Redis
- Ingress with TLS

### Environment Overrides

| File | Environment |
|------|-------------|
| \`k8s/values-dev.yaml\` | Development cluster |
| \`k8s/values-staging.yaml\` | Staging cluster |
| \`k8s/values-prod.yaml\` | Production cluster |

### HMAC-Signed Messaging

Phase 5 adds HMAC signatures to RabbitMQ messages for integrity verification between services in the K8s cluster.

### Worker Migration (Phase 5)

Workers will migrate from Docker-in-Docker to Kubernetes Jobs API:
\`\`\`
Current:  Worker → Docker Socket → GPU Container
Future:   Worker → kubernetes Python client → K8s Job → GPU Pod
\`\`\`

This eliminates the Docker socket mount (CVSS 9.0 finding).
`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TROUBLESHOOTING
  // ═══════════════════════════════════════════════════════════════════════════

  {
    title: "Common Issues & Solutions",
    slug: "common-issues",
    section: "troubleshooting",
    sortOrder: 1,
    tags: ["troubleshooting", "debugging", "errors", "ngrok", "docker"],
    body: `# Common Issues & Solutions

## ERR_NGROK_3004 — Tunnel Not Found

**Symptom:** Browser shows ngrok error page with code 3004.

**Cause:** The ngrok tunnel session expired or the container started without establishing a tunnel.

**Fix:**
\`\`\`bash
# Force recreate the ngrok container
docker compose up -d --force-recreate ngrok

# Verify tunnel is established (look for "started tunnel" line)
docker logs exp_dental-ngrok-1 --tail 10

# If no logs appear, ensure --log stdout is in the command
# In docker-compose.override.yml:
#   command: http nginx:80 --url=dental.ngrok.dev --log stdout --log-level info
\`\`\`

**Workaround:** Access via local port instead: \`http://localhost:8888\`

## "Failed to load dashboard data" in Admin Console

**Symptom:** Admin console loads but shows error about dashboard data.

**Cause:** Not authenticated. The admin API requires a Keycloak JWT.

**Fix:** Navigate to \`https://dental.ngrok.dev/admin\` (without /support) and complete Keycloak login. Then navigate to the support page.

## Backend Container Keeps Restarting

**Symptom:** \`docker ps\` shows backend restarting repeatedly.

**Fix:**
\`\`\`bash
# Check logs for the error
docker logs exp_dental-backend-1 --tail 50

# Common causes:
# 1. MongoDB not ready yet — wait and retry
# 2. Missing environment variable — check docker-compose.yml
# 3. Port conflict — check nothing else is on port 3001
\`\`\`

## GPU Workers Failing

**Symptom:** Jobs stuck in queue, workers show errors.

**Fix:**
\`\`\`bash
# Check NVIDIA runtime is available
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi

# Check worker logs
docker logs exp_dental-worker_segmentation-1 --tail 50

# Check Docker socket is mounted
docker inspect exp_dental-worker_segmentation-1 | grep -A5 Binds
\`\`\`

## MongoDB Connection Refused

**Symptom:** Backend or scripts fail with "connection refused" to MongoDB.

**Fix:**
\`\`\`bash
# From Docker network (scripts via docker compose run)
DATABASE_URL=mongodb://mongoadmin:<pass>@mongodb/mediastore?authSource=admin

# From host (requires port mapping in override)
# Add to docker-compose.override.yml under mongodb:
#   ports:
#     - "27017:27017"
DATABASE_URL=mongodb://mongoadmin:<pass>@localhost:27017/mediastore?authSource=admin
\`\`\`

## Seed Script "Review directory not found"

**Symptom:** \`seed-audit-tickets.js\` can't find review data.

**Fix:** Mount the review directory into the container:
\`\`\`bash
docker compose run --rm \\
  -v "$PWD/backend/scripts:/app/scripts" \\
  -v "$PWD/review_dental_dev:/review_data" \\
  backend node /app/scripts/seed-audit-tickets.js
\`\`\`

## Keycloak "Invalid redirect URI"

**Symptom:** Login fails with redirect URI mismatch.

**Cause:** Keycloak client doesn't have the ngrok URL registered.

**Fix:** Add \`https://dental.ngrok.dev/*\` to the Valid Redirect URIs in Keycloak admin console (\`/auth/admin\`) for both \`react-webapp\` and \`admin-console-client\` clients.

## Flower / Dozzle 403 or Login Loop

**Symptom:** Can't access monitoring tools.

**Fix:** Check credentials:
- Flower: \`FLOWER_USER:FLOWER_PASSWORD\` from .env
- Dozzle: Credentials in \`dozzle/users.yml\`
`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL ARCHITECTURE
  // ═══════════════════════════════════════════════════════════════════════════

  {
    title: "Data Layer — MongoDB, PostgreSQL, Redis, GridFS",
    slug: "data-layer",
    section: "architecture",
    sortOrder: 4,
    tags: ["architecture", "mongodb", "postgresql", "redis", "gridfs", "data"],
    body: `# Data Layer — MongoDB, PostgreSQL, Redis, GridFS

## MongoDB (Primary Document Store)

**Database:** \`mediastore\`
**Driver:** Native MongoDB Node.js driver (not Mongoose)

### Key Collections

| Collection | Purpose | Indexed Fields |
|-----------|---------|---------------|
| projects | Dental scan projects | sub, organizationId |
| projectHistory | Audit trail for project changes | projectId |
| users | All platform users | email (unique), sub (unique) |
| administrators | Admin users | sub (unique) |
| organizations | Tenant organizations | — |
| organizationMembers | Org membership | email (unique), sub (unique) |
| supportTickets | Support ticket system | ticketNumber, tenantId, status |
| devWikiPages | Developer wiki content | slug, section |
| credentials | Credential vault entries | name (unique), envKey |
| systemSettings | Global platform settings | — |
| scalars | Sequence counters (nextCaseId) | — |
| otpSettings | OTP configuration (format, length, expiry) | _id: 'otp' (singleton) |
| otpAuditLog | OTP audit trail (code, email, status, attempts) | email + createdAt, status, expiresAt |
| authSettings | Auth config (session, password, MFA, IP whitelist) | _id: 'auth' (singleton) |
| pendingUsers | Registration pending users with verification code | email (unique) |
| demoOtps | Demo access OTP codes | email, expiresAt |
| demoUsers | Demo user accounts | email (unique) |
| emailTemplates | Email template definitions (slug, subject, body, variables) | slug (unique) |
| creditLedger | Credit transaction log (purchases, deductions, adjustments) | orgId + createdAt |
| creditPricing | Credit pricing tiers and packages | — |
| orders | Commerce orders | tenantId, status, createdAt |
| products | Shop product catalogue | tenantId, slug |
| inventory | Inventory stock levels | productId, sku |
| invoices | Invoice records | tenantId, orderId |
| promoCodeRules | Promotional code definitions | code (unique), tenantId |
| cartAbandonment | Abandoned cart tracking | userId, tenantId |
| leads | CRM lead records | tenantId, email, stage |
| leadForms | Lead capture form definitions | tenantId, slug |
| campaigns | Marketing campaigns | tenantId, status |
| leadScoringRules | Lead scoring rule definitions | tenantId |
| repairPlans | Device repair plan records | tenantId, status |
| chatMessages | Chat management messages | tenantId, channelId |

### Connection Config
\`\`\`javascript
{
  connectTimeoutMS: 30000,
  socketTimeoutMS: 600000,
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 30000
}
\`\`\`

### Schema Validation

Migration 001 applies JSON Schema validators in \`moderate\` mode with \`warn\` action. This allows flexibility while logging non-conformant documents.

## PostgreSQL (Relational — via Prisma)

Used for tenant management, subscriptions, and structured audit logs.

### Prisma Models
- **Tenant** — organization, plan, status
- **Subscription** — Stripe subscription lifecycle
- **AuditLog** — immutable audit trail
- **PricingPlan** — billing tiers

**Connection:** \`postgresql://keycloak:keycloak@postgres:5432/intellident?schema=app\`

Keycloak also uses PostgreSQL for its realm database.

## Redis

Three logical databases:

| DB | Purpose | Used By |
|----|---------|---------|
| 0 | Backend caching + rate limiting + sessions | backend |
| 1 | Celery result backend | workers, flower |
| 2 | Drydock API cache | drydock-api |

## GridFS (File Attachments)

- **Bucket name:** \`main\`
- **Collections:** \`main.files\` (metadata), \`main.chunks\` (binary data)
- **Used by:** Support ticket attachments, audit file uploads
- **Metadata fields:** ticketId, originalName, mimeType, context, deleted

### GridFS vs MinIO

| Feature | GridFS | MinIO |
|---------|--------|-------|
| Purpose | Small file attachments (< 10 MB) | Large scan files (STL/PLY) |
| Storage | Inside MongoDB | Separate S3-compatible store |
| Access | Via backend API | Direct S3 protocol |
| Typical use | Support ticket screenshots, text files | Dental scan uploads |

## MinIO (Object Storage)

S3-compatible storage for dental scan files:
- **API port:** 9000 (mapped to 39000)
- **Console port:** 9001 (mapped to 39001)
- Workers download/upload scan data via backend's \`/api/medias\` endpoint
`,
  },

  {
    title: "Platform Invariants — Design Principles",
    slug: "platform-invariants",
    section: "architecture",
    sortOrder: 5,
    tags: ["architecture", "invariants", "governance", "principles"],
    body: `# Platform Invariants — Design Principles

25 architectural invariants govern all platform behavior. These are non-negotiable design constraints that every module must satisfy.

## The 25 Invariants

### State & Control
1. **Control plane separation** — Admin Console governs configuration; it does not mutate tenant business records directly
2. **Authoritative state in backend** — Frontend is never a source of truth
3. **Explicit scope** — Every entity is global-only, tenant-scoped, or global-with-tenant-overrides

### Tenant Isolation
4. **Server-side tenant enforcement** — Tenant scope comes from authenticated context, never client parameters
5. **Deterministic configuration** — No hidden defaults, no implicit inheritance

### Versioning & Immutability
6. **Versioned, immutable config** — Publishing creates snapshots; rollback creates new versions
7. **Compatibility gating** — Activation validates schema/version against deployed build

### Transactional Integrity
8. **Atomic mutations** — Operations complete fully or have no effect
9. **Idempotent operations** — Deduplicated by (actor_id, operation_name, request_id)
10. **Concurrency control** — Mutations require expected_version check

### Bulk Operations
11. **Per-entity atomicity** — Bulk actions are atomic per entity, support dry-run, enforce max batch size

### Enforcement
12. **Backend enforcement** — Validation, authorization, filtering, transitions happen only in backend
13. **Structured errors** — Every error is categorized, machine-readable; no empty/error state conflation

### Security
14. **Step-up auth for high-risk actions** — Publish, secret export, payment changes, impersonation
15. **Immutable audit logging** — Append-only within same transaction boundary
16. **Separate operational logs** — Structured telemetry with correlation IDs
17. **Secret protection** — Encrypted at rest, masked in UI, write-only after creation

### Time & Finance
18. **UTC timestamps** — Backend stores UTC; UI converts for display only
19. **Financial immutability** — Orders, payments, refunds snapshotted at transaction time

### Lifecycle
20. **Explicit state machines** — Enumerated states with valid transitions enforced server-side
21. **Authoritative metrics** — Backend source, defined window/scope, computed_at timestamp

### Environment
22. **Environment awareness** — UI shows environment identity and build identifiers
23. **Dependency validation** — Activation validates dependencies, refuses broken configs

### UI
24. **No decorative controls** — Every UI toggle corresponds to real backend-enforced semantics
25. **Minimal architecture** — Implement only what satisfies determinism, governance, isolation, auditability, and safety
`,
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("Connecting to MongoDB...");
  const client = new MongoClient(DATABASE_URL);
  await client.connect();
  console.log("Connected.");

  const db = client.db();
  const collection = db.collection("devWikiPages");

  // Ensure indexes
  await collection.createIndex({ slug: 1 }, { unique: true });
  await collection.createIndex({ section: 1 });
  await collection.createIndex({ updatedAt: -1 });

  let created = 0;
  let updated = 0;

  for (const page of PAGES) {
    const result = await collection.updateOne(
      { slug: page.slug },
      {
        $set: {
          title: page.title,
          section: page.section,
          body: page.body,
          tags: page.tags || [],
          sortOrder: page.sortOrder || 0,
          author: AUTHOR,
          updatedAt: now,
        },
        $setOnInsert: {
          slug: page.slug,
          createdAt: now,
          createdBy: AUTHOR,
        },
      },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      created++;
      console.log(`  + Created: ${page.title} [${page.section}]`);
    } else if (result.modifiedCount > 0) {
      updated++;
      console.log(`  ~ Updated: ${page.title} [${page.section}]`);
    } else {
      console.log(`  = Unchanged: ${page.title} [${page.section}]`);
    }
  }

  const total = await collection.countDocuments();
  const sections = await collection.distinct("section");

  console.log("\n══════════════════════════════════════");
  console.log(`  Created:   ${created} page(s)`);
  console.log(`  Updated:   ${updated} page(s)`);
  console.log(`  Total:     ${total} wiki page(s)`);
  console.log(`  Sections:  ${sections.join(", ")}`);
  console.log("══════════════════════════════════════\n");

  await client.close();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
