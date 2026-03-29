# NodeFleet User Playbook — From Zero to Fleet Management

Welcome to NodeFleet. This guide assumes you have **zero technical experience** — no Docker knowledge, no IoT background, nothing. By the end of this playbook you will have a running fleet management platform and know how to use every feature.

---

## What is NodeFleet?

NodeFleet is a web application that lets you register, monitor, and control a fleet of small wireless devices (ESP32 microcontrollers) from your browser. Think of it like a dashboard for tracking a group of security cameras, environmental sensors, or GPS trackers — except you can also send commands to them (take a photo, reboot, update firmware) and view their data in real time.

**What problems it solves:**

- You have devices spread across multiple locations and need one place to see them all.
- You need to remotely capture photos, video, or audio from devices without physically touching them.
- You want to track device locations on a map, monitor battery levels, and get alerted when something goes offline.

**Who it is for:**

- Hardware hobbyists managing a handful of ESP32 devices at home.
- Small teams deploying sensors or cameras across offices, warehouses, or field sites.
- Developers building IoT products who need a management backend.

---

## Prerequisites (What You Need First)

Before you start, make sure you have these four things:

### 1. A Computer

Any Mac, Windows, or Linux computer made in the last 5-7 years will work. You need at least 4 GB of RAM (8 GB recommended).

### 2. Docker Desktop Installed

Docker is the tool that runs NodeFleet and all its supporting services (database, storage, etc.) inside isolated containers so you do not have to install anything else.

**Install Docker Desktop in 3 steps:**

1. Go to [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
2. Download the installer for your operating system (Mac, Windows, or Linux).
3. Run the installer and follow the prompts. When it finishes, open Docker Desktop and make sure you see a green "Running" indicator in the bottom-left corner.

> **Windows users:** Docker Desktop requires WSL 2 (Windows Subsystem for Linux). The installer will prompt you to enable it if it is not already active — just follow the on-screen instructions.

### 3. A Web Browser

Chrome, Firefox, Safari, or Edge. Any modern browser will work.

### 4. (Optional) An ESP32 Device

If you want to connect real hardware, you need an ESP32 board (the Waveshare ESP32-S3-SIM7670G-4G is the tested reference board). **This is not required** — NodeFleet includes a software simulator so you can try everything without any hardware at all.

---

## Step 1: Get NodeFleet Running (5 minutes)

Open a terminal (on Mac: Terminal app; on Windows: PowerShell or Command Prompt; on Linux: any terminal emulator) and run these commands one at a time:

```bash
# 1. Download the NodeFleet code
git clone <repo-url>

# 2. Move into the project folder
cd nodefleet

# 3. Create your local configuration file
cp .env.example .env

# 4. Start all services
./nodefleet.sh
```

> **What is happening:** The last command builds and starts 6 services — a database (PostgreSQL), a cache (Redis), file storage (MinIO), the web dashboard (Next.js), a real-time communication server (WebSocket), and a reverse proxy (Nginx). It also runs a 9-stage health check to make sure everything started correctly.

This takes 2-5 minutes the first time (it downloads required software images). Subsequent starts are much faster.

**Wait for the health check to pass.** You will see green checkmarks or "healthy" messages for each service.

### 5. Open the Dashboard

Open your web browser and go to:

```
http://localhost:50080
```

You should see the NodeFleet login page.

---

## Step 2: Log In

Use the built-in test account to log in immediately:

| Field    | Value              |
|----------|--------------------|
| Email    | test@nodefleet.io  |
| Password | test1234           |

After logging in, you land on the **Devices** page. This is your home base — it shows all the devices in your organization.

**What you see on first login:**

- A sidebar on the left with navigation links: Devices, Map, Content, Schedules, Settings.
- The main area shows your device list (empty if this is a fresh install).
- At the top, stat cards showing: Total Devices, Online Devices, Media Files, and Storage Used.

> **Tip:** You can also create your own account by clicking "Register" on the login page. Enter your name, email, password, and an organization name. New accounts start on the Free plan (3 devices, 1 GB storage).

---

## Step 3: Create Your First Device

A "device" in NodeFleet represents one physical (or simulated) ESP32 board. You need to register it in the dashboard before it can connect.

1. On the **Devices** page, click the **"Add Device"** button.
2. Fill in the form:
   - **Name** — A friendly label, e.g., "Living Room Sensor" or "Test Device 1".
   - **Hardware Model** — The board type, e.g., "ESP32-S3" or "ESP32-CAM". You can type anything here.
   - **Serial Number** — A unique identifier, e.g., "SN-001". Must be unique across your organization.
3. Optionally select a **Fleet** (a group of devices by location) and enter a **Firmware Version**.
4. Click **Create**.

**What happens next:** NodeFleet generates a **6-character pairing code** (e.g., `A1B2C3`). This code is displayed on screen — copy it or write it down. The code is valid for **24 hours**. You will use it in the next step to connect a device (real or simulated) to the platform.

---

## Step 4: Pair a Device (With or Without Hardware)

You have two options: use the built-in simulator (no hardware needed) or connect a real ESP32 board.

### Option A: Using the Simulator (No Hardware Needed)

The simulator is the easiest way to see NodeFleet in action. Open a terminal and run:

```bash
./nodefleet.sh simulate --pair YOUR_CODE
```

Replace `YOUR_CODE` with the 6-character pairing code from Step 3 (e.g., `./nodefleet.sh simulate --pair A1B2C3`).

**What happens:** A simulated device connects to NodeFleet, pairs using the code, and starts sending fake heartbeat data (battery level, signal strength, CPU temperature, memory usage) and GPS coordinates every 30 seconds. Go back to the dashboard — you will see the device appear with a green "Online" badge.

### Option B: Using Real ESP32 Hardware

If you have a physical ESP32 board:

1. Open the firmware project at `firmware/esp32_agent/`.
2. Edit `config.h` and set:
   - Your WiFi network name and password.
   - The NodeFleet server address (e.g., `http://YOUR_COMPUTER_IP:50080`).
   - The pairing code from Step 3.
3. Flash the firmware to the board using PlatformIO or Arduino IDE.
4. Power on the board — it will automatically pair and start streaming data.

For the full hardware setup guide, see [firmware/esp32_agent/README.md](../firmware/esp32_agent/README.md).

---

## Step 5: Monitor Your Fleet

Now that you have a device connected (simulated or real), here is what each part of the dashboard shows:

### Dashboard Stats (Top of Devices Page)

| Card            | What It Means                                         |
|-----------------|-------------------------------------------------------|
| Total Devices   | How many devices are registered in your organization. |
| Online          | How many are actively sending heartbeats right now.   |
| Media Files     | Total photos, videos, and audio files captured.       |
| Storage Used    | How much disk space your media files are using.       |

### Device List

Each device in the list shows:

- **Name** — The label you gave it.
- **Status badge** — Color-coded:
  - **Green** = Online (heartbeat received in the last 90 seconds).
  - **Red** = Offline (no heartbeat received).
  - **Yellow** = Pairing (registered but hasn't connected yet).
- **Hardware model**, **fleet**, **battery level**, and **last seen** time.

### Real-Time Updates

The dashboard updates automatically via WebSocket — you do **not** need to refresh the page. When a device comes online, goes offline, or sends new data, the dashboard reflects it within seconds.

---

## Step 6: View Device Details

Click on any device name in the device list to open its **detail page**. The detail page has 4 tabs:

### Overview Tab

- Device info: name, hardware model, serial number, firmware version.
- Fleet assignment (you can change it from a dropdown).
- Pairing code with a "New Code" button to regenerate if the old one expired.
- Latest telemetry snapshot (battery, signal, temperature).

### Telemetry Tab

- Historical charts showing how battery level, signal strength, CPU temperature, and free memory change over time.
- Time range selector: 1 hour, 6 hours, 24 hours, 7 days, or 30 days.

### GPS Tab

- An interactive map showing the device's current and historical locations.
- Route visualization showing where the device has traveled.
- Data points include: latitude, longitude, speed, altitude, and satellite count.

### Commands Tab

- A history of all commands sent to this device.
- A "Send Command" button to issue new commands (see Step 7).

---

## Step 7: Send Commands to Devices

Commands let you tell a device to do something remotely.

1. Go to any device's detail page and click the **Commands** tab.
2. Click **"Send Command"**.
3. Choose a command from the list:

| Command            | What It Does                                  |
|--------------------|-----------------------------------------------|
| `capture_photo`    | Take a photo with the device's camera.        |
| `capture_video`    | Record a short video clip.                    |
| `record_audio`     | Record an audio clip.                         |
| `stream_video`     | Start a live video stream.                    |
| `reboot`           | Restart the device.                           |
| `update_firmware`  | Push a firmware update to the device.         |
| `custom`           | Send a custom command with your own payload.  |

### Command Lifecycle

Every command goes through these stages:

```
pending → sent → acknowledged → completed (or failed)
```

- **Pending** — Command created, waiting to be sent.
- **Sent** — Delivered to the device via WebSocket.
- **Acknowledged** — Device confirmed it received the command.
- **Completed** — Device finished executing the command.
- **Failed** — Something went wrong (timeout after 5 minutes, device error, etc.).

### Fleet Commands

You can also send a command to **all devices in a fleet** at once. Navigate to the fleet, choose a command, and it will be broadcast to every device in that group.

---

## Step 8: Manage Content (Media Library)

The **Content** page (click "Content" in the sidebar) is where you find all photos, videos, and audio files captured by your devices.

**Features:**

- Images are displayed as thumbnails. Click to expand to full size in a modal viewer.
- Video and audio files have embedded players — you can play them directly in the browser.
- No downloads required — everything streams from the built-in storage.

**Filtering your content:**

1. **By device** — Use the device dropdown to see files from a specific device, all devices, or files not linked to any device.
2. **By media type** — Filter by Images, Videos, Audio, or Documents.
3. **By filename** — Type in the search box to find specific files.

Each content card shows which device captured it, so you always know the source.

**Uploading:** You can upload files directly from your browser using the upload button.

**Deleting:** Click the delete button on any file. A confirmation dialog will appear before the file is permanently removed.

---

## Step 9: Set Up Schedules

Schedules let you automate commands on a recurring basis — for example, "capture a photo every morning at 8 AM" or "check battery levels every hour."

1. Click **"Schedules"** in the sidebar.
2. Click **"Create Schedule"**.
3. Fill in the details:
   - **Name** — e.g., "Morning Photo Capture".
   - **Repeat type** — Daily, weekly, or a custom cron expression.
   - **Items** — The commands to run (e.g., `capture_photo`). You can chain multiple commands.
   - **Devices** — Which devices this schedule applies to.
4. (Optional) Set **conditions** to gate execution:
   - **Battery below X%** — Only run if the battery is below a threshold (useful for "send alert if battery low").
   - **Temperature above X degrees C** — Only run if the CPU is overheating.
   - Tasks only execute when **all** specified conditions are met.
5. Click **Create**.

You can toggle schedules on or off, edit them, or delete them at any time.

---

## Step 10: Configure Settings

Click **"Settings"** in the sidebar to access your account and organization configuration. The settings page has 6 sections:

### Profile

Edit your display name and email address. Changes take effect immediately.

### Organization

- View your **Organization ID** (a human-readable identifier like `NF-MYORG-A1B2C3`).
- Edit the **organization name** (if you are an owner or admin).
- See stats: number of devices, media files, members, and your current plan.

### Change Password

Enter your current password, then your new password and confirmation. Your current password is verified before the change is applied.

### API Keys

Generate API keys for programmatic access (e.g., scripts, integrations, third-party tools):

- Click **"Generate"** to create a new key. The key looks like `nf_a1b2c3d4_e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0`.
- **The full key is shown only once.** Copy it immediately and store it somewhere safe.
- You can see a list of your keys (only the prefix is shown for security) and revoke any key at any time.

### Billing

Link to subscription management. The Free plan includes 3 devices and 1 GB storage. Paid plans (Pro, Team, Enterprise) offer more.

| Plan       | Price       | Devices   | Storage   |
|------------|-------------|-----------|-----------|
| Free       | $0/month    | 3         | 1 GB      |
| Pro        | $19.99/mo   | 50        | 50 GB     |
| Team       | $49.99/mo   | 100       | 500 GB    |
| Enterprise | Custom      | Unlimited | Unlimited |

### Danger Zone

Permanently delete your account. Requires your password for confirmation. If you are the only owner of your organization, the entire organization and all its data will be deleted too.

---

## Common Tasks Cheatsheet

These are the most frequently used commands. Run them from a terminal inside the `nodefleet` folder.

| Task                        | Command                                    |
|-----------------------------|--------------------------------------------|
| Start all services          | `./nodefleet.sh`                           |
| Check service status        | `./nodefleet.sh --status`                  |
| View logs for a service     | `./nodefleet.sh logs web`                  |
| Stop everything             | `./nodefleet.sh down`                      |
| Run the device simulator    | `./nodefleet.sh simulate --pair CODE`      |
| Check health of all services| `./nodefleet.sh health`                    |
| Rebuild a specific service  | `./nodefleet.sh rebuild web`               |
| Compile ESP32 firmware      | `./nodefleet.sh compile`                   |
| Flash firmware to ESP32     | `./nodefleet.sh flash`                     |
| Run a database query        | `./nodefleet.sh db "SELECT count(*) FROM devices"` |
| Run database migrations     | `./nodefleet.sh migrate`                   |
| Check MQTT broker status    | `./nodefleet.sh mqtt`                      |

> **Tip:** You can view logs for any service by replacing `web` with the service name: `postgres`, `redis`, `minio`, `ws-server`, or `nginx`.

---

## Troubleshooting

### "The page won't load at localhost:50080"

1. Run `./nodefleet.sh --status` and check that all 6 services show as running.
2. If a service is stopped or restarting, run `./nodefleet.sh` to rebuild and restart everything.
3. Make sure Docker Desktop is running (check for the Docker icon in your system tray).

### "My device won't pair"

- Make sure the pairing code has not expired. Codes are valid for **24 hours** only.
- Go to the device detail page and click **"New Code"** to generate a fresh one.
- If using the simulator, double-check that you typed the code correctly (codes are case-sensitive).

### "I see no telemetry data"

- Verify the device shows a **green** (Online) status badge. If it is red or yellow, the device is not connected.
- Check that the WebSocket server is running: `./nodefleet.sh logs ws-server`.
- If using the simulator, make sure it is still running in your terminal.

### "Media files are not showing in the Content page"

- Check that MinIO (the storage service) is running: `./nodefleet.sh --status`.
- Verify `S3_PUBLIC_ENDPOINT` in your `.env` file is set to `http://localhost:50900`.
- Try accessing the MinIO console directly at `http://localhost:50901` (login: minioadmin / minioadmin).

### "I forgot my password"

There is currently no email-based password recovery. Your options:

- If you have database access, you can reset the password directly in PostgreSQL.
- Register a new account with a different email address.

### "Services are slow or using too much memory"

- Close other applications to free up RAM.
- Run `./nodefleet.sh down` and then `./nodefleet.sh` to restart fresh.
- Check Docker Desktop settings and increase the memory allocation if needed (Settings > Resources > Memory).

---

## Glossary

| Term           | Definition                                                                                      |
|----------------|-------------------------------------------------------------------------------------------------|
| **Device**     | A physical or simulated ESP32 microcontroller registered in NodeFleet.                          |
| **Fleet**      | A named group of devices organized by location (e.g., "Warehouse West" or "HQ Office").        |
| **Heartbeat**  | A periodic health signal sent from a device every 30 seconds, containing battery, signal, temperature, and memory data. |
| **Pairing Code** | A 6-character code (e.g., `A1B2C3`) generated when you create a device. Used once to link a physical device to its dashboard entry. Valid for 24 hours. |
| **Telemetry**  | Sensor data reported by devices: battery percentage, signal strength (RSSI), CPU temperature, free memory, and uptime. |
| **WebSocket**  | A real-time two-way communication channel between devices and the server. Unlike regular web requests, it stays open continuously so data flows instantly. |
| **MinIO**      | The built-in file storage service (S3-compatible). Stores photos, videos, and audio captured by devices. |
| **JWT Token**  | A secure authentication token issued to a device after pairing. The device uses it for all future connections. Valid for 365 days. |
| **Cron**       | A scheduling syntax for recurring tasks (e.g., `0 8 * * *` means "every day at 8:00 AM").      |
| **ESP32**      | A low-cost WiFi-enabled microcontroller commonly used in IoT projects. NodeFleet is designed to manage fleets of these devices. |

---

## Next Steps

Once you are comfortable with the basics, explore these resources to go deeper:

- **[ARCHITECTURE.md](../ARCHITECTURE.md)** — Understand how all the services fit together and how data flows through the system.
- **[docs/API.md](API.md)** — Full REST and WebSocket API reference (38 endpoints) for building integrations.
- **[docs/DEPLOYMENT.md](DEPLOYMENT.md)** — Guide for deploying NodeFleet to a production server.
- **[docs/WEBSOCKET_PROTOCOL.md](WEBSOCKET_PROTOCOL.md)** — Technical specification for the WebSocket message format.
- **[docs/DEVICE_DISCOVERY.md](DEVICE_DISCOVERY.md)** — How ESP32 devices automatically find the NodeFleet server on your network.
- **[firmware/esp32_agent/README.md](../firmware/esp32_agent/README.md)** — Complete guide to setting up, flashing, and configuring real ESP32 hardware.
- **[HARDWARE_ALTERNATIVES.md](../HARDWARE_ALTERNATIVES.md)** — Compatible ESP32 boards and where to buy them.

---

*Last updated: 2026-03-29*
