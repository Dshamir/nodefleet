# NodeFleet API Reference

Base URL: `http://localhost:8888`

## Authentication

All protected endpoints require a session cookie obtained via NextAuth login. Device endpoints (heartbeat, pair) require a Bearer JWT token in the `Authorization` header.

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

| Field        | Type   | Required | Description           |
|--------------|--------|----------|-----------------------|
| name         | string | Yes      | Device display name   |
| hwModel      | string | Yes      | Hardware model        |
| serialNumber | string | Yes      | Unique serial number  |

**Response (201):**

```json
{
  "id": "clx...",
  "name": "Lobby Display",
  "hwModel": "RPi4",
  "serialNumber": "SN-001",
  "pairingCode": "ABCD-1234",
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

Accepts any subset of device fields (`name`, `hwModel`, `serialNumber`).

**Response (200):** Updated device object.

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
  "deviceId": "clx..."
}
```

The returned JWT token is used for subsequent device-to-server communication (heartbeat, etc.).

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

**Response (200):**

```json
{
  "data": [
    {
      "id": "clx...",
      "filename": "promo-video.mp4",
      "contentType": "video/mp4",
      "size": 10485760,
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
| cronExpression | string   | Yes      | Cron expression for timing         |
| repeatType     | string   | Yes      | ONCE, DAILY, WEEKLY, MONTHLY       |
| conditions     | object   | No       | Execution conditions JSONB (e.g., `{ "batteryBelow": 20, "tempAbove": 60 }`). Task only executes when all conditions are met. |
| items          | array    | Yes      | Array of content IDs and durations |
| deviceIds      | string[] | Yes      | Array of device IDs to assign      |

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
  "items": [
    {
      "contentId": "clx...",
      "duration": 30,
      "order": 1
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

Accepts any subset of schedule fields.

**Response (200):** Updated schedule object.

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
