import * as dgram from 'dgram';
import * as os from 'os';

// ============================================================================
// DISCOVERY SERVICE
// Enables ESP32 devices to auto-discover the NodeFleet server on the LAN.
// Two protocols: UDP broadcast listener + mDNS responder.
// ============================================================================

interface DiscoveryConfig {
  udpPort: number;           // UDP broadcast listen port (default 5555)
  wsPort: number;            // WebSocket server port to advertise
  httpPort: number;          // HTTP API port to advertise
  serviceName: string;       // mDNS service name
  logger: { info: (msg: string) => void; error: (msg: string, err?: unknown) => void };
}

interface DiscoveryResponse {
  service: 'nodefleet';
  version: '1.0';
  wsUrl: string;             // ws://ip:port
  httpUrl: string;           // http://ip:port
  hostname: string;
  timestamp: number;
}

// ============================================================================
// UDP BROADCAST DISCOVERY
//
// Protocol:
//   1. ESP32 sends UDP broadcast to port 5555 with payload: "NODEFLEET_DISCOVER"
//   2. Server responds with JSON containing connection URLs
//   3. ESP32 parses response and connects via WebSocket
//
// ESP32 firmware sends to 255.255.255.255:5555 (broadcast)
// Server listens on 0.0.0.0:5555 and responds to sender's IP:port
// ============================================================================

export class UDPDiscoveryService {
  private socket: dgram.Socket | null = null;
  private config: DiscoveryConfig;

  constructor(config: DiscoveryConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      this.socket.on('error', (err) => {
        this.config.logger.error('UDP Discovery error', err);
        this.socket?.close();
        reject(err);
      });

      this.socket.on('message', (msg, rinfo) => {
        const message = msg.toString().trim();

        // Only respond to discovery requests
        if (message !== 'NODEFLEET_DISCOVER') {
          return;
        }

        this.config.logger.info(
          `Discovery request from ${rinfo.address}:${rinfo.port}`
        );

        const serverIp = this.getServerIP(rinfo.address);
        const response: DiscoveryResponse = {
          service: 'nodefleet',
          version: '1.0',
          wsUrl: `ws://${serverIp}:${this.config.wsPort}`,
          httpUrl: `http://${serverIp}:${this.config.httpPort}`,
          hostname: os.hostname(),
          timestamp: Date.now(),
        };

        const responseBuffer = Buffer.from(JSON.stringify(response));
        this.socket?.send(responseBuffer, rinfo.port, rinfo.address, (err) => {
          if (err) {
            this.config.logger.error('Failed to send discovery response', err);
          } else {
            this.config.logger.info(
              `Discovery response sent to ${rinfo.address}:${rinfo.port} → ws://${serverIp}:${this.config.wsPort}`
            );
          }
        });
      });

      this.socket.bind(this.config.udpPort, '0.0.0.0', () => {
        this.socket?.setBroadcast(true);
        this.config.logger.info(
          `UDP Discovery listening on port ${this.config.udpPort}`
        );
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.socket) {
        this.socket.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  /**
   * Determine the best server IP to advertise to the requesting device.
   * Picks the interface on the same subnet as the requester, or falls back
   * to the first non-loopback IPv4 address.
   */
  private getServerIP(requesterIP: string): string {
    const interfaces = os.networkInterfaces();
    const requesterParts = requesterIP.split('.').slice(0, 3).join('.');

    // Try to find an interface on the same subnet as the requester
    for (const iface of Object.values(interfaces)) {
      if (!iface) continue;
      for (const addr of iface) {
        if (addr.family === 'IPv4' && !addr.internal) {
          const addrParts = addr.address.split('.').slice(0, 3).join('.');
          if (addrParts === requesterParts) {
            return addr.address;
          }
        }
      }
    }

    // Fallback: first non-loopback IPv4
    for (const iface of Object.values(interfaces)) {
      if (!iface) continue;
      for (const addr of iface) {
        if (addr.family === 'IPv4' && !addr.internal) {
          return addr.address;
        }
      }
    }

    return '127.0.0.1';
  }
}

// ============================================================================
// mDNS RESPONDER
//
// Advertises _nodefleet._tcp service on the local network.
// ESP32 devices can resolve "nodefleet.local" to find the server.
//
// Uses DNS-SD (Service Discovery) over multicast DNS:
//   - Multicast group: 224.0.0.251, port 5353
//   - Service type: _nodefleet._tcp.local
//   - Responds with A record (IP) and SRV record (port)
//
// Note: For production, consider using a full mDNS library (e.g., bonjour-service).
// This is a lightweight implementation for LAN device discovery.
// ============================================================================

export class MDNSResponder {
  private socket: dgram.Socket | null = null;
  private config: DiscoveryConfig;
  private readonly MDNS_ADDR = '224.0.0.251';
  private readonly MDNS_PORT = 5353;

  constructor(config: DiscoveryConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        this.socket.on('error', (err) => {
          // mDNS port may already be in use (Avahi, Bonjour) — non-fatal
          this.config.logger.error('mDNS responder error (non-fatal)', err);
          resolve(); // Don't reject — mDNS is optional
        });

        this.socket.on('message', (msg, rinfo) => {
          this.handleMDNSQuery(msg, rinfo);
        });

        this.socket.bind(this.MDNS_PORT, () => {
          try {
            this.socket?.addMembership(this.MDNS_ADDR);
            this.config.logger.info(
              `mDNS responder active — resolves ${this.config.serviceName}.local`
            );
          } catch (err) {
            this.config.logger.error('Failed to join mDNS multicast group', err);
          }
          resolve();
        });
      } catch (err) {
        this.config.logger.error('mDNS setup failed (non-fatal)', err);
        resolve(); // Non-fatal
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.socket) {
        try {
          this.socket.dropMembership(this.MDNS_ADDR);
        } catch {}
        this.socket.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  /**
   * Parse incoming mDNS queries and respond to questions about our service name.
   * This is a simplified parser — handles standard A record queries for nodefleet.local.
   */
  private handleMDNSQuery(msg: Buffer, rinfo: dgram.RemoteInfo): void {
    // Minimal DNS header check: at least 12 bytes, QR=0 (query), QDCOUNT > 0
    if (msg.length < 12) return;
    const flags = msg.readUInt16BE(2);
    const isQuery = (flags & 0x8000) === 0;
    if (!isQuery) return;

    const qdcount = msg.readUInt16BE(4);
    if (qdcount === 0) return;

    // Parse the question name
    const questionName = this.parseDNSName(msg, 12);
    if (!questionName) return;

    const targetName = `${this.config.serviceName}.local`;
    if (questionName.toLowerCase() !== targetName.toLowerCase()) return;

    this.config.logger.info(`mDNS query for ${questionName} from ${rinfo.address}`);

    // Build A record response
    const serverIp = this.getServerIP();
    const response = this.buildARecordResponse(targetName, serverIp);
    if (response) {
      this.socket?.send(response, this.MDNS_PORT, this.MDNS_ADDR, (err) => {
        if (err) {
          this.config.logger.error('mDNS response send error', err);
        }
      });
    }
  }

  private parseDNSName(buf: Buffer, offset: number): string | null {
    const labels: string[] = [];
    let pos = offset;
    while (pos < buf.length) {
      const len = buf[pos];
      if (len === 0) break;
      if (len > 63) return null; // Compression pointer — skip
      pos++;
      if (pos + len > buf.length) return null;
      labels.push(buf.subarray(pos, pos + len).toString('ascii'));
      pos += len;
    }
    return labels.join('.');
  }

  private buildARecordResponse(name: string, ip: string): Buffer | null {
    try {
      const parts = ip.split('.').map(Number);
      if (parts.length !== 4 || parts.some(isNaN)) return null;

      // Encode the DNS name
      const nameLabels = name.split('.');
      const nameBytes: number[] = [];
      for (const label of nameLabels) {
        nameBytes.push(label.length);
        for (let i = 0; i < label.length; i++) {
          nameBytes.push(label.charCodeAt(i));
        }
      }
      nameBytes.push(0); // Root label

      const nameBuffer = Buffer.from(nameBytes);

      // DNS header (response, 1 answer)
      const header = Buffer.alloc(12);
      header.writeUInt16BE(0, 0);       // Transaction ID
      header.writeUInt16BE(0x8400, 2);  // Flags: QR=1, AA=1
      header.writeUInt16BE(0, 4);       // QDCOUNT
      header.writeUInt16BE(1, 6);       // ANCOUNT
      header.writeUInt16BE(0, 8);       // NSCOUNT
      header.writeUInt16BE(0, 10);      // ARCOUNT

      // Answer: A record
      const answer = Buffer.alloc(10);
      answer.writeUInt16BE(1, 0);       // TYPE: A
      answer.writeUInt16BE(0x8001, 2);  // CLASS: IN + cache-flush
      answer.writeUInt32BE(120, 4);     // TTL: 120 seconds
      answer.writeUInt16BE(4, 8);       // RDLENGTH: 4 bytes

      const rdata = Buffer.from(parts);

      return Buffer.concat([header, nameBuffer, answer, rdata]);
    } catch {
      return null;
    }
  }

  private getServerIP(): string {
    const interfaces = os.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
      if (!iface) continue;
      for (const addr of iface) {
        if (addr.family === 'IPv4' && !addr.internal) {
          return addr.address;
        }
      }
    }
    return '127.0.0.1';
  }
}
