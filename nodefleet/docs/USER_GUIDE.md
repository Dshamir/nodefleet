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

The main dashboard page. Displays all devices belonging to your organization with their current status. Features include:

- Search and filter devices by name, status, or model.
- View device details including last heartbeat time, battery level, and connectivity.
- Add a new device by clicking the "Add Device" button, which opens a pairing code dialog.

### Map (/map)

An interactive Leaflet map with a dark theme for visualizing device locations.

- **Markers**: Green = online, Gray = offline, Yellow = pairing.
- **GPS Trails**: View historical movement paths for each device.
- **Coordinates Table**: A tabular view of device positions with latitude, longitude, and timestamp.

### Content Library (/content)

Browse media files uploaded from your devices. Supported file types:

- Images
- Video
- Audio
- Documents

Files are organized by device and upload date.

### Schedules (/schedules)

Create and manage automated tasks that run on cron schedules. Supported task types:

- Capture photo
- Record audio
- Reboot device

Each schedule is assigned to one or more devices and runs according to the configured cron expression.

### Settings (/settings)

Manage your account settings and organization configuration.

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

## Device Management

### Adding a Device

1. Click **"Add Device"** on the Devices page.
2. Enter the device name, model, and serial number.
3. A pairing code is generated (6 characters, valid for 24 hours).
4. Use this pairing code to connect your physical device.

### Device Pairing

1. Flash the ESP32 firmware with the pairing code.
2. The device calls `/api/devices/pair` with the pairing code.
3. The server returns a JWT token for the device.
4. The device uses the JWT to connect via WebSocket for real-time communication.

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
