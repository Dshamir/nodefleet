# NodeFleet API Routes Summary

## Overview
Complete Next.js API routes for the device fleet management platform (28 endpoints). All routes implement production-grade error handling, authentication, authorization, and database operations using Drizzle ORM.

## Created Routes

### Authentication (5 routes)
- **GET/POST /api/auth/[...nextauth]/route.ts**
  - Exports NextAuth handlers (GET, POST)
  - Delegates to auth configuration

- **PATCH /api/auth/profile/route.ts**
  - Update user profile (name, email)

- **POST /api/auth/change-password/route.ts**
  - Change password (requires current password verification)

- **DELETE /api/auth/delete-account/route.ts**
  - Delete user account (requires password confirmation)

### Device Management (11 routes)

#### Core Device Routes
1. **GET/POST /api/devices/route.ts**
   - GET: List org devices with pagination, search, and status filtering
   - POST: Create new device, generates pairing code (24-hour expiry)
   - Pagination: page, limit, total, pages

2. **GET/PATCH/DELETE /api/devices/[id]/route.ts**
   - GET: Device details with recent telemetry (10) and GPS (10) records
   - PATCH: Update name, description, metadata
   - DELETE: Remove device (cascades related records)

#### Device Pairing & Communication
3. **POST /api/devices/pair/route.ts**
   - Validates pairing code (24-hour window expiry check)
   - Generates device JWT token (365-day expiry)
   - Marks device as "paired", clears pairing code
   - Returns: deviceId, deviceToken, expiresIn

4. **POST /api/devices/heartbeat/route.ts**
   - Device authentication via Bearer token (JWT)
   - Body: battery, signal, cpuTemp, freeMemory, uptime
   - Updates lastHeartbeatAt, inserts telemetry record
   - Marks device as "online"

#### Telemetry & GPS Routes
5. **GET /api/devices/[id]/telemetry/route.ts**
   - Query params: from, to, limit, page
   - Paginated telemetry history
   - Date range filtering with ISO validation

6. **GET /api/devices/[id]/gps/route.ts**
   - Query params: from, to, limit, page
   - Paginated GPS track points
   - Date range filtering with ISO validation

#### Device Commands
7. **POST /api/devices/[id]/command/route.ts**
   - Body: { command, payload }
   - Creates deviceCommand with "pending" status
   - Publishes to Redis for WebSocket delivery
   - Returns: commandId, status, command, payload

### Media/Content Management (3 routes)

8. **GET/POST /api/content/route.ts**
   - GET: List org media with type filter, pagination, search
   - POST: Create media record after upload
   - Supports: image, video, document, other types

9. **POST /api/content/upload/route.ts**
   - Generates presigned S3/MinIO upload URL
   - Body: { filename, contentType, size }
   - Max 500MB per file
   - Returns: { uploadUrl, s3Key, fileId, expiresIn }

10. **GET/DELETE /api/content/[id]/route.ts**
    - GET: Presigned download URL for file
    - DELETE: Remove from S3 + DB
    - File lifecycle management

### Schedules (2 routes)

11. **GET/POST /api/schedules/route.ts**
    - GET: List org schedules with pagination
    - POST: Create schedule with items and device assignments
    - Items: sequence, contentType, contentId, duration, metadata
    - Assigns to multiple devices

12. **GET/PATCH/DELETE /api/schedules/[id]/route.ts**
    - GET: Schedule with items and assignments
    - PATCH: Update name, description
    - DELETE: Cascade delete items and assignments

### User Management

13. **POST /api/register/route.ts**
    - Register new user + auto-create org
    - Body: { email, password, name, orgName }
    - Password: bcrypt hashed (salt=10)
    - Creates: user, organization, orgMember (owner role)
    - Returns user and org details

### Fleets (2 routes)

14. **GET/POST /api/fleets/route.ts**
    - GET: List org fleets
    - POST: Create fleet with name, description, location, lat/lng

15. **GET/PATCH/DELETE /api/fleets/[id]/route.ts**
    - GET: Fleet details
    - PATCH: Update fleet fields
    - DELETE: Remove fleet

### Organization (1 route)

16. **GET/PATCH /api/org/route.ts**
    - GET: Organization details
    - PATCH: Update organization name/settings

### API Keys (2 routes)

17. **GET/POST /api/keys/route.ts**
    - GET: List API keys for the user
    - POST: Generate a new API key

18. **DELETE /api/keys/[id]/route.ts**
    - Revoke (delete) an API key

### Dashboard (1 route)

19. **GET /api/dashboard/stats/route.ts**
    - Returns dashboard statistics (device counts, media counts, etc.)

### Discovery (1 route)

20. **GET /api/discovery/route.ts**
    - Network device scan (UDP broadcast on port 5556, ws-server discovery on port 5555)

### Webhooks

21. **POST /api/webhooks/stripe/route.ts**
    - Handles: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
    - Verifies webhook signature
    - Updates org subscription info
    - Strips subscription on deletion

## Authentication Patterns

### Dashboard Routes (User Auth)
- Uses `await auth()` to get session
- Verifies `session.user.id` exists
- Looks up org via `orgMembers` table
- Returns 401 for missing auth, 403 for no org

### Device Routes (Token Auth)
- Uses `Bearer <JWT>` from Authorization header
- Verifies token with `NEXTAUTH_SECRET`
- Extracts `deviceId` and `orgId` claims
- Returns 401 for missing/invalid token

## Validation

All routes use Zod for request validation:
- createDeviceSchema: name, description, type, metadata
- updateDeviceSchema: partial name, description, metadata
- heartbeatSchema: battery, signal, cpuTemp, freeMemory, uptime
- pairDeviceSchema: pairingCode
- createScheduleSchema: name, description, items[], deviceIds[]
- registerSchema: email, password, name, orgName
- uploadSchema: filename, contentType, size (max 500MB)

## Database Imports
```typescript
import { db } from "@/lib/db";
import {
  devices, telemetry, gpsData, deviceCommands,
  mediaFiles, schedules, scheduleItems, scheduleDeviceAssignments,
  users, organizations, orgMembers
} from "@/lib/db/schema";
```

## Key Features

- **Pagination**: page, limit with total count and page math
- **Search**: Case-insensitive search using ilike
- **Filtering**: Status filters, date ranges (from/to)
- **Error Handling**: 400 (validation), 401 (auth), 403 (forbidden), 404 (not found), 409 (conflict)
- **Date Handling**: ISO 8601 validation, null coalescing
- **Cascading Deletes**: Schedule items and assignments delete with schedule
- **Redis Integration**: Command publishing for real-time delivery
- **S3/MinIO Support**: Presigned URLs, file lifecycle
- **Stripe Integration**: Subscription management with price ID mapping

## Required Environment Variables
- `NEXTAUTH_SECRET` - JWT signing key
- `STRIPE_SECRET_KEY` - Stripe API key
- `STRIPE_WEBHOOK_SECRET` - Webhook signature verification
- `STRIPE_PRICE_ID_PRO` - Pro plan price ID
- `STRIPE_PRICE_ID_BUSINESS` - Business plan price ID

## File Paths
All routes are located at `/sessions/optimistic-pensive-pasteur/mnt/outputs/nodefleet/web/src/app/api/`
