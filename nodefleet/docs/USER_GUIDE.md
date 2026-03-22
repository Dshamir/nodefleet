# NodeFleet User Guide

This guide covers how to use the NodeFleet platform as an end user and as a SaaS operator.

---

## Getting Started

### Registration

1. Navigate to `/register`.
2. Enter your name, email address, and password.
3. Enter an organization name.
4. Submit the form. This automatically creates a new organization on the **Free** plan, which includes 3 devices and 1 GB of storage.

### Login

1. Navigate to `/login`.
2. Enter your email and password.
3. On successful authentication, you will be redirected to the `/devices` dashboard.

### Logout

Click **"Sign Out"** in the sidebar to end your session.

---

## Dashboard Pages

### Devices (/devices)

The main dashboard page. Displays all devices belonging to your organization with their current status. All data is fetched from real APIs with zero hardcoded values. Features include:

- Search and filter devices by name, status, model, or fleet.
- View device details including last heartbeat time, battery level, and connectivity.
- Full CRUD: Create a device (returns a pairing code), edit device name, and delete with confirmation dialog.
- Click a device to open the **device detail page** with 4 tabs: Overview, Telemetry, GPS, and Commands. Send commands directly from the detail page.

### Map (/map)

An interactive Leaflet map with a dark theme for visualizing device locations.

- **Markers**: Green = online, Gray = offline, Yellow = pairing.
- **GPS Trails**: View historical movement paths for each device.
- **Coordinates Table**: A tabular view of device positions with latitude, longitude, and timestamp.

### Content Library (/content)

Browse and manage media files uploaded from your devices. The content library features an **inline media viewer** -- images are displayed inline, video and audio files have embedded players, all served via S3 presigned URLs with no downloads required. Click any media item to expand it in a full-size modal viewer.

**3-tier filter hierarchy:**

1. **Device filter (primary)** -- Dropdown to filter by source device. Options: All Devices, No Device, or a specific device name.
2. **Type filter (secondary)** -- Filter by media type: All Types, Images, Videos, Audio, Documents.
3. **Search (tertiary)** -- Text search by filename.

Each content card displays the device name it came from, making it easy to identify the source of any file at a glance.

Supported file types:

- Images (displayed inline with thumbnails)
- Video (embedded video player)
- Audio (embedded audio player)
- Documents

Upload new files directly from the browser via presigned URL to MinIO. Delete files with a confirmation dialog. Files are organized by device and upload date.

### Schedules (/schedules)

Create and manage automated tasks that run on cron schedules. Full CRUD support: create schedules with device assignments, toggle active/inactive, and delete with confirmation.

**Conditional execution:** Schedules support a `conditions` field that gates task execution. For example, set `batteryBelow: 20` to only run the task when the device battery is below 20%, or `tempAbove: 60` to trigger when CPU temperature exceeds 60 degrees C. Tasks only execute when all specified conditions are met.

Supported command types (used in schedule items):

- `capture_photo` -- Take a photo with the device camera
- `capture_video` -- Record a video clip
- `record_audio` -- Record an audio clip
- `stream_video` -- Start a live video stream
- `reboot` -- Restart the device
- `update_firmware` -- Push a firmware update
- `custom` -- Send a custom command with an arbitrary payload

Each schedule item specifies a `command`, an optional `commandPayload`, an `orderIndex` (execution order), and an optional `durationSeconds`.

Each schedule is assigned to one or more devices and runs according to the configured cron expression.

### Settings (/settings)

A fully functional settings page with 6 sections. All data is fetched from real APIs -- no hardcoded values.

#### Profile

Edit your display name and email address. Changes are saved via `PATCH /api/auth/profile`.

#### Organization

Displays your organization details:

- **Readable Org ID** -- A human-readable identifier in the format `NF-<PREFIX>-<HASH>` (e.g., `NF-TESTORGA-64E58D`). The prefix is derived from the first 8 characters of the org name, and the hash is the first 6 characters of a SHA-256 digest of `orgId:orgName:ownerEmail`.
- **Organization Name** -- Editable by users with the `owner` or `admin` role.
- **Stats Cards** -- Shows counts for devices, media files, members, and the current plan.
- **Slug** -- The URL-friendly organization identifier.
- **Owner Info** -- Name and email of the organization owner.

#### Change Password

Change your password by providing your current password, a new password, and a confirmation. The current password is verified with bcrypt on the server before the change is applied.

#### API Keys

Generate and manage API keys for programmatic access to NodeFleet:

- **Generate Key** -- Click "Generate" to create a new key. The key format is `nf_<8char>_<32char>`, derived from a SHA-256 hash of org + user + random salt. The full key is displayed **only once** with a copy button -- store it securely.
- **List Keys** -- View all your keys. Only the key prefix (e.g., `nf_a1b2c3d4`) is shown for security.
- **Revoke Key** -- Permanently delete a key. This action cannot be undone.

#### Billing

Links to `/settings/billing` where you can view your current subscription plan and upgrade.

#### Danger Zone

Permanently delete your account. Requires password confirmation before proceeding. If you are the sole owner of your organization, the organization and all its associated data (devices, media, members) will also be deleted.

### Billing (/settings/billing)

View your current subscription plan and upgrade to a higher tier.

---

## Plans and Limits

| Plan       | Price       | Devices   | Storage   |
|------------|-------------|-----------|-----------|
| Free       | $0          | 3         | 1 GB      |
| Pro        | $19.99/mo   | 50        | 50 GB     |
| Team       | $49.99/mo   | 100       | 500 GB    |
| Enterprise | Custom      | Unlimited | Unlimited |

---

## Fleet Management

Fleets allow you to group devices by physical location. Each fleet has a name, description, location label, and GPS coordinates (latitude/longitude).

### Creating a Fleet

1. Navigate to the Fleets section.
2. Click **"Create Fleet"** and enter a name, description, and location.
3. Optionally set latitude and longitude for map display.

### Assigning Devices to a Fleet

Devices have a `fleet_id` field. When creating or editing a device, select which fleet it belongs to. Filter the device list by fleet to see only devices at a specific location.

### Demo Fleets

The seed data includes 3 demo fleets:
- **HQ Office** -- San Francisco, CA
- **Warehouse West** -- Los Angeles, CA
- **Field Ops** -- Houston, TX

---

## Device Management

### Adding a Device

1. Click **"Add Device"** on the Devices page.
2. Fill in the required fields:
   - **Name** -- A display name for the device (e.g., "Lobby Camera").
   - **Hardware Model** (`hwModel`) -- The hardware model string (e.g., "ESP32-S3", "ESP32-CAM").
   - **Serial Number** (`serialNumber`) -- A unique serial number. The server rejects duplicates with a 409 error.
3. Optionally select a **Fleet** and enter a **Firmware Version**.
4. A 6-character pairing code is generated and displayed (valid for 24 hours). Copy this code -- you will need it for the ESP32 device.

### Editing a Device

Click on a device to open its detail page. Edit the device name inline and save.

### Deleting a Device

From the device list or detail page, click the delete button. A confirmation dialog appears before the device is permanently removed.

### Device Pairing

The complete pairing flow has three steps:

**Step 1: Add device in the dashboard**
- Create the device as described above. You receive a 6-character pairing code (e.g., `A1B2C3`) that expires in 24 hours.

**Step 2: ESP32 calls the Pair API**
- The ESP32 firmware sends `POST /api/devices/pair` with `{"pairingCode":"A1B2C3"}`.
- The server verifies the code, sets the device status to `"online"`, and returns a JWT token (valid 365 days), the `deviceId`, `orgId`, and `wsUrl`.
- The token is stored in the `device_tokens` table on the server and in NVS on the ESP32.

**Step 3: ESP32 connects via WebSocket**
- Using the `wsUrl` and `token` from the pair response, the ESP32 opens a WebSocket connection: `ws://<server>:8081/device?token=eyJ...`
- The device is now online and visible on the dashboard.
- The ESP32 sends periodic heartbeats, GPS coordinates, and telemetry data which appear in the device detail page.

### Device Auto-Discovery

ESP32 devices can automatically find the NodeFleet server on your local network:
- **UDP Broadcast**: Device sends "NODEFLEET_DISCOVER" to port 5555, server responds with connection URLs
- **mDNS**: Device resolves "nodefleet.local" to the server IP

No IP configuration needed on the device — just connect to the same network and the device finds the server automatically. See [Device Discovery](DEVICE_DISCOVERY.md) for firmware integration details.

### Device Statuses

| Status    | Description                                              |
|-----------|----------------------------------------------------------|
| online    | Device heartbeat received within the last 90 seconds.    |
| offline   | No heartbeat received within the timeout period.         |
| pairing   | Device has been registered but has not yet connected.     |
| disabled  | Device has been manually disabled by an administrator.    |

### Sending Commands

You can send the following commands to a connected device:

- `capture_photo` -- Take a photo with the device camera.
- `capture_video` -- Record a video clip.
- `record_audio` -- Record an audio clip.
- `stream_video` -- Start a live video stream.
- `reboot` -- Restart the device.
- `update_firmware` -- Push a firmware update to the device.
- `custom` -- Send a custom command with an arbitrary payload.

### Device Detail Page

Click any device to open its detail page at `/devices/[id]`. The detail page fetches real telemetry, GPS, and command data from the API. It has 4 tabs:

- **Overview** -- Device info, status, fleet assignment, and latest telemetry snapshot.
- **Telemetry** -- Historical telemetry charts and records.
- **GPS** -- Location history with map visualization.
- **Commands** -- Command history and a **Send Command** button to issue commands directly.

### Viewing Telemetry

Each device reports the following telemetry data:

- **Battery level** -- Current battery percentage.
- **Signal strength** -- Wireless signal strength (RSSI).
- **CPU temperature** -- Processor temperature in Celsius.
- **Free memory** -- Available RAM in bytes.
- **Uptime** -- Time since last boot in seconds.

---

## SaaS Operator Guide

This section is intended for platform operators who deploy and manage the NodeFleet infrastructure.

### Platform Management

There is no admin panel yet. Platform management is done through direct PostgreSQL access.

### User Roles

| Role  | Scope    | Description                        |
|-------|----------|------------------------------------|
| admin | Platform | Full platform-level access.        |
| user  | Platform | Regular user with standard access. |

### Organization Roles

| Role   | Description                                         |
|--------|-----------------------------------------------------|
| owner  | Full control over the organization.                 |
| admin  | Can manage devices, members, and settings.          |
| member | Can view and interact with devices.                 |
| viewer | Read-only access to devices and content.            |

### Creating an Admin User

To create a platform admin user, insert directly into the database:

```sql
INSERT INTO users (name, email, password_hash, role)
VALUES ('Admin Name', 'admin@example.com', '<bcrypt_hash>', 'admin');
```

### Monitoring

- Check service health: `docker ps`
- View service logs: `docker logs <container_name>`
- All services should show as "Up" in docker ps output.

### Database Access

Connect to the PostgreSQL database with the following credentials:

| Parameter | Value      |
|-----------|------------|
| Host      | localhost  |
| Port      | 5433       |
| User      | nodefleet  |
| Password  | nodefleet  |
| Database  | nodefleet  |

Example connection string:

```
postgresql://nodefleet:nodefleet@localhost:5433/nodefleet
```

### Object Storage

MinIO provides S3-compatible object storage for media files.

- **Console URL**: http://localhost:9001
- **Access Key**: minioadmin
- **Secret Key**: minioadmin

### Stripe Integration

To enable billing and subscription management, configure the Stripe webhook endpoint:

```
https://yourdomain.com/api/webhooks/stripe
```

Set the `STRIPE_WEBHOOK_SECRET` environment variable to the signing secret provided by Stripe when creating the webhook endpoint.

---

## Documentation Links

- [Deployment Guide](DEPLOYMENT.md)
- [Device Discovery](DEVICE_DISCOVERY.md)
