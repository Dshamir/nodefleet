# NodeFleet WebSocket Protocol

This document describes the WebSocket protocol used for real-time communication between devices, the server, and dashboard clients.

---

## Connection

### Endpoints

| Client    | Endpoint                          |
|-----------|-----------------------------------|
| Device    | `ws://host/ws/device?token=JWT`   |
| Dashboard | `ws://host/ws/dashboard?token=JWT`|

Both endpoints are served through nginx, which proxies WebSocket connections to `ws-server:8080`.

### Authentication

All WebSocket connections require a valid JWT token passed as a query parameter. The server validates the token before accepting the connection.

---

## Device Messages (device -> server)

### heartbeat

Sent periodically by the device to indicate it is alive and to report system metrics.

```json
{
  "type": "heartbeat",
  "battery": 85,
  "signal": -67,
  "cpuTemp": 42.5,
  "freeMemory": 124000,
  "uptime": 3600
}
```

| Field      | Type   | Description                          |
|------------|--------|--------------------------------------|
| battery    | number | Battery level as a percentage (0-100)|
| signal     | number | WiFi signal strength in dBm          |
| cpuTemp    | number | CPU temperature in Celsius           |
| freeMemory | number | Available RAM in bytes               |
| uptime     | number | Seconds since last boot              |

### gps

Sent when the device obtains a new GPS fix.

```json
{
  "type": "gps",
  "lat": 45.5017,
  "lng": -73.5673,
  "alt": 35.2,
  "speed": 1.5,
  "heading": 270.0,
  "accuracy": 3.2,
  "satellites": 12
}
```

| Field      | Type   | Description                         |
|------------|--------|-------------------------------------|
| lat        | number | Latitude in decimal degrees         |
| lng        | number | Longitude in decimal degrees        |
| alt        | number | Altitude in meters above sea level  |
| speed      | number | Speed in meters per second          |
| heading    | number | Heading in degrees (0-360)          |
| accuracy   | number | Horizontal accuracy in meters       |
| satellites | number | Number of satellites in view        |

### telemetry

Sent to report arbitrary telemetry data from device sensors.

```json
{
  "type": "telemetry",
  "data": {
    "humidity": 65.3,
    "pressure": 1013.25,
    "lightLevel": 420
  }
}
```

| Field | Type   | Description                              |
|-------|--------|------------------------------------------|
| data  | object | Key-value pairs of sensor readings       |

### media_ready

Sent when the device has finished capturing and uploading a media file.

```json
{
  "type": "media_ready",
  "mediaId": "abc123",
  "filename": "photo_20260321_143000.jpg",
  "size": 2048576
}
```

| Field    | Type   | Description                          |
|----------|--------|--------------------------------------|
| mediaId  | string | Unique identifier for the media file |
| filename | string | Original filename                    |
| size     | number | File size in bytes                   |

### command_ack

Sent by the device to acknowledge receipt and execution of a command.

```json
{
  "type": "command_ack",
  "commandId": "cmd-456",
  "status": "completed",
  "result": {
    "filename": "photo_20260321_143000.jpg",
    "size": 2048576
  }
}
```

| Field     | Type   | Description                                            |
|-----------|--------|--------------------------------------------------------|
| commandId | string | The ID of the command being acknowledged               |
| status    | string | Execution status: "received", "completed", or "failed" |
| result    | object | Optional result data from the command execution        |

---

## Dashboard Messages (dashboard -> server)

### subscribe_device

Subscribe to real-time updates for a specific device.

```json
{
  "type": "subscribe_device",
  "deviceId": "device-789"
}
```

### unsubscribe_device

Stop receiving updates for a specific device.

```json
{
  "type": "unsubscribe_device",
  "deviceId": "device-789"
}
```

### send_command

Send a command to a device through the server.

```json
{
  "type": "send_command",
  "deviceId": "device-789",
  "command": "capture_photo",
  "payload": {
    "resolution": "1080p",
    "format": "jpg"
  }
}
```

| Field   | Type   | Description                                |
|---------|--------|--------------------------------------------|
| deviceId| string | Target device ID                           |
| command | string | Command name (see Device Management guide) |
| payload | object | Optional parameters for the command        |

### reload

Request the server to resend the current state of all subscribed devices.

```json
{
  "type": "reload"
}
```

---

## Server -> Dashboard Messages

### device_update

Forwarded from device heartbeats to subscribed dashboard clients. Contains the latest device status and telemetry.

```json
{
  "type": "device_update",
  "deviceId": "device-789",
  "status": "online",
  "battery": 85,
  "signal": -67,
  "cpuTemp": 42.5,
  "freeMemory": 124000,
  "uptime": 3600,
  "lastSeen": "2026-03-21T14:30:00Z"
}
```

### gps_update

Forwarded GPS position updates to subscribed dashboard clients.

```json
{
  "type": "gps_update",
  "deviceId": "device-789",
  "lat": 45.5017,
  "lng": -73.5673,
  "alt": 35.2,
  "speed": 1.5,
  "heading": 270.0,
  "timestamp": "2026-03-21T14:30:00Z"
}
```

### command_status

Forwarded command acknowledgment from the device to the dashboard client that issued the command.

```json
{
  "type": "command_status",
  "deviceId": "device-789",
  "commandId": "cmd-456",
  "status": "completed",
  "result": {
    "filename": "photo_20260321_143000.jpg",
    "size": 2048576
  }
}
```

---

## Redis Pub/Sub Channels

The WebSocket server uses Redis pub/sub to distribute messages across multiple server instances. The following channels are used:

| Channel Pattern                  | Description                        |
|----------------------------------|------------------------------------|
| `device:{deviceId}:telemetry`    | Heartbeat and sensor telemetry     |
| `device:{deviceId}:gps`         | GPS position updates               |
| `device:{deviceId}:command`      | Commands sent to the device        |
| `device:{deviceId}:status`       | Device online/offline status changes|

Replace `{deviceId}` with the actual device identifier (e.g., `device:device-789:telemetry`).

---

## Connection Lifecycle

### Device Connection

1. Device opens a WebSocket connection to `ws://host/ws/device?token=JWT`.
2. Server validates the JWT token.
3. Server registers the device in the internal connections map.
4. Server starts a heartbeat timer for the device:
   - **Heartbeat interval**: 30 seconds (expected from device).
   - **Heartbeat timeout**: 90 seconds (device marked offline if exceeded).
5. Device begins sending heartbeat, GPS, and telemetry messages.

### Dashboard Connection

1. Dashboard client opens a WebSocket connection to `ws://host/ws/dashboard?token=JWT`.
2. Server validates the JWT token.
3. Dashboard can subscribe to one or more device channels using `subscribe_device` messages.
4. Server forwards relevant device updates to subscribed dashboard clients.

### Disconnection

- **Device disconnect**: If the device disconnects or stops sending heartbeats, the server waits for the 90-second timeout before marking the device as offline. The status change is broadcast to subscribed dashboard clients via the `device:{deviceId}:status` Redis channel.
- **Dashboard disconnect**: All device subscriptions for the dashboard client are cleaned up immediately. No other side effects occur.
