# Changelog

## [2.1.0] - 2026-03-29

### Full Admin Console Release

Complete SaaS admin console adapted from Zenzers patterns with 15 additional modules.

### Added

#### Shared UI Components
- **DetailDrawer** — Right-slide overlay with DrawerTabs for detail views
- **FilterTabs** — Horizontal status/type filter bar with count badges
- **StatusBadge** — Universal color-mapped badge (60+ statuses, roles, types)

#### Users & Auth (2 new tables)
- Access Control — Role list + 15x5 permission grid
- Authentication Settings — Sessions, Passwords, MFA tabs
- OTP Settings — Code length, format, expiry, rate limit configuration

#### Security (5 new tables)
- Fraud Detection — 3-tab overview (Events, Blocklist, Rules) with severity/status badges
- Content Policy — Policy cards with type/action badges, enable toggles
- Rate Limits — Rule table with scope badges, create modal
- Credentials Vault — Type badges, reveal/rotate, expiry tracking

#### Content (4 new tables)
- CMS / Content — Page manager with status/type filters, editor
- Messaging — SMTP config, email templates, logs
- Chat — Split-view conversation manager with message thread

#### AI & Prompts (3 new tables)
- AI Settings — Provider cards (OpenAI/Anthropic/Google/Azure), API key management
- Custom Agents — Agent builder with system prompts, category badges
- Prompt Templates — Variable extraction, category filter, slug auto-generation

#### Knowledge Base (2 new tables)
- Knowledge Base — Article manager with stats, categories, markdown editor, view counts

#### Page Upgrades (adapted from Zenzers patterns)
- Platform Admin Dashboard — 6 stat cards, health table (10s refresh), audit activity, quick actions
- Organizations — Search, plan filters, detail drawer with device usage
- Users — Avatar initials, role badges, detail drawer
- Orders — Status transitions, detail drawer (Details/Items/Timeline tabs)
- Customers — Tag management, detail drawer (Profile/Orders/Activity tabs)
- Inventory — Stock qty badges (red/amber/green), restock dialog
- CRM — Pipeline breakdown bars, conversion rate cards
- Leads — Dual table/pipeline view, 7-stage kanban columns
- Campaigns — Create dialog, type/status badges
- Feature Flags — Toggle cards, rollout % slider
- Dev Wiki — Section sidebar, write/preview tabs

### Architecture
- 80+ database tables (was 65)
- 100+ API routes (was 80)
- 65+ dashboard pages (was 50)
- 10 sidebar module groups (was 5)
- 21 RBAC resources (was 15)

---

## [2.0.0] - 2026-03-29

### SaaS Platform Release

Major evolution from single-tenant IoT dashboard to full multi-tenant SaaS platform.

### Added

#### Foundation
- **ReBAC Permission Engine** — Declarative permission matrix (15 resources x 5 actions, 5 role levels)
- **Auth Wrapper** (`withAuth()`) — Higher-order function for API route handlers with automatic auth + role checking
- **Platform Admin Role** — SaaS operator super-role with dedicated admin console
- **OTP / 2FA** — TOTP-based two-factor authentication via `otpauth` library
- **Self-hosted Email** — Nodemailer SMTP service with Mailhog for dev (6 HTML templates)
- **Notification System** — In-app + email channels with read/unread tracking

#### Commerce (18 new tables)
- Products, variants, and categories
- Orders with items, status history, and auto-numbering (ORD-000001)
- Payments and refunds (Stripe integration)
- Invoices with auto-numbering (INV-000001)
- Shipping methods and shipment tracking
- Tax rates and exemptions
- Promo codes (percentage/fixed/free_shipping)
- Cart with abandonment tracking
- Inventory movements (in/out/adjustment)
- Customer profiles with lifetime value

#### CRM & Marketing (8 new tables)
- Contacts with status pipeline and custom fields
- Contact notes and activity tracking
- Leads with deal value and probability
- Lead forms with JSON schema builder
- Lead form submissions
- Campaigns (email/sms/push) with audience targeting
- Lead scoring rules

#### Analytics & SEO (4 new tables)
- Page view tracking
- Custom analytics events
- SEO settings (meta tags, OG, robots, GA ID)
- Custom domain management with DNS verification

#### Operations (1 new table)
- Feature flags with rollout percentages
- Database health explorer
- Network topology status
- Notification center (in-app inbox)

#### Development (4 new tables)
- Dev tickets with priority and status workflows
- Repair plans linked to devices
- Version release tracking with changelogs
- Dev wiki with hierarchical pages

#### Platform Admin Console (Port 50301)
- Platform dashboard (org/user/device/MRR stats)
- Organization management
- User management
- Subscription analytics with MRR estimates
- Global audit trail
- Global feature flag control
- System health monitoring

#### Infrastructure
- Mailhog email service (SMTP 50025, Web UI 50826)
- nginx port 50301 for platform admin
- `./nodefleet.sh email` and `./nodefleet.sh admin` commands

### Fixed
- Stripe webhook field mismatches (`stripeSubscriptionId` → `subscriptionId`)
- `determinePlanFromPriceId()` env var names and "business" → "team" plan
- Device limit enforcement in POST /api/devices

### Architecture
- 65+ database tables (was 24)
- 80+ API routes (was 36)
- 50+ dashboard pages (was 9)
- 5 sidebar module groups (IoT, Commerce, Ranking, Operations, Development)
- Separate platform admin console on port 50301

## [1.0.0] - 2026-03-28

### Initial Release
- IoT device fleet management
- ESP32 firmware with WiFi, LTE, GPS, camera
- WebSocket + MQTT dual-protocol telemetry
- PostgreSQL + Redis + MinIO + Docker Compose
- Audit logging, webhooks, rate limiting
- Scored 8.5/10 across 25 gap analysis dimensions
