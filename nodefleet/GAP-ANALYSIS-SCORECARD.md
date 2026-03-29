# NodeFleet — Full-Stack Gap Analysis & Scorecard

**Date:** 2026-03-29
**Classification:** Strategic Assessment — Infrastructure, Applications, UI/UX, Documentation
**Benchmark:** Industry gold standards (OWASP, WCAG 2.1 AA, 12-Factor App, Cloud-Native best practices)
**Companion Report:** `recommendation-report.md` covers firmware/hardware (15 dimensions, scored 4.2→7.4)

---

## Executive Summary

NodeFleet is architecturally sound with excellent API design (8.5/10), outstanding documentation (9.0/10), a clean WebSocket pipeline (8.0/10), and solid database modeling (8.0/10). The critical gaps are concentrated in **operations and safety**: no backups, no monitoring, no tests, exposed secrets, and missing security headers. These are high-leverage fixes — the first two weeks of the roadmap alone would move the overall score from **4.98 to ~6.5**.

---

## Master Scorecard (25 Dimensions)

| # | Dimension | Current | Gold Std | Gap | Priority |
|---|-----------|:-------:|:--------:|:---:|:--------:|
| | **INFRASTRUCTURE** | | | | |
| 1 | Docker Containerization | 7.5/10 | 9.5/10 | -2.0 | MEDIUM |
| 2 | Orchestration & Compose | 5.0/10 | 9.0/10 | -4.0 | HIGH |
| 3 | Nginx / Reverse Proxy | 4.0/10 | 9.5/10 | -5.5 | **CRITICAL** |
| 4 | Secrets & Credential Mgmt | 2.0/10 | 9.5/10 | -7.5 | **CRITICAL** |
| 5 | Monitoring & Observability | 1.0/10 | 9.0/10 | -8.0 | **CRITICAL** |
| 6 | Backup & Disaster Recovery | 0.0/10 | 9.0/10 | -9.0 | **CRITICAL** |
| | **APPLICATIONS** | | | | |
| 7 | API Design & REST Conventions | 8.5/10 | 9.5/10 | -1.0 | LOW |
| 8 | Database & ORM | 8.0/10 | 9.0/10 | -1.0 | LOW |
| 9 | Authentication & Authorization | 6.5/10 | 9.5/10 | -3.0 | HIGH |
| 10 | Error Handling & Resilience | 5.0/10 | 9.0/10 | -4.0 | HIGH |
| 11 | Logging (Structured) | 2.5/10 | 9.0/10 | -6.5 | HIGH |
| 12 | Real-time / WebSocket Pipeline | 8.0/10 | 9.0/10 | -1.0 | LOW |
| | **UI / UX** | | | | |
| 13 | Design System & Tokens | 7.5/10 | 9.0/10 | -1.5 | MEDIUM |
| 14 | Responsive & Mobile | 6.5/10 | 9.0/10 | -2.5 | MEDIUM |
| 15 | Accessibility (WCAG 2.1 AA) | 2.5/10 | 9.0/10 | -6.5 | **CRITICAL** |
| 16 | Loading / Empty / Error States | 5.5/10 | 9.0/10 | -3.5 | HIGH |
| 17 | Data Tables & Pagination | 4.0/10 | 9.0/10 | -5.0 | HIGH |
| 18 | Forms & Validation UX | 4.5/10 | 9.0/10 | -4.5 | HIGH |
| | **DOCUMENTATION** | | | | |
| 19 | README & Architecture Docs | 9.0/10 | 9.5/10 | -0.5 | LOW |
| 20 | API Reference (OpenAPI) | 5.0/10 | 9.5/10 | -4.5 | MEDIUM |
| 21 | Inline Code Documentation | 5.0/10 | 8.0/10 | -3.0 | MEDIUM |
| 22 | Runbooks & Ops Guides | 3.0/10 | 9.0/10 | -6.0 | HIGH |
| | **CROSS-CUTTING** | | | | |
| 23 | Testing & Coverage | 1.5/10 | 9.0/10 | -7.5 | **CRITICAL** |
| 24 | CI/CD Pipeline | 4.5/10 | 9.5/10 | -5.0 | HIGH |
| 25 | Naming / Nomenclature Congruency | 7.5/10 | 9.0/10 | -1.5 | LOW |
| | | | | | |
| | **OVERALL** | **4.98/10** | **9.12/10** | **-4.14** | |

---

## Dimension Analysis

### INFRASTRUCTURE

---

### 1. Docker Containerization — 7.5/10

**Current state:**
- Multi-stage Alpine builds for web and ws-server
- Non-root user in web Dockerfile (nextjs:1001)
- Production-only dependencies in final image stage
- Standalone Next.js output for minimal footprint

**Gold standard (Docker best practices):**
- All containers run non-root with explicit USER directive
- All Dockerfiles include HEALTHCHECK instruction
- Images scanned in CI (Trivy, Snyk Container)
- `.dockerignore` in every service directory

**Gaps:**
- ws-server Dockerfile runs as **root** (no USER directive)
- nginx Dockerfile has no HEALTHCHECK instruction
- No `.dockerignore` in ws-server directory
- No image scanning in CI pipeline

**Recommendations:**
1. Add non-root user to ws-server Dockerfile (`adduser -S wsserver -u 1001`, `USER wsserver`)
2. Add HEALTHCHECK to nginx Dockerfile (`curl -f http://localhost/health || exit 1`)
3. Add `.dockerignore` to ws-server (exclude node_modules, .git, dist)
4. Add Trivy image scan step to CI pipeline

---

### 2. Orchestration & Compose — 5.0/10

**Current state:**
- 8 services with proper `depends_on` using health condition checks
- Named volumes for all stateful services (postgres_data, redis_data, minio_data, mqtt_data, mqtt_log)
- Single bridge network (nodefleet-net) with DNS service discovery
- minio-init auto-creates `nodefleet-media` bucket on startup
- nodefleet.sh orchestration script (872 lines, 15 commands, excellent)

**Gold standard (production Docker Compose):**
- Resource limits (CPU + memory) on every service
- Restart policies on all services
- Log rotation configuration (`json-file` driver with max-size/max-file)
- Environment profiles for dev/staging/prod
- Deploy constraints for stateful services

**Gaps:**
- **Zero resource limits** on any service — risk of noisy neighbor / OOM
- Restart policies only on ngrok (1 of 8 services)
- No logging driver config — logs can fill disk
- No compose profiles for environment separation
- No deploy replicas or placement constraints

**Recommendations:**
1. Add `deploy.resources.limits` to every service (e.g., web: 1 CPU / 2GB, postgres: 2 CPU / 4GB)
2. Add `restart: unless-stopped` to postgres, redis, minio, mqtt; `restart: on-failure:5` to web, ws-server, nginx
3. Add logging config: `driver: json-file`, `max-size: 10m`, `max-file: 3`
4. Create `docker-compose.prod.yml` override for production settings

---

### 3. Nginx / Reverse Proxy — 4.0/10

**Current state:**
- Correct WebSocket upgrade handling (`proxy_http_version 1.1`, `Connection "upgrade"`)
- Proper proxy headers (X-Real-IP, X-Forwarded-For, X-Forwarded-Proto)
- 24-hour read timeout for long-lived device WebSocket connections
- Health endpoint at `/health`
- Separate routing: `/device` and `/dashboard` → ws-server, `/api/*` and `/` → web

**Gold standard (OWASP + production nginx):**
- Security headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Gzip compression for text assets
- Rate limiting zones (API, device, general)
- Static asset caching (30-day immutable)
- TLS/HTTPS with automatic certificate renewal (Let's Encrypt)

**Gaps:**
- **Zero security headers** — no HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- **No gzip compression** — 60-70% bandwidth waste on text/JSON assets
- **No rate limiting** at proxy level (only in-memory rate limit on one API route)
- No caching headers for static assets
- No TLS/HTTPS configuration
- `client_max_body_size 500m` — excessive for most use cases (50-100m recommended)

**Recommendations:**
1. Add OWASP security headers block to nginx.conf (HSTS, CSP, X-Frame-Options, etc.)
2. Enable gzip compression (comp_level 6, text/html/css/js/json types)
3. Add `limit_req_zone` for API (10r/s) and device (5r/s) rate limiting
4. Add `expires 30d` + `Cache-Control: public, immutable` for static assets
5. Configure TLS with Let's Encrypt (certbot sidecar container)
6. Reduce `client_max_body_size` to `100m`

---

### 4. Secrets & Credential Management — 2.0/10

**Current state:**
- `.env.example` documents 20+ environment variables
- Secrets loaded via `.env` file (not committed to git)
- `NEXT_PUBLIC_*` prefix correctly used for client-side vars

**Gold standard (secret management):**
- No secrets in git (even in example files)
- Docker Secrets or HashiCorp Vault for credential injection
- Automatic rotation on schedule
- Audit trail for secret access
- Separate credentials per environment

**Gaps:**
- **Real NGROK_AUTHTOKEN committed** in `.env.example` (`2xp5CFLpEd0Xr8KLjZ69h0lxl9p_43UGFKD5EwyHYgW13kTev`)
- Hardcoded `minioadmin:minioadmin` in docker-compose.yml
- Hardcoded `nodefleet:nodefleet` PostgreSQL credentials in docker-compose.yml
- `NEXTAUTH_SECRET=change-me-in-production` with no runtime enforcement
- No Docker Secrets, Vault, or cloud secret manager integration
- `.env.example` has no comments explaining variables

**Recommendations:**
1. **Immediately rotate NGROK_AUTHTOKEN** — it is committed to git history
2. Replace hardcoded credentials with `${VARIABLE}` references from .env
3. Add comments to `.env.example` explaining each variable's purpose and requirements
4. Add startup validation that rejects default/placeholder secrets in production (`NODE_ENV=production`)
5. Document secret rotation procedure in runbooks

---

### 5. Monitoring & Observability — 1.0/10

**Current state:**
- Application-level telemetry stored in PostgreSQL (battery, signal, CPU temp, memory)
- Custom Logger class in ws-server with ISO timestamps and INFO/WARN/ERROR levels
- Audit trail with 19 event types (excellent for compliance)
- Health check endpoints on web and ws-server

**Gold standard (production observability):**
- RED metrics (Rate, Errors, Duration) for all endpoints
- Structured JSON logging with correlation IDs
- Distributed tracing across services
- Alerting on SLO breaches
- Infrastructure dashboards (container CPU/memory/disk)

**Gaps:**
- No Prometheus metrics collection
- No Grafana dashboards
- No alerting rules (PagerDuty, OpsGenie, Slack)
- No distributed tracing (Jaeger, Zipkin)
- No centralized logging (ELK, Loki, Datadog)
- No container metrics (cAdvisor)
- No APM (Application Performance Monitoring)

**Recommendations:**
1. Add Prometheus + Grafana + node-exporter to docker-compose.yml
2. Export Node.js metrics via `prom-client` (HTTP request duration, active connections, error rate)
3. Create Grafana dashboards for service health, device fleet status, and API performance
4. Add alerting rules for: service down > 30s, error rate > 5%, device offline > 1h
5. Evaluate Loki for centralized log aggregation (lightweight, pairs with Grafana)

---

### 6. Backup & Disaster Recovery — 0.0/10

**Current state:**
- Named Docker volumes persist data across restarts
- No backup infrastructure exists

**Gold standard (backup & DR):**
- Automated daily database backups with retention policy
- Volume snapshots for stateful services
- Tested restore procedures (monthly drill)
- Documented RTO (Recovery Time Objective) and RPO (Recovery Point Objective)
- Off-site backup replication

**Gaps:**
- No `pg_dump` backup scripts
- No volume snapshot automation
- No backup retention or rotation policy
- No RTO/RPO definitions
- No disaster recovery runbook
- No backup verification/testing procedures
- No MinIO object backup strategy

**Recommendations:**
1. Create `scripts/backup.sh` with `pg_dump`, MinIO mirror, and Redis RDB copy
2. Add cron job for daily backups with 30-day retention
3. Define RTO < 4h / RPO < 1h targets
4. Document restore procedure and test quarterly
5. Add backup health check to nodefleet.sh (`./nodefleet.sh backup`, `./nodefleet.sh restore`)

---

### APPLICATIONS

---

### 7. API Design & REST Conventions — 8.5/10

**Current state:**
- 38 RESTful endpoints with consistent verb usage (GET/POST/PUT/DELETE)
- Kebab-case URL paths (`/api/devices/pair`, `/api/device-commands`)
- Zod schema validation on all routes
- Proper HTTP status codes (400, 401, 403, 404, 409, 429, 500)
- HMAC-SHA256 webhook signatures
- Pagination with offset/limit
- Sub-resource patterns (`/api/devices/[id]/telemetry`, `/api/fleets/[id]/command`)

**Gold standard (API design):**
- API versioning (`/api/v1/`)
- OpenAPI 3.1 spec auto-generated from schemas
- HATEOAS links in responses
- Pagination metadata (total count, Link headers)
- Rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining)

**Gaps:**
- No API versioning — breaking changes would affect all consumers
- No OpenAPI/Swagger spec generation
- No HATEOAS links in responses
- No pagination metadata (total count, next/prev links)
- No rate limit response headers

**Nomenclature assessment:** Excellent consistency — `GET/POST /api/{resource}`, sub-resources via `/api/{resource}/{id}/{sub-resource}`. Snake_case in query params matches database convention.

**Recommendations:**
1. Add `/api/v1/` prefix to all routes (backward-compatible migration)
2. Generate OpenAPI spec from Zod schemas using `@asteasolutions/zod-to-openapi`
3. Add `X-Total-Count` and `Link` headers to paginated responses
4. Add `X-RateLimit-*` headers to rate-limited endpoints

---

### 8. Database & ORM — 8.0/10

**Current state:**
- Drizzle ORM with strict TypeScript — full type safety from schema to query
- 21 tables with 8 PostgreSQL enums
- UUID primary keys on all tables (`.defaultRandom()`)
- snake_case columns (gold standard for PostgreSQL)
- Proper foreign key constraints and indexes
- Timestamps with timezone (`created_at`, `updated_at`)

**Gold standard (database engineering):**
- Versioned migrations (not schema push)
- Read replicas with connection pooling (PgBouncer)
- Row-level security (RLS) for multi-tenancy
- Soft-delete patterns
- Index optimization audits

**Gaps:**
- Uses `drizzle push` instead of versioned migrations — risky for production
- No read replicas or connection pooling (PgBouncer)
- No row-level security (RLS) for tenant isolation
- No soft-delete pattern (hard deletes only)
- No index performance audit

**Recommendations:**
1. Switch from `drizzle push` to `drizzle generate` + `drizzle migrate` for production
2. Evaluate PgBouncer for connection pooling at scale
3. Audit indexes for query performance (especially telemetry and audit_logs tables)

---

### 9. Authentication & Authorization — 6.5/10

**Current state:**
- NextAuth v5 with JWT strategy and Credentials provider
- bcryptjs password hashing (salt rounds: 10)
- Device pairing with time-limited 6-character codes (24h expiry)
- RBAC with 4 organization roles (owner, admin, member, viewer)
- API key format `nf_<8char>_<32char>` stored as SHA-256 hash
- Rate limiting on device pairing endpoint (10 attempts/hour/IP)

**Gold standard (auth security):**
- Redis-backed distributed rate limiting
- Account lockout after N failed attempts
- MFA/2FA support
- Token rotation with short lifetimes
- CORS configuration
- Session revocation mechanism

**Gaps:**
- Rate limiting is **in-memory Map** — fails in multi-instance deployments
- No account lockout after repeated failed login attempts
- No MFA/2FA support
- Device tokens valid for **365 days** without rotation enforcement
- No CORS configuration visible
- No session revocation mechanism (logout doesn't invalidate JWT)

**Recommendations:**
1. Move rate limiting to Redis (`ioredis` already in dependencies)
2. Add account lockout (5 failed attempts → 15-minute lock)
3. Reduce device token lifetime to 90 days with automatic rotation
4. Add CORS middleware with explicit origin whitelist
5. Implement JWT blacklist in Redis for session revocation

---

### 10. Error Handling & Resilience — 5.0/10

**Current state:**
- try/catch blocks on all API route handlers
- Zod validation throws structured errors on invalid input
- Rate limit returns HTTP 429 with descriptive message
- Error cards in dashboard UI with red styling
- Custom error messages for common cases (invalid pairing code, expired code)

**Gold standard (resilience engineering):**
- Structured error responses with error codes and correlation IDs
- Circuit breakers for external service calls
- Retry logic with exponential backoff for transient failures
- React error boundaries for UI recovery
- Graceful degradation when services are unavailable

**Gaps:**
- Generic "Internal server error" in catch-all blocks — no error codes
- No circuit breaker for Redis/PostgreSQL failures
- No retry logic for transient failures
- No React error boundary components (`error.tsx`)
- No graceful degradation (full-page error when any service fails)
- Inconsistent: some catch blocks only `console.error` and return null

**Recommendations:**
1. Define error code enum (e.g., `DEVICE_NOT_FOUND`, `PAIRING_EXPIRED`, `RATE_LIMITED`)
2. Return structured error responses: `{ error: { code, message, details } }`
3. Add React `error.tsx` boundary in `(dashboard)` layout
4. Add retry logic for Redis and PostgreSQL operations (3 retries, exponential backoff)

---

### 11. Logging (Structured) — 2.5/10

**Current state:**
- ws-server has custom Logger class with ISO timestamps and context objects
- Logger supports INFO/WARN/ERROR levels
- 78 raw `console.*` calls across web/src (unstructured)
- Audit trail in database (separate concern, well-implemented)

**Gold standard (production logging):**
- Structured JSON logging (Pino, Winston)
- Correlation IDs across request lifecycle
- Configurable log levels per environment
- Request/response logging middleware
- Log aggregation and search

**Gaps:**
- **78 raw `console.*` calls** in web app — not structured, not searchable
- No JSON structured logging (Pino recommended for Node.js)
- No correlation IDs for tracing requests across services
- No log levels configurable by environment
- No request/response logging middleware
- ws-server Logger wraps console.* — not redirectable to log aggregation

**Recommendations:**
1. Install Pino (`pino` + `pino-http` middleware for Next.js)
2. Replace all `console.*` calls with Pino logger
3. Add correlation ID middleware (generate UUID per request, pass in headers)
4. Configure log levels via environment variable (`LOG_LEVEL=info`)
5. Add `pino-http` request logging middleware

---

### 12. Real-time / WebSocket Pipeline — 8.0/10

**Current state:**
- ws library with automatic reconnect and exponential backoff
- Redis pub/sub decouples web app from WebSocket server
- Separate channels for device and dashboard connections
- UDP broadcast + mDNS for zero-config LAN device discovery
- MQTT broker (Mosquitto) for dual-protocol telemetry (WebSocket + MQTT)
- Protocol routing settings per organization

**Gold standard (real-time systems):**
- WebSocket authentication during handshake
- Message queue persistence (Redis Streams or dedicated MQ)
- Backpressure handling for slow consumers
- Connection pool limits per client type
- Heartbeat-based connection health monitoring

**Gaps:**
- No WebSocket authentication during upgrade handshake (auth happens post-connect)
- No message queue persistence (Redis pub/sub is fire-and-forget)
- No backpressure handling for slow dashboard consumers
- No connection pool limits per client type
- No message ordering guarantees

**Recommendations:**
1. Add JWT validation during WebSocket upgrade request (query param or header)
2. Evaluate Redis Streams for persistent message delivery (vs. pub/sub)
3. Add connection limits (e.g., max 100 devices per org, max 10 dashboard clients)

---

### UI / UX

---

### 13. Design System & Tokens — 7.5/10

**Current state:**
- CSS custom properties for all semantic colors (primary, success, warning, error)
- Tailwind config maps custom tokens correctly
- 6 button variants (default, destructive, outline, secondary, ghost, link)
- 6 badge variants with status colors
- Radix UI primitives wrapped as components (`/components/ui/`)
- Consistent color palette: primary (#0ea5e9 cyan), success (#10b981), warning (#f59e0b), error (#ef4444)
- Custom animations: fadeIn, slideInUp, slideInLeft, pulse-soft

**Gold standard (design systems):**
- Dark + light mode with system preference detection
- Documented spacing/sizing scale
- Storybook component catalog
- Animation timing tokens
- Font scale tokens

**Gaps:**
- Dark mode only — no light mode or system toggle
- No spacing/sizing scale documentation
- No Storybook or component catalog
- No animation timing tokens
- No font scale tokens

**Recommendations:**
1. Add CSS custom properties for light theme + `prefers-color-scheme` media query
2. Create Storybook for component documentation and visual regression testing
3. Document spacing scale (4px grid: 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24)

---

### 14. Responsive & Mobile — 6.5/10

**Current state:**
- Sidebar implements mobile hamburger menu with backdrop (fixed, z-40/z-50)
- Dashboard stats grid uses `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
- Breadcrumbs hidden on small screens (`hidden sm:flex`)
- Search input uses `flex-1 max-w-md` for flexible sizing

**Gold standard (responsive design):**
- Mobile-first approach with progressive enhancement
- Touch-optimized tap targets (minimum 44x44px)
- Horizontal scroll indicators on data tables
- Viewport-relative units for fluid typography
- Container queries for component-level responsiveness

**Gaps:**
- Limited use of `md:` and `lg:` breakpoints across components
- Fixed-height map container (`h-[500px]`) — problematic on small screens
- Tables lack horizontal scroll indicators on mobile
- No touch-optimized tap targets (44px minimum not enforced)

**Recommendations:**
1. Audit all pages on 375px viewport (iPhone SE)
2. Add horizontal scroll wrapper with fade indicators for data tables
3. Replace fixed `h-[500px]` map with `h-[50vh] min-h-[300px]`
4. Ensure all interactive elements meet 44x44px minimum

---

### 15. Accessibility (WCAG 2.1 AA) — 2.5/10

**Current state:**
- Radix UI provides some built-in ARIA attributes
- Semantic HTML structure (nav, main, header elements)
- Focus ring defined in globals.css (`.focus-ring` applies `ring-2 ring-primary`)
- One `sr-only` instance on dialog close button

**Gold standard (WCAG 2.1 AA):**
- All interactive elements have accessible names
- Keyboard navigation works for all workflows
- Focus traps in modals/dialogs
- Skip-to-content link
- Color contrast ratio >= 4.5:1 for normal text
- Screen reader tested with NVDA/VoiceOver
- Automated a11y testing (axe-core) in CI

**Gaps:**
- **Minimal `aria-label` attributes** across the codebase
- No `aria-current="page"` on active navigation items
- No `htmlFor` associations on all form labels
- No alt text for decorative icons (lucide-react)
- No keyboard navigation testing
- No focus traps in modals (Radix partially handles, but not verified)
- No skip-to-content link
- No color contrast verification
- No screen reader testing
- No automated a11y testing in CI

**Recommendations:**
1. Add `aria-label` to all icon-only buttons
2. Add `aria-current="page"` to active sidebar nav item
3. Add `<a href="#main-content" class="sr-only focus:not-sr-only">Skip to content</a>`
4. Verify all form inputs have associated `<label htmlFor="...">`
5. Add `eslint-plugin-jsx-a11y` to linting configuration
6. Run axe-core audit and fix critical/serious violations

---

### 16. Loading / Empty / Error States — 5.5/10

**Current state:**
- Loading states use `<Loader2 className="animate-spin" />` spinner
- Empty states display icon + heading + description text (well-designed)
- Error cards with red background/border styling
- Network scanner has excellent pulsing ring animation
- Disabled form inputs show opacity and cursor-not-allowed

**Gold standard (state management UX):**
- Skeleton screens matching content layout
- Toast notifications for all user actions
- React error boundaries with recovery options
- Progressive/streaming loading (Suspense boundaries)
- Retry mechanisms for failed operations

**Gaps:**
- **No skeleton screens** — spinner-only loading (content layout shift on load)
- **Toast system built but NEVER USED** — `useToast` hook exists in `/components/ui/toast.tsx` but is not imported anywhere
- No React error boundary components (`error.tsx`)
- No retry mechanisms on API failure
- No progressive/streaming loading (React Suspense)
- No CTAs in empty states (e.g., "Create your first device" button)

**Recommendations:**
1. **Wire up existing toast system** — import `useToast` and add success/error toasts to all form submissions and API operations
2. Create skeleton components for device list, stats cards, and data tables
3. Add `error.tsx` in `(dashboard)` route group for graceful error recovery
4. Add "retry" button on error states
5. Add CTA buttons in empty states ("Add your first device", "Create a schedule")

---

### 17. Data Tables & Pagination — 4.0/10

**Current state:**
- Semantic `<table>` with hover states (`hover:bg-slate-900/50`)
- Backend pagination implemented (offset/limit in audit, schedules)
- `@tanstack/react-table` is in package.json dependencies
- Device list, schedule table, and audit log all use table layouts
- Client-side filtering with search + status + fleet dropdowns

**Gold standard (data table UX):**
- Sortable columns (click header to sort)
- Pagination controls (prev/next/page numbers, "Showing 1-50 of 200")
- Column resizing and reordering
- Bulk row selection (checkboxes)
- Row expansion for details
- URL query params for filter/sort persistence

**Gaps:**
- **No sorting** — table headers are not clickable
- **No pagination UI controls** — no prev/next buttons, no page indicator
- **TanStack Table installed but not integrated** — using raw `<table>` elements
- No column resizing or reordering
- No bulk row selection (checkboxes)
- No row expansion/detail panel
- No "Showing 1-50 of 200" indicator
- No URL query params for filter persistence (lost on navigation)
- Client-side search has no debounce (re-filters every keystroke)

**Recommendations:**
1. Integrate TanStack Table (already installed) for devices, schedules, and audit tables
2. Add sorting on all columns with visual indicator (arrow up/down)
3. Add pagination controls with page numbers and total count
4. Add 300ms debounce on search input
5. Persist filters in URL query params (`?status=online&fleet=abc`)

---

### 18. Forms & Validation UX — 4.5/10

**Current state:**
- Basic required field checks (`if (!addName.trim() || !addModel.trim())`)
- Zod validation on API routes (server-side only)
- Placeholder text provides hints ("e.g. GPS Camera 01")
- Confirmation dialog for device deletion (destructive action)
- Disabled states with opacity and cursor-not-allowed

**Gold standard (form UX):**
- Client-side validation matching server schemas
- Inline field-level error messages
- Real-time validation feedback during typing
- Required field indicators (asterisk or "Required")
- Password strength meter
- Unsaved changes warning on navigation
- Form progress persistence

**Gaps:**
- **No client-side Zod validation** — errors only appear after API round-trip
- No field-level error messages (only top-level form error)
- No inline validation during typing
- No required field indicators (*, "Required")
- No password strength meter on change-password form
- No unsaved changes warning on navigation away
- No form state persistence (lost on page refresh)

**Recommendations:**
1. Share Zod schemas between API routes and client forms (move to `lib/schemas/`)
2. Add `react-hook-form` with `@hookform/resolvers/zod` for client-side validation
3. Display field-level error messages below each input
4. Add asterisk (*) to required fields
5. Add "Unsaved changes" dialog on navigation when form is dirty

---

### DOCUMENTATION

---

### 19. README & Architecture Docs — 9.0/10

**Current state:**
- README.md (226 lines) — tech stack badges, quick start, project structure, 38 API endpoints, orchestration commands
- ARCHITECTURE.md (307 lines) — ASCII system topology, data flows, security model, database schema
- KNOWN_ISSUES.md (220 lines) — resolved issues with root causes, open blockers, mitigation status
- HARDWARE_ALTERNATIVES.md (161 lines) — compatible boards comparison, verified hardware table, buying guide
- recommendation-report.md (653 lines) — 15-dimension firmware gap analysis with detailed recommendations
- docs/API.md, DEPLOYMENT.md, USER_GUIDE.md, WEBSOCKET_PROTOCOL.md, DEVICE_DISCOVERY.md

**Gold standard:**
- Architecture diagrams (Mermaid, Draw.io, or C4 model)
- ADR (Architecture Decision Records)
- Changelog (CHANGELOG.md)

**Gaps:**
- No visual architecture diagrams — text-only ASCII art
- No ADRs (Architecture Decision Records)
- No CHANGELOG.md
- recommendation-report.md covers firmware only (this scorecard fills the gap)

**Recommendations:**
1. Add Mermaid diagrams to ARCHITECTURE.md (renders natively on GitHub)
2. Create `docs/adr/` directory for Architecture Decision Records
3. Add CHANGELOG.md with semantic versioning entries

---

### 20. API Reference (OpenAPI) — 5.0/10

**Current state:**
- API_ROUTES_SUMMARY.md covers all 38 routes with method, purpose, and auth requirements
- WEBSOCKET_PROTOCOL.md documents all message types and schemas
- docs/API.md provides endpoint documentation with authentication patterns
- HTTP status codes listed for each endpoint category

**Gold standard:**
- OpenAPI 3.1 specification (YAML/JSON) auto-generated from Zod schemas
- Interactive API explorer (Swagger UI or Redoc) at `/api/docs`
- SDK generation capability from spec
- Example request/response bodies for all endpoints

**Gaps:**
- **No OpenAPI/Swagger spec** — documentation is markdown-only
- No interactive API explorer
- No SDK generation capability
- No example request/response bodies in documentation
- No Postman/Insomnia collection

**Recommendations:**
1. Generate OpenAPI spec from Zod schemas using `@asteasolutions/zod-to-openapi`
2. Expose Swagger UI at `/api/docs` endpoint
3. Auto-generate TypeScript SDK for consumers
4. Add Postman collection export

---

### 21. Inline Code Documentation — 5.0/10

**Current state:**
- TypeScript interfaces serve as implicit documentation (type names are descriptive)
- Zod schemas are self-documenting for validation rules
- ws-server Logger class has context objects for debugging
- Minimal JSDoc/TSDoc comments on functions

**Gold standard:**
- JSDoc/TSDoc on exported functions and complex logic
- Module-level documentation headers
- Constants with explanation comments
- Complex algorithms documented with inline comments

**Gaps:**
- Minimal JSDoc/TSDoc comments on exported functions
- No module-level documentation headers
- Config constants lack explanation comments
- Complex database queries have no inline documentation

**Recommendations:**
1. Add JSDoc to all exported API route handlers (purpose, auth requirements, params)
2. Add module-level comment headers to `lib/` files (auth.ts, audit.ts, webhooks.ts)
3. Document complex queries (telemetry aggregation, audit filtering)

---

### 22. Runbooks & Ops Guides — 3.0/10

**Current state:**
- nodefleet.sh has `--help` with documentation for 15 commands
- DEPLOYMENT.md covers basic production setup (prerequisites, env vars, seeding)
- KNOWN_ISSUES.md documents workarounds for known problems

**Gold standard:**
- Incident response runbook (escalation, triage, communication)
- Scaling playbook (horizontal scaling, database optimization)
- Database maintenance guide (vacuum, reindex, pg_stat)
- On-call rotation and escalation documentation
- Rollback procedures for failed deployments
- Capacity planning guide

**Gaps:**
- No incident response runbook
- No scaling playbook
- No database maintenance guide
- No on-call rotation or escalation documentation
- No rollback procedures for failed deployments
- No capacity planning guide
- No backup/restore procedures

**Recommendations:**
1. Create `docs/runbooks/` directory
2. Write incident response runbook (severity levels, escalation, communication templates)
3. Write database maintenance guide (vacuum schedule, index maintenance, monitoring queries)
4. Document rollback procedure for each service (docker rollback, database migration rollback)

---

### CROSS-CUTTING

---

### 23. Testing & Coverage — 1.5/10

**Current state:**
- `tsc --noEmit` in CI pipeline (static type checking for web and ws-server)
- PlatformIO firmware compilation check in CI
- No test framework installed in any package.json

**Gold standard:**
- 80%+ code coverage with coverage gates in CI
- Unit tests for business logic and utilities
- Integration tests for API routes with test database
- E2E tests for critical user flows (login, device creation, command dispatch)
- Contract tests for WebSocket protocol
- Test database seeding scripts

**Gaps:**
- **Zero unit tests** in the entire codebase
- **Zero integration tests**
- **Zero E2E tests**
- No test framework installed (no Jest, Vitest, Playwright, Cypress)
- No coverage reporting or coverage gates
- No test database seeding scripts
- No API contract tests
- No WebSocket protocol tests

**Recommendations:**
1. Install Vitest (fastest, best TypeScript support) in web and ws-server
2. Write API route tests for critical paths: auth, device CRUD, pairing, command dispatch (target: 40% coverage)
3. Add Playwright for E2E tests: login flow, device creation + pairing, command dispatch
4. Add coverage reporting to CI with 60% gate (raise to 80% over time)
5. Create test database seeding script for consistent test data

---

### 24. CI/CD Pipeline — 4.5/10

**Current state:**
- GitHub Actions triggered on push to main and PRs to main
- Three jobs: typecheck-web, typecheck-ws-server, firmware-compile
- npm dependency caching per service
- PostgreSQL 16 service for type checking
- PlatformIO caching for firmware builds

**Gold standard:**
- Lint, test, security scan, build, deploy as pipeline stages
- Matrix builds across Node versions
- Artifact management (firmware binaries, build outputs)
- Deployment automation (staging, production)
- Dependabot for automated dependency updates
- Branch protection with required checks

**Gaps:**
- No lint job in pipeline (eslint exists but not run in CI)
- No test jobs (no tests exist yet)
- No security scanning (SAST, dependency audit, container scan)
- No build artifacts preserved (firmware binaries lost after CI run)
- No deployment automation (manual docker compose only)
- No Dependabot configuration
- No branch protection rules enforcement visible
- No matrix builds (only Node 20)
- No manual workflow dispatch trigger
- No scheduled/nightly builds

**Recommendations:**
1. Add lint job: `npm run lint` for web
2. Add test job (once tests are written)
3. Add `npm audit` step for dependency vulnerability scanning
4. Add Trivy container scan step
5. Add `.github/dependabot.yml` for automated dependency updates
6. Preserve firmware binaries via `actions/upload-artifact@v4`
7. Add manual dispatch trigger for on-demand CI runs

---

### 25. Naming / Nomenclature Congruency — 7.5/10

| Layer | Convention | Consistency | Notes |
|---|---|:---:|---|
| Database tables | `snake_case` | 10/10 | `device_commands`, `org_members`, `telemetry_records` |
| Database columns | `snake_case` | 10/10 | `created_at`, `password_hash`, `pairing_code` |
| TypeScript variables | `camelCase` | 9/10 | `deviceId`, `orgName`, `pairingCode` |
| TypeScript types | `PascalCase` | 9/10 | `Device`, `Organization`, `ApiKey` |
| API route paths | `kebab-case` | 9/10 | `/api/devices/pair`, `/api/device-commands` |
| Environment variables | `UPPER_SNAKE_CASE` | 10/10 | `DATABASE_URL`, `NEXTAUTH_SECRET` |
| Component files | **Mixed** | 6/10 | `DeviceList.tsx` (PascalCase) vs `device-status-badge.tsx` (kebab-case) |
| Firmware modules | `snake_case` | 9/10 | `websocket_client.cpp`, `mqtt_client.cpp` |
| Git commits | `type: description` | 8/10 | Missing scope format (`feat(ui): ...`) |
| PostgreSQL enums | `snake_case` | 10/10 | `device_status`, `org_member_role` |

**Primary incongruency:** Component file naming — some files use PascalCase (`DeviceList.tsx`), others use kebab-case (`device-status-badge.tsx`). The project should standardize on one convention.

**Recommendation:** Standardize on kebab-case for file names (Next.js convention) or PascalCase for component files (React convention). Either is acceptable, but pick one and enforce via eslint rule.

---

## Heat Map

```
                        ## CRITICAL    ++ HIGH    -- MEDIUM    .. LOW

INFRASTRUCTURE
  Containerization      ------------------                      7.5
  Orchestration         ++++++++++++++++++++++++                5.0
  Nginx/Proxy           ##############################          4.0  CRITICAL
  Secrets               ##############################          2.0  CRITICAL
  Monitoring            ##############################          1.0  CRITICAL
  Backup/DR             ##############################          0.0  CRITICAL

APPLICATIONS
  API Design            ......                                  8.5
  Database/ORM          ......                                  8.0
  Auth/AuthZ            +++++++++++++++                         6.5
  Error Handling        ++++++++++++++++++++++++                5.0
  Logging               ++++++++++++++++++++++++++++            2.5
  WebSocket Pipeline    ......                                  8.0

UI / UX
  Design System         ------------------                      7.5
  Responsive/Mobile     ----------------------                  6.5
  Accessibility         ##############################          2.5  CRITICAL
  States (Load/Empty)   +++++++++++++++++++++                   5.5
  Tables/Pagination     +++++++++++++++++++++++++++             4.0
  Forms/Validation      +++++++++++++++++++++++++               4.5

DOCUMENTATION
  README/Arch           ...                                     9.0
  API Reference         ------------------                      5.0
  Inline Code           ------------------                      5.0
  Runbooks/Ops          ++++++++++++++++++++++++++++            3.0

CROSS-CUTTING
  Testing               ##############################          1.5  CRITICAL
  CI/CD Pipeline        +++++++++++++++++++++++++++             4.5
  Nomenclature          ........                                7.5
```

---

## 7 Critical Gaps (Score < 3.0)

| # | Dimension | Score | Root Cause | Immediate Fix |
|---|---|:---:|---|---|
| 1 | Backup/DR | 0.0 | No backup infrastructure exists | Create `scripts/backup.sh` with pg_dump + volume snapshots |
| 2 | Monitoring | 1.0 | Console-only logging, no metrics | Add Prometheus + Grafana to docker-compose |
| 3 | Testing | 1.5 | No test framework installed | Install Vitest, write first 20 API route tests |
| 4 | Secrets | 2.0 | Real token committed to git | Rotate NGROK_AUTHTOKEN, replace hardcoded creds |
| 5 | Accessibility | 2.5 | Minimal ARIA, no a11y testing | Add aria-labels, skip-link, jsx-a11y eslint plugin |
| 6 | Logging | 2.5 | 78 raw console.* calls | Replace with Pino structured JSON logging |
| 7 | Runbooks | 3.0 | No ops documentation | Create incident response + rollback runbooks |

---

## Priority Roadmap

### Week 1 — Security & Survival
- [ ] Rotate NGROK_AUTHTOKEN (committed to git history)
- [ ] Add OWASP security headers to nginx (HSTS, CSP, X-Frame-Options)
- [ ] Add restart policies to all 8 services in docker-compose
- [ ] Add resource limits (CPU + memory) to all services
- [ ] Move rate limiting from in-memory Map to Redis
- [ ] Replace hardcoded credentials with .env variable references

### Week 2 — Observability & Safety Net
- [ ] Add Prometheus + Grafana + node-exporter to docker-compose
- [ ] Replace `console.*` with Pino structured logging across web/src
- [ ] Create `scripts/backup.sh` (pg_dump + MinIO mirror + cron)
- [ ] Enable gzip compression in nginx
- [ ] Add logging driver config (json-file, 10MB max, 3 file rotation)
- [ ] Add correlation ID middleware

### Week 3 — Testing Foundation
- [ ] Install Vitest + @testing-library/react
- [ ] Write API route tests for auth, devices, fleets, pairing (target: 40% coverage)
- [ ] Add lint + test + security scan jobs to GitHub Actions CI
- [ ] Add `.github/dependabot.yml` for automated dependency updates
- [ ] Generate OpenAPI spec from Zod schemas

### Week 4 — UX Polish
- [ ] Wire up existing toast system (built but unused — import useToast)
- [ ] Add skeleton loading screens (replace spinners)
- [ ] Integrate TanStack Table (already in package.json) for devices/audit/schedules
- [ ] Add client-side Zod validation with react-hook-form
- [ ] Add ARIA labels, `aria-current`, skip-to-content link
- [ ] Add `error.tsx` error boundary in dashboard layout

### Month 2+ — Production Hardening
- [ ] TLS/HTTPS with Let's Encrypt auto-renewal (certbot sidecar)
- [ ] Database migration versioning (replace drizzle push with drizzle migrate)
- [ ] Kubernetes manifests for cloud deployment
- [ ] Disaster recovery runbook + tested restore procedures
- [ ] Standardize component file naming convention
- [ ] Add Storybook for component catalog
- [ ] Implement dark/light mode toggle

---

## Score Progression Forecast

| Milestone | Estimated Score | Delta |
|---|:---:|:---:|
| Current state | 4.98 | — |
| After Week 1 (security) | 5.8 | +0.82 |
| After Week 2 (observability) | 6.5 | +0.70 |
| After Week 3 (testing) | 7.2 | +0.70 |
| After Week 4 (UX) | 7.8 | +0.60 |
| After Month 2+ (hardening) | 8.5+ | +0.70 |

---

## Comparison with Firmware Scorecard

| Report | Dimensions | Overall Score | Top Strength | Biggest Gap |
|---|:---:|:---:|---|---|
| recommendation-report.md (firmware) | 15 | 4.2→7.4 | GPS/GNSS (8/10) | Backup/DR (0/10) |
| **This report (full-stack)** | **25** | **4.98** | **README/Docs (9.0)** | **Backup/DR (0.0)** |
| **Combined platform** | **40** | **~4.7** | Documentation | Ops infrastructure |

The same pattern emerges: NodeFleet has **strong engineering foundations** (API design, database modeling, documentation, WebSocket pipeline) but **lacks the operational infrastructure** (monitoring, backups, testing, security hardening) needed for production deployment.

---

*Generated 2026-03-29 — NodeFleet v0.1.0*
