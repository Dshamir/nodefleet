# NodeFleet API Reference

Base URL: `http://localhost:8888`

## Authentication

All protected endpoints require authentication via one of two methods:

1. **Session cookie** -- Obtained via NextAuth login (browser-based usage).
2. **API key** -- Pass a Bearer token in the `Authorization` header: `Authorization: Bearer nf_XXXXXXXX_YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY`. The middleware (`authenticateRequest()`) checks for a valid session cookie first; if none is found, it looks for a Bearer API key. On each successful API key request, the server updates the key's `lastUsedAt` timestamp and checks the `expiresAt` field (expired keys are rejected with `401`).

Device endpoints (heartbeat, pair) require a Bearer JWT token (not an API key) in the `Authorization` header.

---

## Auth Endpoints

### Get CSRF Token

```
POST /api/auth/csrf
```

Returns a CSRF token required for login and logout requests.

**Response (200):**

```json
{
  "csrfToken": "abc123..."
}
```

### Login

```
POST /api/auth/callback/credentials
```

**Content-Type:** `application/x-www-form-urlencoded`

| Field       | Type   | Required | Description          |
|-------------|--------|----------|----------------------|
| email       | string | Yes      | User email address   |
| password    | string | Yes      | User password        |
| csrfToken   | string | Yes      | Token from /api/auth/csrf |

**Response:** `302` redirect with `Set-Cookie` session header.

### Logout

```
POST /api/auth/signout
```

**Content-Type:** `application/x-www-form-urlencoded`

| Field       | Type   | Required | Description          |
|-------------|--------|----------|----------------------|
| csrfToken   | string | Yes      | Token from /api/auth/csrf |

**Response:** `302` redirect. Session cookie is cleared.

### Get Current Session

```
GET /api/auth/session
```

Returns the current authenticated user session. Requires session cookie.

**Response (200):**

```json
{
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "name": "User Name",
    "orgId": "clx..."
  },
  "expires": "2026-04-21T00:00:00.000Z"
}
```

Returns an empty object `{}` if not authenticated.

### Update Profile

```
PATCH /api/auth/profile
```

Updates the authenticated user's name and/or email.

**Content-Type:** `application/json`

| Field | Type   | Required | Description        |
|-------|--------|----------|--------------------|
| name  | string | No       | New display name   |
| email | string | No       | New email address  |

**Response (200):**

```json
{
  "id": "clx...",
  "name": "Updated Name",
  "email": "newemail@example.com"
}
```

### Change Password

```
POST /api/auth/change-password
```

Changes the authenticated user's password. The old password is verified with bcrypt before updating.

**Content-Type:** `application/json`

| Field           | Type   | Required | Description              |
|-----------------|--------|----------|--------------------------|
| currentPassword | string | Yes      | Current password         |
| newPassword     | string | Yes      | New password (min 8 chars) |
| confirmPassword | string | Yes      | Must match newPassword   |

**Response (200):**

```json
{
  "message": "Password changed successfully"
}
```

**Error (400):**

```json
{
  "error": "Current password is incorrect"
}
```

### Delete Account

```
DELETE /api/auth/delete-account
```

Permanently deletes the authenticated user's account. Requires password confirmation. If the user is the sole owner of an organization, the organization and all its data are also deleted (cascade).

**Content-Type:** `application/json`

| Field    | Type   | Required | Description                     |
|----------|--------|----------|---------------------------------|
| password | string | Yes      | Current password for confirmation |

**Response (200):**

```json
{
  "message": "Account deleted successfully"
}
```

**Error (400):**

```json
{
  "error": "Incorrect password"
}
```

---

## Registration

### Create Account

```
POST /api/register
```

**Content-Type:** `application/json`

| Field    | Type   | Required | Description              |
|----------|--------|----------|--------------------------|
| email    | string | Yes      | User email address       |
| password | string | Yes      | User password            |
| name     | string | Yes      | Display name             |
| orgName  | string | Yes      | Organization name        |

**Response (201):**

```json
{
  "id": "clx...",
  "email": "user@example.com",
  "name": "User Name",
  "orgId": "clx..."
}
```

---

## Devices

All device endpoints require session cookie authentication unless otherwise noted.

### List Devices

```
GET /api/devices
```

**Query Parameters:**

| Parameter | Type   | Default | Description                          |
|-----------|--------|---------|--------------------------------------|
| search    | string | -       | Filter by name or serial number      |
| status    | string | -       | Filter by status (ONLINE, OFFLINE, etc.) |
| fleet     | string | -       | Filter by fleet ID                   |
| page      | number | 1       | Page number                          |
| limit     | number | 20      | Items per page                       |

**Response (200):**

```json
{
  "data": [
    {
      "id": "clx...",
      "name": "Lobby Display",
      "hwModel": "RPi4",
      "serialNumber": "SN-001",
      "status": "ONLINE",
      "lastSeen": "2026-03-21T12:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1 }
}
```

### Create Device

```
POST /api/devices
```

**Content-Type:** `application/json`

| Field           | Type   | Required | Description                        |
|-----------------|--------|----------|------------------------------------|
| name            | string | Yes      | Device display name                |
| hwModel         | string | Yes      | Hardware model                     |
| serialNumber    | string | Yes      | Unique serial number (checked for uniqueness; returns 409 if duplicate) |
| fleetId         | string | No       | Fleet ID to assign the device to   |
| firmwareVersion | string | No       | Initial firmware version string    |

**Response (201):**

```json
{
  "id": "clx...",
  "name": "Lobby Display",
  "hwModel": "RPi4",
  "serialNumber": "SN-001",
  "pairingCode": "A1B2C3",
  "pairingCodeExpiresAt": "2026-03-22T12:00:00.000Z",
  "status": "PENDING"
}
```

### Get Device

```
GET /api/devices/[id]
```

Returns device details with latest telemetry data.

**Response (200):**

```json
{
  "id": "clx...",
  "name": "Lobby Display",
  "hwModel": "RPi4",
  "serialNumber": "SN-001",
  "status": "ONLINE",
  "lastSeen": "2026-03-21T12:00:00.000Z",
  "telemetry": {
    "cpuUsage": 45.2,
    "memUsage": 62.1,
    "diskUsage": 38.0,
    "temperature": 55.3,
    "uptime": 86400
  }
}
```

### Update Device

```
PATCH /api/devices/[id]
```

**Content-Type:** `application/json`

**Content-Type:** `application/json`

| Field                 | Type    | Required | Description                                                                 |
|-----------------------|---------|----------|-----------------------------------------------------------------------------|
| name                  | string  | No       | Device display name                                                         |
| hwModel               | string  | No       | Hardware model string                                                       |
| fleetId               | string  | No       | Fleet ID to reassign the device to (or `null` to unassign)                  |
| firmwareVersion       | string  | No       | Firmware version string                                                     |
| status                | string  | No       | Device status (online, offline, pairing, disabled)                          |
| metadata              | object  | No       | Arbitrary JSON metadata                                                     |
| regeneratePairingCode | boolean | No       | When `true`, generates a new 6-character pairing code, resets the 24-hour expiry window, and sets the device status to `"pairing"` |

**Response (200):** Updated device object. When `regeneratePairingCode` was `true`, the response includes the new `pairingCode` and `pairingCodeExpiresAt` fields.

### Delete Device

```
DELETE /api/devices/[id]
```

**Response (204):** No content.

### Pair Device

```
POST /api/devices/pair
```

**Content-Type:** `application/json`

| Field       | Type   | Required | Description                |
|-------------|--------|----------|----------------------------|
| pairingCode | string | Yes      | Code from device creation  |

**Response (200):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "deviceId": "clx...",
  "orgId": "clx...",
  "deviceName": "Lobby Display",
  "wsUrl": "ws://localhost:8081"
}
```

The pairing code expires 24 hours after device creation. If expired, the server returns `410 Gone`. On success the device status is set to `"online"` and the token is stored in the `device_tokens` table. The returned JWT (valid for 365 days) is used for subsequent device-to-server communication (heartbeat, WebSocket connection, etc.).

### Submit Telemetry (Heartbeat)

```
POST /api/devices/heartbeat
```

**Authorization:** `Bearer <device-jwt-token>`

**Content-Type:** `application/json`

| Field       | Type   | Required | Description              |
|-------------|--------|----------|--------------------------|
| cpuUsage    | number | No       | CPU usage percentage     |
| memUsage    | number | No       | Memory usage percentage  |
| diskUsage   | number | No       | Disk usage percentage    |
| temperature | number | No       | Temperature in Celsius   |
| uptime      | number | No       | Uptime in seconds        |
| lat         | number | No       | GPS latitude             |
| lng         | number | No       | GPS longitude            |

**Response (200):**

```json
{
  "status": "ok"
}
```

### Send Command to Device

```
POST /api/devices/[id]/command
```

**Content-Type:** `application/json`

| Field   | Type   | Required | Description                  |
|---------|--------|----------|------------------------------|
| command | string | Yes      | Command type (e.g., REBOOT, UPDATE, PLAY) |
| payload | object | No       | Additional command data      |

**Response (200):**

```json
{
  "id": "clx...",
  "command": "REBOOT",
  "status": "PENDING",
  "createdAt": "2026-03-21T12:00:00.000Z"
}
```

### Get Telemetry History

```
GET /api/devices/[id]/telemetry
```

**Query Parameters:**

| Parameter | Type   | Default | Description                    |
|-----------|--------|---------|--------------------------------|
| from      | string | -       | ISO 8601 start date            |
| to        | string | -       | ISO 8601 end date              |
| limit     | number | 100     | Maximum number of records      |

**Response (200):**

```json
{
  "data": [
    {
      "cpuUsage": 45.2,
      "memUsage": 62.1,
      "diskUsage": 38.0,
      "temperature": 55.3,
      "uptime": 86400,
      "createdAt": "2026-03-21T12:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 100, "total": 1 }
}
```

### Get GPS Track

```
GET /api/devices/[id]/gps
```

**Query Parameters:**

| Parameter | Type   | Default | Description                    |
|-----------|--------|---------|--------------------------------|
| from      | string | -       | ISO 8601 start date            |
| to        | string | -       | ISO 8601 end date              |
| limit     | number | 100     | Maximum number of points       |

**Response (200):**

```json
{
  "data": [
    {
      "lat": 40.7128,
      "lng": -74.0060,
      "createdAt": "2026-03-21T12:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 100, "total": 1 }
}
```

---

## Content / Media

All content endpoints require session cookie authentication.

### List Media Files

```
GET /api/content
```

**Query Parameters:**

| Parameter | Type   | Default     | Description                                                                 |
|-----------|--------|-------------|-----------------------------------------------------------------------------|
| deviceId  | string | -           | Filter by source device ID. Use `none` for files with no associated device. |
| type      | string | -           | Filter by media type (`image`, `video`, `audio`, `document`).               |
| search    | string | -           | Search by filename (case-insensitive partial match).                        |
| page      | number | 1           | Page number.                                                                |
| limit     | number | 20          | Items per page.                                                             |

**Response (200):**

```json
{
  "data": [
    {
      "id": "clx...",
      "filename": "promo-video.mp4",
      "contentType": "video/mp4",
      "size": 10485760,
      "deviceId": "clx...",
      "deviceName": "Lobby Camera",
      "createdAt": "2026-03-21T12:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1 }
}
```

### Create Media Record

```
POST /api/content
```

**Content-Type:** `application/json`

Creates a media record in the database.

**Response (201):** Created media object.

### Get Presigned Upload URL

```
POST /api/content/upload
```

**Content-Type:** `application/json`

| Field       | Type   | Required | Description           |
|-------------|--------|----------|-----------------------|
| filename    | string | Yes      | Original filename     |
| contentType | string | Yes      | MIME type             |
| size        | number | Yes      | File size in bytes    |

**Response (200):**

```json
{
  "uploadUrl": "https://s3.amazonaws.com/bucket/...",
  "contentId": "clx..."
}
```

### Get Presigned Download URL

```
GET /api/content/[id]
```

**Response (200):**

```json
{
  "downloadUrl": "https://s3.amazonaws.com/bucket/...",
  "filename": "promo-video.mp4",
  "contentType": "video/mp4"
}
```

### Delete File

```
DELETE /api/content/[id]
```

**Response (204):** No content. Removes both the database record and the S3 object.

---

## Schedules

All schedule endpoints require session cookie authentication.

### List Schedules

```
GET /api/schedules
```

**Response (200):**

```json
{
  "data": [
    {
      "id": "clx...",
      "name": "Morning Rotation",
      "cronExpression": "0 8 * * *",
      "repeatType": "DAILY",
      "createdAt": "2026-03-21T12:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1 }
}
```

### Create Schedule

```
POST /api/schedules
```

**Content-Type:** `application/json`

| Field          | Type     | Required | Description                        |
|----------------|----------|----------|------------------------------------|
| name           | string   | Yes      | Schedule name                      |
| description    | string   | No       | Schedule description               |
| cronExpression | string   | No       | Cron expression for timing (e.g., `0 8 * * *`) |
| repeatType     | string   | Yes      | ONCE, DAILY, WEEKLY, MONTHLY       |
| isActive       | boolean  | No       | Whether the schedule is active (default `true`) |
| conditions     | object   | No       | Execution conditions JSONB (e.g., `{ "batteryBelow": 20, "tempAbove": 60 }`). Task only executes when all conditions are met. |
| items          | array    | Yes      | Array of schedule item objects (see below) |
| deviceIds      | string[] | Yes      | Array of device IDs to assign      |

**Schedule Item Object:**

| Field           | Type   | Required | Description                                                                 |
|-----------------|--------|----------|-----------------------------------------------------------------------------|
| command         | string | Yes      | Command enum: `capture_photo`, `capture_video`, `record_audio`, `stream_video`, `reboot`, `update_firmware`, `custom` |
| commandPayload  | object | No       | Additional data for the command (e.g., `{ "url": "https://..." }` for `update_firmware`) |
| orderIndex      | number | Yes      | Execution order (0-based)                                                   |
| durationSeconds | number | No       | Duration in seconds for timed commands (e.g., video recording length)       |

**Response (201):** Created schedule object with items and assignments.

### Get Schedule

```
GET /api/schedules/[id]
```

Returns the schedule with its items and device assignments.

**Response (200):**

```json
{
  "id": "clx...",
  "name": "Morning Rotation",
  "cronExpression": "0 8 * * *",
  "repeatType": "DAILY",
  "isActive": true,
  "conditions": { "batteryBelow": 20 },
  "items": [
    {
      "command": "capture_photo",
      "commandPayload": {},
      "orderIndex": 0,
      "durationSeconds": null
    }
  ],
  "devices": [
    {
      "id": "clx...",
      "name": "Lobby Display"
    }
  ]
}
```

### Update Schedule

```
PATCH /api/schedules/[id]
```

**Content-Type:** `application/json`

| Field          | Type     | Required | Description                                                                 |
|----------------|----------|----------|-----------------------------------------------------------------------------|
| name           | string   | No       | Schedule name                                                               |
| description    | string   | No       | Schedule description                                                        |
| repeatType     | string   | No       | ONCE, DAILY, WEEKLY, MONTHLY                                                |
| cronExpression | string   | No       | Cron expression for timing                                                  |
| isActive       | boolean  | No       | Whether the schedule is active                                              |
| conditions     | object   | No       | Execution conditions JSONB                                                  |
| items          | array    | No       | Array of schedule item objects (replaces all existing items when provided)   |
| deviceIds      | string[] | No       | Array of device IDs (replaces all existing assignments when provided)        |

**Response (200):** Updated schedule object with items and device assignments.

### Delete Schedule

```
DELETE /api/schedules/[id]
```

**Response (204):** No content.

---

## Fleets

All fleet endpoints require session cookie authentication.

### List Fleets

```
GET /api/fleets
```

**Response (200):**

```json
{
  "data": [
    {
      "id": "clx...",
      "name": "HQ Office",
      "description": "Main headquarters",
      "location": "San Francisco, CA",
      "latitude": 37.7749,
      "longitude": -122.4194,
      "createdAt": "2026-03-21T12:00:00.000Z"
    }
  ]
}
```

### Create Fleet

```
POST /api/fleets
```

**Content-Type:** `application/json`

| Field       | Type   | Required | Description                |
|-------------|--------|----------|----------------------------|
| name        | string | Yes      | Fleet name                 |
| description | string | No       | Fleet description          |
| location    | string | No       | Human-readable location    |
| latitude    | number | No       | GPS latitude               |
| longitude   | number | No       | GPS longitude              |

**Response (201):** Created fleet object.

### Get Fleet

```
GET /api/fleets/[id]
```

**Response (200):** Fleet object with associated devices.

### Update Fleet

```
PATCH /api/fleets/[id]
```

**Content-Type:** `application/json`

Accepts any subset of fleet fields (`name`, `description`, `location`, `latitude`, `longitude`).

**Response (200):** Updated fleet object.

### Delete Fleet

```
DELETE /api/fleets/[id]
```

**Response (204):** No content.

---

## Organization

All organization endpoints require session cookie authentication.

### Get Organization

```
GET /api/org
```

Returns the current user's organization details including a human-readable identifier, stats, and owner info.

**Response (200):**

```json
{
  "id": "clx...",
  "name": "Test Organization",
  "slug": "test-org",
  "readableId": "NF-TESTORGA-64E58D",
  "plan": "pro",
  "stats": {
    "devices": 5,
    "media": 12,
    "members": 3,
    "plan": "pro"
  },
  "owner": {
    "id": "clx...",
    "name": "Owner Name",
    "email": "owner@example.com"
  }
}
```

### Update Organization

```
PATCH /api/org
```

Updates the organization name. Requires `owner` or `admin` role.

**Content-Type:** `application/json`

| Field | Type   | Required | Description          |
|-------|--------|----------|----------------------|
| name  | string | Yes      | New organization name |

**Response (200):**

```json
{
  "id": "clx...",
  "name": "Updated Org Name",
  "slug": "test-org"
}
```

**Error (403):**

```json
{
  "error": "Only owner or admin can update organization"
}
```

---

## API Keys

All API key endpoints require session cookie authentication. Keys are scoped to the authenticated user and their organization.

### List API Keys

```
GET /api/keys
```

Returns all API keys for the current user. Only the key prefix is shown (not the full key).

**Response (200):**

```json
{
  "keys": [
    {
      "id": "clx...",
      "name": "Production Key",
      "keyPrefix": "nf_a1b2c3d4",
      "lastUsedAt": null,
      "expiresAt": null,
      "createdAt": "2026-03-21T12:00:00.000Z"
    }
  ]
}
```

### Generate API Key

```
POST /api/keys
```

Generates a new API key. The full key is returned only in this response and cannot be retrieved again.

The key format is `nf_<8char>_<32char>`, generated by SHA-256 hashing `org+user+salt`.

**Content-Type:** `application/json`

| Field     | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| name      | string | Yes      | Descriptive name for key |
| expiresAt | string | No       | ISO 8601 expiration date |

**Response (201):**

```json
{
  "id": "clx...",
  "name": "Production Key",
  "key": "nf_a1b2c3d4_e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
  "keyPrefix": "nf_a1b2c3d4",
  "createdAt": "2026-03-21T12:00:00.000Z"
}
```

> **Important:** The `key` field is only included in the creation response. Store it securely -- it cannot be retrieved later.

### Revoke API Key

```
DELETE /api/keys/[id]
```

Permanently revokes an API key.

**Response (200):**

```json
{
  "message": "API key revoked"
}
```

**Error (404):**

```json
{
  "error": "API key not found"
}
```

---

## Discovery

### Scan Network for Devices

```
GET /api/discovery
```

Probes the ws-server discovery service on UDP port 5555 and broadcasts on UDP port 5556 to find ESP32 devices on the local network. The scan runs with a 3-second timeout.

**Authentication:** Session cookie or API key.

**Response (200):**

```json
{
  "serverDiscoveryOnline": true,
  "devices": [
    {
      "ip": "192.168.1.50",
      "port": 5556,
      "response": {
        "serialNumber": "SN-ESP32-001",
        "hwModel": "ESP32-S3",
        "firmware": "1.0.0",
        "status": "ready",
        "ip": "192.168.1.50"
      },
      "discoveredAt": "2026-03-22T10:00:01.234Z"
    }
  ],
  "scannedAt": "2026-03-22T10:00:03.500Z",
  "message": "Scan complete. Found 1 device(s)."
}
```

| Field | Type | Description |
|-------|------|-------------|
| serverDiscoveryOnline | boolean | Whether the ws-server discovery service (port 5555) responded |
| devices | array | ESP32 devices that responded to the UDP 5556 broadcast |
| devices[].ip | string | IP address of the discovered device |
| devices[].port | number | UDP port the device responded from |
| devices[].response | object | JSON payload returned by the device |
| devices[].discoveredAt | string | ISO 8601 timestamp when the response was received |
| scannedAt | string | ISO 8601 timestamp when the scan completed |
| message | string | Human-readable summary |

---

## Dashboard

### Get Dashboard Stats

```
GET /api/dashboard/stats
```

Returns real-time aggregate statistics from the database.

**Response (200):**

```json
{
  "totalDevices": 5,
  "onlineDevices": 3,
  "mediaFiles": 6,
  "storageUsed": 52428800,
  "activity": 12
}
```

---

## Webhooks

### Stripe Webhook

```
POST /api/webhooks/stripe
```

Handles incoming Stripe webhook events. This endpoint verifies the `Stripe-Signature` header against the configured `STRIPE_WEBHOOK_SECRET`. Do not call this endpoint directly; it is invoked by Stripe.

---

## Curl Examples

### Login

Obtain a CSRF token first, then authenticate:

```bash
# Step 1: Get CSRF token
CSRF=$(curl -s http://localhost:8888/api/auth/csrf | jq -r '.csrfToken')

# Step 2: Login with credentials
curl -v -X POST http://localhost:8888/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=admin@example.com&password=test1234&csrfToken=${CSRF}" \
  -c cookies.txt

# Step 3: Verify session
curl -s http://localhost:8888/api/auth/session -b cookies.txt | jq
```

### Create a Device

```bash
curl -s -X POST http://localhost:8888/api/devices \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Lobby Display",
    "hwModel": "RPi4",
    "serialNumber": "SN-001"
  }' | jq
```

### Send a Command to a Device

```bash
curl -s -X POST http://localhost:8888/api/devices/DEVICE_ID/command \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "command": "REBOOT",
    "payload": {}
  }' | jq
```

Replace `DEVICE_ID` with the actual device ID returned from the create or list endpoints.

### Full Device Pairing Flow

This is the complete end-to-end pairing sequence:

```
1. Dashboard user: Add Device
   POST /api/devices  { "name": "...", "hwModel": "...", "serialNumber": "..." }
   → Server returns 6-character pairingCode (e.g., "A1B2C3") valid for 24 hours
   → Serial number must be unique (409 if duplicate)

2. ESP32 device: Call Pair API
   POST /api/devices/pair  { "pairingCode": "A1B2C3" }
   → Server checks code exists and has not expired (410 if expired)
   → Server sets device status to "online"
   → Server generates JWT token (365 days) and stores it in device_tokens table
   → Returns: { "token": "eyJ...", "deviceId": "...", "orgId": "...", "wsUrl": "ws://..." }

3. ESP32 device: Connect WebSocket
   ws://<server>:8081/device?token=eyJ...
   → Device is now online and appears on the dashboard

4. ESP32 device: Send heartbeats and telemetry
   → Heartbeats keep the device marked as "online"
   → GPS, battery, signal data appears in the dashboard
```

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "error": "Description of what went wrong"
}
```

Common HTTP status codes:

| Code | Meaning                |
|------|------------------------|
| 400  | Bad request / validation error |
| 401  | Not authenticated      |
| 403  | Not authorized         |
| 404  | Resource not found     |
| 409  | Conflict (duplicate)   |
| 500  | Internal server error  |
