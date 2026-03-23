# NodeFleet Device Auto-Discovery

> **Important:** Discovery only locates the server URL. After discovery, the ESP32 must call `POST /api/devices/pair` with its 6-character pairing code to obtain a JWT token before connecting via WebSocket. Without a valid token, the WebSocket connection will be rejected. See the [API reference](API.md#pair-device) for the full pairing flow.

ESP32 devices can automatically find the NodeFleet server on the local network without hardcoding IP addresses. Two discovery protocols are supported and run simultaneously.

## Protocol 1: UDP Broadcast Discovery

The primary discovery method. Works on any LAN without infrastructure changes.

### How It Works

```
ESP32 boots
  |
  v
Broadcasts UDP packet to 255.255.255.255:5555
  payload: "NODEFLEET_DISCOVER"
  |
  v
NodeFleet ws-server receives broadcast
  |
  v
Server responds with JSON to the ESP32's IP:port
  {
    "service": "nodefleet",
    "version": "1.0",
    "wsUrl": "ws://192.168.1.100:8080",
    "httpUrl": "http://192.168.1.100:8888",
    "hostname": "nodefleet-server",
    "timestamp": 1711036800000
  }
  |
  v
ESP32 parses wsUrl and connects via WebSocket
```

### Server Side (implemented)

The UDP discovery service runs inside the ws-server container:
- Listens on UDP port 5555 (configurable via `UDP_DISCOVERY_PORT`)
- Responds only to packets containing `NODEFLEET_DISCOVER`
- Auto-detects the correct server IP to advertise (matches the requester's subnet)
- Enabled by default (`ENABLE_DISCOVERY=true`)

Docker Compose exposes port 5555/udp to the host network.

### ESP32 Firmware Side (to implement)

Add this to the ESP32 firmware to discover the server on boot:

```cpp
#include <WiFiUdp.h>
#include <ArduinoJson.h>

#define DISCOVERY_PORT 5555
#define DISCOVERY_TIMEOUT_MS 5000
#define DISCOVERY_RETRIES 3
#define DISCOVERY_MSG "NODEFLEET_DISCOVER"

WiFiUDP udp;

struct ServerInfo {
  String wsUrl;
  String httpUrl;
  String hostname;
  bool found;
};

ServerInfo discoverServer() {
  ServerInfo info = { "", "", "", false };

  udp.begin(DISCOVERY_PORT);

  for (int attempt = 0; attempt < DISCOVERY_RETRIES; attempt++) {
    Serial.printf("[Discovery] Attempt %d/%d - broadcasting on port %d\n",
                  attempt + 1, DISCOVERY_RETRIES, DISCOVERY_PORT);

    // Send broadcast
    udp.beginPacket(IPAddress(255, 255, 255, 255), DISCOVERY_PORT);
    udp.print(DISCOVERY_MSG);
    udp.endPacket();

    // Wait for response
    unsigned long start = millis();
    while (millis() - start < DISCOVERY_TIMEOUT_MS) {
      int packetSize = udp.parsePacket();
      if (packetSize > 0) {
        char buffer[512];
        int len = udp.read(buffer, sizeof(buffer) - 1);
        buffer[len] = '\0';

        // Parse JSON response
        StaticJsonDocument<512> doc;
        DeserializationError err = deserializeJson(doc, buffer);
        if (err) {
          Serial.printf("[Discovery] JSON parse error: %s\n", err.c_str());
          continue;
        }

        const char* service = doc["service"];
        if (service && strcmp(service, "nodefleet") == 0) {
          info.wsUrl = doc["wsUrl"].as<String>();
          info.httpUrl = doc["httpUrl"].as<String>();
          info.hostname = doc["hostname"].as<String>();
          info.found = true;

          Serial.printf("[Discovery] Server found: %s (host: %s)\n",
                        info.wsUrl.c_str(), info.hostname.c_str());
          break;
        }
      }
      delay(100);
    }

    if (info.found) break;
    Serial.println("[Discovery] No response, retrying...");
    delay(1000);
  }

  udp.stop();

  if (!info.found) {
    Serial.println("[Discovery] Server not found after all retries");
  }

  return info;
}

// Usage in setup():
void setup() {
  // ... WiFi connect ...

  // Auto-discover server
  ServerInfo server = discoverServer();
  if (server.found) {
    // Connect WebSocket to server.wsUrl + "/device?token=XXX"
    connectWebSocket(server.wsUrl + "/device?token=" + deviceToken);
  } else {
    // Fallback to hardcoded URL from config.h
    connectWebSocket(FALLBACK_WS_URL);
  }
}
```

### Testing UDP Discovery

From any machine on the same LAN:

```bash
# Send a discovery broadcast and listen for response
echo -n "NODEFLEET_DISCOVER" | socat - UDP-DATAGRAM:255.255.255.255:5555,broadcast

# Or with netcat (may need broadcast flag)
echo -n "NODEFLEET_DISCOVER" | nc -u -w2 -b 255.255.255.255 5555
```

Expected response:
```json
{"service":"nodefleet","version":"1.0","wsUrl":"ws://192.168.1.100:8080","httpUrl":"http://192.168.1.100:8888","hostname":"nodefleet-ws","timestamp":1711036800000}
```

---

## Protocol 2: mDNS (Multicast DNS)

Secondary discovery method. ESP32 resolves `nodefleet.local` to find the server IP.

### How It Works

```
ESP32 boots
  |
  v
Sends mDNS query for "nodefleet.local"
  (multicast to 224.0.0.251:5353)
  |
  v
NodeFleet ws-server responds with A record
  nodefleet.local → 192.168.1.100
  |
  v
ESP32 connects to ws://192.168.1.100:8080
```

### Server Side (implemented)

The mDNS responder runs inside the ws-server container:
- Joins multicast group 224.0.0.251 on port 5353
- Responds to A record queries for `nodefleet.local`
- Returns the server's LAN IP with 120s TTL
- Non-fatal if port 5353 is already in use (Avahi/Bonjour)

### ESP32 Firmware Side (to implement)

```cpp
#include <ESPmDNS.h>

String discoverViaMDNS() {
  Serial.println("[mDNS] Querying nodefleet.local...");

  // Query mDNS for the service
  IPAddress serverIP = MDNS.queryHost("nodefleet");

  if (serverIP != IPAddress(0, 0, 0, 0)) {
    Serial.printf("[mDNS] Resolved nodefleet.local → %s\n", serverIP.toString().c_str());
    return "ws://" + serverIP.toString() + ":8080";
  }

  // Alternative: query service type
  int n = MDNS.queryService("nodefleet", "tcp");
  if (n > 0) {
    String ip = MDNS.IP(0).toString();
    uint16_t port = MDNS.port(0);
    Serial.printf("[mDNS] Service found: %s:%d\n", ip.c_str(), port);
    return "ws://" + ip + ":" + String(port);
  }

  Serial.println("[mDNS] Server not found");
  return "";
}

// Usage in setup():
void setup() {
  // ... WiFi connect ...

  MDNS.begin("esp32-device");  // Register this device on mDNS

  // Try mDNS first, then UDP broadcast, then fallback
  String wsUrl = discoverViaMDNS();
  if (wsUrl.isEmpty()) {
    ServerInfo server = discoverServer();  // UDP broadcast
    if (server.found) wsUrl = server.wsUrl;
  }
  if (wsUrl.isEmpty()) {
    wsUrl = FALLBACK_WS_URL;  // Hardcoded fallback
  }

  connectWebSocket(wsUrl + "/device?token=" + deviceToken);
}
```

### Testing mDNS

```bash
# From Linux (requires avahi-utils)
avahi-resolve -n nodefleet.local

# From macOS
dns-sd -G v4 nodefleet.local

# From any machine with dig
dig @224.0.0.251 -p 5353 nodefleet.local
```

---

## Recommended Discovery Strategy

The firmware should try discovery methods in order:

1. **mDNS** (`nodefleet.local`) — instant, zero network traffic
2. **UDP broadcast** — works even without mDNS infrastructure
3. **Hardcoded fallback** — from `config.h` as last resort

```cpp
String resolveServer() {
  // 1. Try mDNS
  String url = discoverViaMDNS();
  if (!url.isEmpty()) return url;

  // 2. Try UDP broadcast
  ServerInfo info = discoverServer();
  if (info.found) return info.wsUrl;

  // 3. Fallback
  return String(FALLBACK_WS_URL);
}
```

## Dashboard Network Scanner (GET /api/discovery)

The NodeFleet dashboard includes a network scanner that discovers ESP32 devices from the browser. This is separate from the boot-time server discovery above -- it allows the dashboard user to find devices on the LAN before they are registered.

### How It Works

```
Dashboard user clicks "Scan Network"
  |
  v
Browser calls GET /api/discovery
  |
  v
Server probes ws-server on UDP port 5555
  (checks if discovery service is online)
  |
  v
Server broadcasts "NODEFLEET_ESP32_SCAN" on UDP port 5556
  |
  v
ESP32 devices on the LAN respond with JSON:
  {
    "serialNumber": "SN-ESP32-001",
    "hwModel": "ESP32-S3",
    "firmware": "1.0.0",
    "status": "ready",
    "ip": "192.168.1.50"
  }
  |
  v
Server collects responses (3-second timeout) and returns them
```

### ESP32 Scan Responder (to implement)

ESP32 devices should listen on UDP port 5556 for the `NODEFLEET_ESP32_SCAN` message and respond with a JSON payload describing the device. This allows the dashboard to discover devices before they are paired.

```cpp
#include <WiFiUdp.h>
#include <ArduinoJson.h>

#define SCAN_LISTEN_PORT 5556
#define SCAN_MAGIC "NODEFLEET_ESP32_SCAN"

WiFiUDP scanUdp;

void setupScanResponder() {
  scanUdp.begin(SCAN_LISTEN_PORT);
  Serial.printf("[Scan] Listening for scan requests on UDP port %d\n", SCAN_LISTEN_PORT);
}

void handleScanRequests() {
  int packetSize = scanUdp.parsePacket();
  if (packetSize <= 0) return;

  char buffer[64];
  int len = scanUdp.read(buffer, sizeof(buffer) - 1);
  buffer[len] = '\0';

  if (strcmp(buffer, SCAN_MAGIC) != 0) return;

  Serial.printf("[Scan] Scan request from %s:%d\n",
                scanUdp.remoteIP().toString().c_str(), scanUdp.remotePort());

  // Build response
  StaticJsonDocument<256> doc;
  doc["serialNumber"] = DEVICE_SERIAL;       // from config.h or NVS
  doc["hwModel"]      = DEVICE_HW_MODEL;     // e.g., "ESP32-S3"
  doc["firmware"]     = FIRMWARE_VERSION;     // e.g., "1.0.0"
  doc["status"]       = isPaired ? "paired" : "ready";
  doc["ip"]           = WiFi.localIP().toString();

  char response[256];
  serializeJson(doc, response, sizeof(response));

  scanUdp.beginPacket(scanUdp.remoteIP(), scanUdp.remotePort());
  scanUdp.print(response);
  scanUdp.endPacket();
}

// Call in loop():
void loop() {
  handleScanRequests();
  // ... other loop tasks ...
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| serialNumber | string | Device serial number (from config or NVS) |
| hwModel | string | Hardware model identifier (e.g., "ESP32-S3") |
| firmware | string | Current firmware version |
| status | string | `"ready"` (unpaired) or `"paired"` |
| ip | string | Device's current IP address |

### Testing the Scan Responder

```bash
# Send a scan broadcast and listen for responses
echo -n "NODEFLEET_ESP32_SCAN" | socat - UDP-DATAGRAM:255.255.255.255:5556,broadcast

# Or with netcat
echo -n "NODEFLEET_ESP32_SCAN" | nc -u -w3 -b 255.255.255.255 5556
```

---

## Seed Data UUIDs

Demo devices created by the seed script use simple, recognizable UUIDs (e.g., `d0000000-0000-0000-0000-000000000001` through `d0000000-0000-0000-0000-000000000004`). These are manually inserted database records for development convenience. Real devices created through the dashboard or API receive proper random UUIDs generated by PostgreSQL's `gen_random_uuid()`. Neither type of UUID is hardcoded in application code -- they are all just database records.

---

## Configuration

### Environment Variables (ws-server)

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_DISCOVERY` | `true` | Enable/disable both discovery protocols |
| `UDP_DISCOVERY_PORT` | `5555` | UDP broadcast listen port |
| `HTTP_PORT` | `80` | HTTP port to advertise in discovery response |

### Docker Compose Ports

```yaml
ws-server:
  ports:
    - "8081:8080"       # WebSocket
    - "5555:5555/udp"   # UDP Discovery (broadcast)
```

mDNS uses port 5353 which is not exposed to the host — it works within the Docker network and on the LAN via the host's multicast routing.

## Security Notes

- Discovery only reveals the server URL — no credentials or tokens are transmitted
- Device authentication still requires a valid JWT token obtained through the pairing flow
- In production, you may want to disable discovery (`ENABLE_DISCOVERY=false`) and use DNS instead
- mDNS responses have a 120-second TTL to prevent stale cache entries
