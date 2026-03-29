import 'dotenv/config';
import * as WebSocket from 'ws';
import { WebSocketServer } from 'ws';
import * as http from 'http';
import * as url from 'url';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { UDPDiscoveryService, MDNSResponder } from './discovery.js';

const { Pool } = pg;

// ============================================================================
// TYPES
// ============================================================================

interface DeviceMessage {
  type: 'heartbeat' | 'gps' | 'telemetry' | 'media_ready' | 'command_ack';
  [key: string]: unknown;
}

interface DashboardMessage {
  type: 'subscribe_device' | 'unsubscribe_device' | 'send_command' | 'reload';
  [key: string]: unknown;
}

interface DeviceInfo {
  ws: WebSocket.WebSocket;
  deviceId: string;
  orgId?: string;
  tokenIat?: number;
  lastHeartbeat: number;
  heartbeatTimer: NodeJS.Timeout | null;
}

interface DashboardInfo {
  userId: string;
  subscribedDevices: Set<string>;
}

interface HeartbeatMessage extends DeviceMessage {
  type: 'heartbeat';
  battery: number;
  signal: number;
  cpuTemp: number;
  freeMemory: number;
  uptime: number;
}

interface GPSMessage extends DeviceMessage {
  type: 'gps';
  lat: number;
  lng: number;
  alt: number;
  speed: number;
  heading: number;
  accuracy: number;
  satellites: number;
}

interface TelemetryMessage extends DeviceMessage {
  type: 'telemetry';
  data: Record<string, unknown>;
}

interface MediaReadyMessage extends DeviceMessage {
  type: 'media_ready';
  fileType: string;
  filename: string;
  size: number;
}

interface CommandAckMessage extends DeviceMessage {
  type: 'command_ack';
  commandId: string;
  status: 'success' | 'error' | 'pending';
  result?: unknown;
}

// ============================================================================
// LOGGER
// ============================================================================

class Logger {
  private timestamp(): string {
    return new Date().toISOString();
  }

  info(message: string, context?: Record<string, unknown>): void {
    console.log(`[${this.timestamp()}] INFO: ${message}`, context ? context : '');
  }

  error(message: string, error?: Error | Record<string, unknown>): void {
    console.error(`[${this.timestamp()}] ERROR: ${message}`, error ? error : '');
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[${this.timestamp()}] WARN: ${message}`, context ? context : '');
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (process.env.DEBUG === 'true') {
      console.log(`[${this.timestamp()}] DEBUG: ${message}`, context ? context : '');
    }
  }
}

// ============================================================================
// WEBSOCKET SERVER
// ============================================================================

class NodeFleetWSServer {
  private server: http.Server;
  private wss: WebSocketServer;
  private redis: Redis;
  private redisPub: Redis;
  private logger: Logger;
  private udpDiscovery: UDPDiscoveryService;
  private mdnsResponder: MDNSResponder;

  // Device and dashboard connection tracking
  private devices: Map<string, DeviceInfo> = new Map();
  private dashboards: Map<WebSocket.WebSocket, DashboardInfo> = new Map();

  // Device ID to dashboard subscribers map
  private deviceSubscribers: Map<string, Set<WebSocket.WebSocket>> = new Map();

  // Configuration
  private readonly WS_PORT = parseInt(process.env.WS_PORT || '8080', 10);
  private readonly UDP_DISCOVERY_PORT = parseInt(process.env.UDP_DISCOVERY_PORT || '5555', 10);
  private readonly HTTP_PORT = parseInt(process.env.HTTP_PORT || '80', 10);
  private readonly REDIS_HOST = process.env.REDIS_HOST || 'localhost';
  private readonly REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private readonly DEVICE_TOKEN_SECRET = process.env.DEVICE_TOKEN_SECRET || 'device-secret';
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly HEARTBEAT_TIMEOUT = 90000; // 90 seconds
  private readonly ENABLE_DISCOVERY = process.env.ENABLE_DISCOVERY !== 'false';
  private readonly WEB_API_URL = process.env.WEB_API_URL || 'http://web:3000';
  private readonly DATABASE_URL = process.env.DATABASE_URL || 'postgresql://nodefleet:nodefleet@postgres:5432/nodefleet';
  private db: pg.Pool;

  constructor() {
    this.logger = new Logger();
    this.server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      } else if (req.url === '/devices') {
        // Return all currently connected devices for discovery/monitoring
        const connectedDevices = Array.from(this.devices.entries()).map(([key, info]) => ({
          deviceId: info.deviceId,
          orgId: info.orgId || null,
          connectedSince: info.lastHeartbeat ? new Date(info.lastHeartbeat).toISOString() : null,
          lastHeartbeat: info.lastHeartbeat ? new Date(info.lastHeartbeat).toISOString() : null,
          protocol: 'websocket',
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ devices: connectedDevices, count: connectedDevices.length }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    this.wss = new WebSocketServer({ noServer: true });

    this.redis = new Redis({
      host: this.REDIS_HOST,
      port: this.REDIS_PORT,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.redisPub = new Redis({
      host: this.REDIS_HOST,
      port: this.REDIS_PORT,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    // Database connection pool
    this.db = new Pool({ connectionString: this.DATABASE_URL, max: 5 });
    this.db.on('error', (err) => this.logger.error('Database pool error', err));

    // Discovery services (UDP broadcast + mDNS)
    const discoveryConfig = {
      udpPort: this.UDP_DISCOVERY_PORT,
      wsPort: this.WS_PORT,
      httpPort: this.HTTP_PORT,
      serviceName: 'nodefleet',
      logger: this.logger,
    };
    this.udpDiscovery = new UDPDiscoveryService(discoveryConfig);
    this.mdnsResponder = new MDNSResponder(discoveryConfig);

    this.setupRedisErrorHandling();
    this.setupHTTPServer();
    this.setupWSServer();
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private setupRedisErrorHandling(): void {
    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error', error);
    });

    this.redis.on('connect', () => {
      this.logger.info('Redis connected');
    });

    this.redis.on('ready', () => {
      this.logger.info('Redis ready');
    });

    this.redisPub.on('error', (error) => {
      this.logger.error('Redis pub error', error);
    });
  }

  private setupHTTPServer(): void {
    this.server.on('upgrade', (request, socket, head) => {
      const parsedUrl = url.parse(request.url || '', true);
      const pathname = parsedUrl.pathname || '';
      const query = parsedUrl.query;
      const token = query.token as string;

      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      try {
        if (pathname === '/device') {
          this.verifyDeviceToken(token);
          this.wss.handleUpgrade(request, socket, head, (ws) => {
            this.handleDeviceConnection(ws, token);
          });
        } else if (pathname === '/dashboard') {
          this.verifyJWT(token);
          this.wss.handleUpgrade(request, socket, head, (ws) => {
            this.handleDashboardConnection(ws, token);
          });
        } else {
          socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
          socket.destroy();
        }
      } catch (error) {
        this.logger.error('Token verification failed', error);
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
      }
    });

    this.server.on('error', (error) => {
      this.logger.error('HTTP server error', error);
    });
  }

  private setupWSServer(): void {
    this.wss.on('error', (error) => {
      this.logger.error('WebSocket server error', error);
    });
  }

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  private verifyDeviceToken(token: string): { deviceId: string; orgId?: string; iat?: number } {
    try {
      const decoded = jwt.verify(token, this.DEVICE_TOKEN_SECRET) as {
        deviceId: string; orgId?: string; tokenId?: string; type?: string; iat?: number;
      };
      if (!decoded.deviceId) {
        throw new Error('Invalid device token: missing deviceId');
      }
      return decoded;
    } catch (error) {
      throw new Error(`Device token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async rotateTokenIfNeeded(deviceId: string, orgId: string | undefined, iat: number | undefined): Promise<void> {
    if (!iat || !orgId) return;

    // Rotate token if older than 30 days
    const tokenAge = Date.now() / 1000 - iat;
    const thirtyDays = 30 * 24 * 60 * 60;

    if (tokenAge < thirtyDays) return;

    this.logger.info(`Token rotation triggered for device ${deviceId} (age: ${Math.round(tokenAge / 86400)} days)`);

    try {
      // Issue new token
      const newToken = jwt.sign(
        { deviceId, orgId, type: 'device' },
        this.DEVICE_TOKEN_SECRET,
        { expiresIn: '365d' }
      );

      // Store in DB
      await this.db.query(
        `INSERT INTO device_tokens (device_id, token, issued_at, expires_at) VALUES ($1, $2, NOW(), NOW() + INTERVAL '365 days')`,
        [deviceId, newToken.slice(-64)]
      );

      // Send new token to device via WebSocket
      const device = this.devices.get(deviceId);
      if (device && device.ws.readyState === 1) {
        device.ws.send(JSON.stringify({
          type: 'token_refresh',
          token: newToken,
        }));
        this.logger.info(`New token sent to device ${deviceId}`);
      }

      // Audit log
      await this.db.query(
        `INSERT INTO audit_logs (device_id, action, details, created_at) VALUES ($1, 'config_changed', $2, NOW())`,
        [deviceId, JSON.stringify({ event: 'token_rotated', tokenAge: Math.round(tokenAge / 86400) })]
      );
    } catch (err) {
      this.logger.error(`Token rotation failed for ${deviceId}`, err);
    }
  }

  private verifyJWT(token: string): { userId: string; iat: number } {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as { userId: string; iat: number };
      if (!decoded.userId) {
        throw new Error('Invalid JWT: missing userId');
      }
      return decoded;
    } catch (error) {
      throw new Error(`JWT verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // CONNECTION HANDLERS
  // ============================================================================

  private handleDeviceConnection(ws: WebSocket.WebSocket, token: string): void {
    try {
      const decoded = this.verifyDeviceToken(token);
      const deviceId = decoded.deviceId;

      // Close previous connection if exists
      if (this.devices.has(deviceId)) {
        const oldDevice = this.devices.get(deviceId);
        if (oldDevice?.ws) {
          oldDevice.ws.close(1000, 'New connection from same device');
        }
      }

      const deviceInfo: DeviceInfo = {
        ws,
        deviceId,
        orgId: decoded.orgId,
        tokenIat: decoded.iat,
        lastHeartbeat: Date.now(),
        heartbeatTimer: null,
      };

      this.devices.set(deviceId, deviceInfo);

      this.logger.info('Device connected', {
        deviceId,
        connectedDevices: this.devices.size,
      });

      // Publish online status to Redis
      this.publishToRedis(`device:${deviceId}:status`, 'online');

      // Audit trail: device connected
      this.db.query(
        `INSERT INTO audit_logs (device_id, action, details, created_at) VALUES ($1, 'device_connected', $2, NOW())`,
        [deviceId, JSON.stringify({ connectedDevices: this.devices.size })]
      ).catch(() => {});

      // Setup heartbeat mechanism
      this.setupDeviceHeartbeat(deviceId);

      // Drain pending command queue from Redis
      this.drainCommandQueue(deviceId);

      // Handle messages from device
      ws.on('message', (data) => {
        this.handleDeviceMessage(deviceId, data);
      });

      ws.on('close', () => {
        this.handleDeviceDisconnection(deviceId);
      });

      ws.on('error', (error) => {
        this.logger.error(`Device error: ${deviceId}`, error);
      });

      ws.on('pong', () => {
        const device = this.devices.get(deviceId);
        if (device) {
          device.lastHeartbeat = Date.now();
        }
      });
    } catch (error) {
      this.logger.error('Device connection setup failed', error);
      ws.close(1008, 'Authentication failed');
    }
  }

  private handleDashboardConnection(ws: WebSocket.WebSocket, token: string): void {
    try {
      const decoded = this.verifyJWT(token);
      const userId = decoded.userId;

      const dashboardInfo: DashboardInfo = {
        userId,
        subscribedDevices: new Set(),
      };

      this.dashboards.set(ws, dashboardInfo);

      this.logger.info('Dashboard connected', {
        userId,
        connectedDashboards: this.dashboards.size,
      });

      ws.on('message', (data) => {
        this.handleDashboardMessage(ws, userId, data);
      });

      ws.on('close', () => {
        this.handleDashboardDisconnection(ws, userId);
      });

      ws.on('error', (error) => {
        this.logger.error(`Dashboard error: ${userId}`, error);
      });

      ws.on('pong', () => {
        // Keep-alive response
      });
    } catch (error) {
      this.logger.error('Dashboard connection setup failed', error);
      ws.close(1008, 'Authentication failed');
    }
  }

  // ============================================================================
  // DEVICE MESSAGE HANDLING
  // ============================================================================

  private handleDeviceMessage(deviceId: string, rawData: WebSocket.RawData): void {
    try {
      const message = JSON.parse(rawData.toString()) as DeviceMessage;

      this.logger.debug(`Device message from ${deviceId}`, { type: message.type });

      switch (message.type) {
        case 'heartbeat':
          this.handleHeartbeat(deviceId, message as HeartbeatMessage);
          break;

        case 'gps':
          this.handleGPS(deviceId, message as GPSMessage);
          break;

        case 'telemetry':
          this.handleTelemetry(deviceId, message as TelemetryMessage);
          break;

        case 'media_ready':
          this.handleMediaReady(deviceId, message as MediaReadyMessage);
          break;

        case 'command_ack':
          this.handleCommandAck(deviceId, message as CommandAckMessage);
          break;

        default:
          this.logger.warn(`Unknown message type from device ${deviceId}`, { type: (message as Record<string, unknown>).type });
      }
    } catch (error) {
      this.logger.error(`Failed to parse device message from ${deviceId}`, error);
    }
  }

  private handleHeartbeat(deviceId: string, message: HeartbeatMessage): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.lastHeartbeat = Date.now();
    }

    const heartbeatData = {
      deviceId,
      timestamp: Date.now(),
      battery: message.battery,
      signal: message.signal,
      cpuTemp: message.cpuTemp,
      freeMemory: message.freeMemory,
      uptime: message.uptime,
    };

    this.publishToRedis(`device:${deviceId}:heartbeat`, JSON.stringify(heartbeatData));

    // Persist to database
    const batteryLevel = Math.round(Number(message.battery) || 0);
    const signalStr = message.signal ? Math.round(Number(message.signal)) : null;
    const cpuTemp = message.cpuTemp ? Number(message.cpuTemp) : null;
    const freeMem = message.freeMemory ? Math.round(Number(message.freeMemory)) : null;
    const uptime = message.uptime ? Math.round(Number(message.uptime)) : null;

    this.db.query(
      `INSERT INTO telemetry_records (device_id, timestamp, battery_level, signal_strength, cpu_temp, free_memory, uptime_seconds)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6)`,
      [deviceId, batteryLevel, signalStr, cpuTemp, freeMem, uptime]
    ).catch(err => this.logger.error('Failed to persist telemetry', err));

    // Update device status
    this.db.query(
      `UPDATE devices SET status = 'online', last_heartbeat_at = NOW(), firmware_version = $2 WHERE id = $1`,
      [deviceId, (message as Record<string, unknown>).firmware_version || '1.0.0']
    ).catch(err => this.logger.error('Failed to update device status', err));

    // Broadcast to subscribed dashboards
    const subscribers = this.deviceSubscribers.get(deviceId);
    if (subscribers) {
      const broadcastMessage = JSON.stringify({
        type: 'heartbeat',
        deviceId,
        ...heartbeatData,
      });

      subscribers.forEach((clientWs) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(broadcastMessage);
        }
      });
    }

    // Drain any pending commands from Redis queue on each heartbeat
    this.drainCommandQueue(deviceId).catch(err =>
      this.logger.error('Command queue drain failed', err)
    );

    // Timeout stale commands (pending/sent > 5 minutes)
    this.db.query(
      `UPDATE device_commands SET status = 'timeout', completed_at = NOW()
       WHERE device_id = $1 AND status IN ('pending', 'sent')
       AND created_at < NOW() - INTERVAL '5 minutes'`,
      [deviceId]
    ).catch(err => this.logger.error('Command timeout update failed', err));

    // Token rotation check (every heartbeat, only rotates if > 30 days old)
    const deviceInfo = this.devices.get(deviceId);
    if (deviceInfo?.orgId && deviceInfo?.tokenIat) {
      this.rotateTokenIfNeeded(deviceId, deviceInfo.orgId, deviceInfo.tokenIat).catch(() => {});
    }

    // Update firmware version from heartbeat
    if ((message as Record<string, unknown>).firmware_version) {
      this.db.query(
        `UPDATE devices SET firmware_version = $2 WHERE id = $1 AND (firmware_version IS NULL OR firmware_version != $2)`,
        [deviceId, (message as Record<string, unknown>).firmware_version]
      ).catch(() => {});
    }

    this.logger.debug(`Heartbeat from ${deviceId}`, heartbeatData);
  }

  private handleGPS(deviceId: string, message: GPSMessage): void {
    const gpsData = {
      deviceId,
      timestamp: Date.now(),
      lat: message.lat,
      lng: message.lng,
      alt: message.alt,
      speed: message.speed,
      heading: message.heading,
      accuracy: message.accuracy,
      satellites: message.satellites,
    };

    this.publishToRedis(`device:${deviceId}:gps`, JSON.stringify(gpsData));

    // Persist to database
    this.db.query(
      `INSERT INTO gps_records (device_id, timestamp, latitude, longitude, altitude, speed, heading, accuracy, satellites)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8)`,
      [deviceId, message.lat, message.lng, message.alt || 0, message.speed || 0, message.heading || 0, message.accuracy || 0, message.satellites || 0]
    ).catch(err => this.logger.error('Failed to persist GPS', err));

    // Broadcast to subscribed dashboards
    const subscribers = this.deviceSubscribers.get(deviceId);
    if (subscribers) {
      const broadcastMessage = JSON.stringify({
        type: 'gps',
        ...gpsData,
      });

      subscribers.forEach((clientWs) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(broadcastMessage);
        }
      });
    }

    this.logger.debug(`GPS from ${deviceId}`, gpsData);
  }

  private handleTelemetry(deviceId: string, message: TelemetryMessage): void {
    const telemetryData = {
      deviceId,
      timestamp: Date.now(),
      data: message.data,
    };

    this.publishToRedis(`device:${deviceId}:telemetry`, JSON.stringify(telemetryData));

    // Broadcast to subscribed dashboards
    const subscribers = this.deviceSubscribers.get(deviceId);
    if (subscribers) {
      const broadcastMessage = JSON.stringify({
        type: 'telemetry',
        ...telemetryData,
      });

      subscribers.forEach((clientWs) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(broadcastMessage);
        }
      });
    }

    this.logger.debug(`Telemetry from ${deviceId}`, telemetryData);
  }

  private handleMediaReady(deviceId: string, message: MediaReadyMessage): void {
    const mediaData = {
      deviceId,
      timestamp: Date.now(),
      fileType: message.fileType,
      filename: message.filename,
      size: message.size,
      downloadId: uuidv4(),
    };

    this.publishToRedis(`device:${deviceId}:media_ready`, JSON.stringify(mediaData));

    // Notify subscribed dashboards
    const subscribers = this.deviceSubscribers.get(deviceId);
    if (subscribers) {
      const notificationMessage = JSON.stringify({
        type: 'media_ready',
        ...mediaData,
      });

      subscribers.forEach((clientWs) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(notificationMessage);
        }
      });
    }

    this.logger.info(`Media ready from ${deviceId}`, mediaData);
  }

  private handleCommandAck(deviceId: string, message: CommandAckMessage): void {
    const ackData = {
      deviceId,
      timestamp: Date.now(),
      commandId: message.commandId,
      status: message.status,
      result: message.result,
    };

    this.publishToRedis(`device:${deviceId}:command_ack`, JSON.stringify(ackData));

    // Map device status to DB enum: success→completed, error→failed
    const dbStatus = message.status === 'success' ? 'completed' : message.status === 'error' ? 'failed' : 'acknowledged';

    // Update command status in Redis and database
    this.updateCommandStatus(message.commandId, dbStatus, message.result);
    this.db.query(
      `UPDATE device_commands SET status = $1, result = $2, completed_at = NOW() WHERE id = $3`,
      [dbStatus, message.result ? JSON.stringify(message.result) : null, message.commandId]
    ).catch(err => this.logger.error('Failed to update command status in DB', err));

    // Notify subscribed dashboards
    const subscribers = this.deviceSubscribers.get(deviceId);
    if (subscribers) {
      const broadcastMessage = JSON.stringify({
        type: 'command_ack',
        ...ackData,
      });

      subscribers.forEach((clientWs) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(broadcastMessage);
        }
      });
    }

    this.logger.debug(`Command ACK from ${deviceId}`, ackData);
  }

  // ============================================================================
  // DASHBOARD MESSAGE HANDLING
  // ============================================================================

  private handleDashboardMessage(ws: WebSocket.WebSocket, userId: string, rawData: WebSocket.RawData): void {
    try {
      const message = JSON.parse(rawData.toString()) as DashboardMessage;
      const dashboardInfo = this.dashboards.get(ws);

      if (!dashboardInfo) {
        return;
      }

      this.logger.debug(`Dashboard message from ${userId}`, { type: message.type });

      switch (message.type) {
        case 'subscribe_device':
          this.handleSubscribeDevice(ws, userId, message as Record<string, unknown>);
          break;

        case 'unsubscribe_device':
          this.handleUnsubscribeDevice(ws, userId, message as Record<string, unknown>);
          break;

        case 'send_command':
          this.handleSendCommand(userId, message as Record<string, unknown>);
          break;

        case 'reload':
          this.handleReloadCommand(userId, message as Record<string, unknown>);
          break;

        default:
          this.logger.warn(`Unknown message type from dashboard ${userId}`, { type: (message as Record<string, unknown>).type });
      }
    } catch (error) {
      this.logger.error(`Failed to parse dashboard message from ${userId}`, error);
    }
  }

  private handleSubscribeDevice(ws: WebSocket.WebSocket, userId: string, message: Record<string, unknown>): void {
    const deviceId = message.deviceId as string;

    if (!deviceId) {
      this.sendDashboardError(ws, 'Missing deviceId');
      return;
    }

    const dashboardInfo = this.dashboards.get(ws);
    if (dashboardInfo) {
      dashboardInfo.subscribedDevices.add(deviceId);
    }

    if (!this.deviceSubscribers.has(deviceId)) {
      this.deviceSubscribers.set(deviceId, new Set());
    }

    this.deviceSubscribers.get(deviceId)?.add(ws);

    this.logger.info(`Dashboard subscribed to device`, {
      userId,
      deviceId,
      subscriberCount: this.deviceSubscribers.get(deviceId)?.size,
    });

    // Send subscription confirmation
    ws.send(
      JSON.stringify({
        type: 'subscription_confirmed',
        deviceId,
      })
    );
  }

  private handleUnsubscribeDevice(ws: WebSocket.WebSocket, userId: string, message: Record<string, unknown>): void {
    const deviceId = message.deviceId as string;

    if (!deviceId) {
      this.sendDashboardError(ws, 'Missing deviceId');
      return;
    }

    const dashboardInfo = this.dashboards.get(ws);
    if (dashboardInfo) {
      dashboardInfo.subscribedDevices.delete(deviceId);
    }

    this.deviceSubscribers.get(deviceId)?.delete(ws);

    this.logger.info(`Dashboard unsubscribed from device`, {
      userId,
      deviceId,
      subscriberCount: this.deviceSubscribers.get(deviceId)?.size,
    });

    // Send unsubscription confirmation
    ws.send(
      JSON.stringify({
        type: 'unsubscription_confirmed',
        deviceId,
      })
    );
  }

  private handleSendCommand(userId: string, message: Record<string, unknown>): void {
    const deviceId = message.deviceId as string;
    const command = message.command as string;
    const payload = message.payload as Record<string, unknown>;

    if (!deviceId || !command) {
      this.logger.warn('Invalid send_command message', { userId, message });
      return;
    }

    const commandId = uuidv4();
    const device = this.devices.get(deviceId);

    if (device && device.ws.readyState === WebSocket.OPEN) {
      // Send directly to device
      const commandMessage = JSON.stringify({
        type: 'command',
        commandId,
        command,
        payload: payload || {},
      });

      device.ws.send(commandMessage);

      this.logger.info(`Command sent to device`, {
        deviceId,
        commandId,
        command,
        userId,
      });
    } else {
      // Device not connected, publish to Redis for queuing
      const queueMessage = JSON.stringify({
        type: 'command',
        commandId,
        command,
        payload: payload || {},
        userId,
        timestamp: Date.now(),
      });

      this.publishToRedis(`device:${deviceId}:command_queue`, queueMessage);

      this.logger.info(`Command queued for device`, {
        deviceId,
        commandId,
        command,
        userId,
      });
    }
  }

  private handleReloadCommand(userId: string, message: Record<string, unknown>): void {
    const deviceId = message.deviceId as string;

    if (!deviceId) {
      this.logger.warn('Invalid reload message', { userId });
      return;
    }

    const commandId = uuidv4();
    const device = this.devices.get(deviceId);

    if (device && device.ws.readyState === WebSocket.OPEN) {
      const reloadMessage = JSON.stringify({
        type: 'command',
        commandId,
        command: 'reload',
        payload: {},
      });

      device.ws.send(reloadMessage);

      this.logger.info(`Reload command sent to device`, {
        deviceId,
        commandId,
        userId,
      });
    } else {
      const queueMessage = JSON.stringify({
        type: 'command',
        commandId,
        command: 'reload',
        payload: {},
        userId,
        timestamp: Date.now(),
      });

      this.publishToRedis(`device:${deviceId}:command_queue`, queueMessage);

      this.logger.info(`Reload command queued for device`, {
        deviceId,
        commandId,
        userId,
      });
    }
  }

  // ============================================================================
  // DISCONNECTION HANDLERS
  // ============================================================================

  private handleDeviceDisconnection(deviceId: string): void {
    const device = this.devices.get(deviceId);

    if (device?.heartbeatTimer) {
      clearInterval(device.heartbeatTimer);
    }

    this.devices.delete(deviceId);

    this.logger.info('Device disconnected', {
      deviceId,
      connectedDevices: this.devices.size,
    });

    // Publish offline status to Redis
    this.publishToRedis(`device:${deviceId}:status`, 'offline');

    // Audit trail: device disconnected
    this.db.query(
      `INSERT INTO audit_logs (device_id, action, created_at) VALUES ($1, 'device_disconnected', NOW())`,
      [deviceId]
    ).catch(() => {});

    // Update device status to offline
    this.db.query(
      `UPDATE devices SET status = 'offline' WHERE id = $1`,
      [deviceId]
    ).catch(() => {});

    // Notify subscribed dashboards
    const subscribers = this.deviceSubscribers.get(deviceId);
    if (subscribers) {
      const offlineMessage = JSON.stringify({
        type: 'device_offline',
        deviceId,
        timestamp: Date.now(),
      });

      subscribers.forEach((clientWs) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(offlineMessage);
        }
      });
    }
  }

  private handleDashboardDisconnection(ws: WebSocket.WebSocket, userId: string): void {
    const dashboardInfo = this.dashboards.get(ws);

    // Clean up subscriptions
    if (dashboardInfo) {
      dashboardInfo.subscribedDevices.forEach((deviceId) => {
        this.deviceSubscribers.get(deviceId)?.delete(ws);
      });
    }

    this.dashboards.delete(ws);

    this.logger.info('Dashboard disconnected', {
      userId,
      connectedDashboards: this.dashboards.size,
    });
  }

  // ============================================================================
  // WEB API INTEGRATION
  // ============================================================================

  private async updateCommandStatus(commandId: string, status: string, result?: unknown): Promise<void> {
    try {
      const key = `command:${commandId}:status`;
      await this.redisPub.set(key, JSON.stringify({ status, result, updatedAt: Date.now() }), 'EX', 86400);
    } catch (error) {
      this.logger.error('Failed to update command status', error);
    }
  }

  // ============================================================================
  // COMMAND QUEUE PROCESSING
  // ============================================================================

  private async drainCommandQueue(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) {
      return;
    }

    const queueKey = `device:${deviceId}:commands`;

    try {
      // Pop all pending commands from the Redis list
      let cmd = await this.redis.rpop(queueKey);
      if (cmd) {
        this.logger.info(`Found queued command for ${deviceId}, processing...`);
      }
      while (cmd) {
        try {
          const parsed = JSON.parse(cmd);
          const commandMessage = JSON.stringify({
            type: 'command',
            commandId: parsed.id,
            command: parsed.command,
            payload: parsed.payload || {},
          });

          device.ws.send(commandMessage);

          // Update command status to 'sent' in Redis (web app reads this)
          await this.redisPub.publish(
            `device:${deviceId}:command_status`,
            JSON.stringify({ commandId: parsed.id, status: 'sent' })
          );

          this.logger.info('Queued command sent to device', {
            deviceId,
            commandId: parsed.id,
            command: parsed.command,
          });
        } catch (parseError) {
          this.logger.error('Failed to parse queued command', parseError);
        }

        cmd = await this.redis.rpop(queueKey);
      }
    } catch (error) {
      this.logger.error(`Failed to drain command queue for ${deviceId}`, error);
    }
  }

  // ============================================================================
  // HEARTBEAT MECHANISM
  // ============================================================================

  private setupDeviceHeartbeat(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (!device) return;

    if (device.heartbeatTimer) {
      clearInterval(device.heartbeatTimer);
    }

    device.heartbeatTimer = setInterval(() => {
      const device = this.devices.get(deviceId);
      if (!device) {
        return;
      }

      const timeSinceLastHeartbeat = Date.now() - device.lastHeartbeat;

      if (timeSinceLastHeartbeat > this.HEARTBEAT_TIMEOUT) {
        this.logger.warn(`Device ${deviceId} heartbeat timeout`, { timeSinceLastHeartbeat });
        device.ws.close(1000, 'Heartbeat timeout');
        this.handleDeviceDisconnection(deviceId);
      } else {
        // Send ping
        if (device.ws.readyState === WebSocket.OPEN) {
          device.ws.ping();
        }
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  // ============================================================================
  // REDIS OPERATIONS
  // ============================================================================

  private publishToRedis(channel: string, message: string): void {
    this.redisPub.publish(channel, message).catch((error) => {
      this.logger.error(`Failed to publish to Redis channel ${channel}`, error);
    });
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  private sendDashboardError(ws: WebSocket.WebSocket, error: string): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'error',
          message: error,
          timestamp: Date.now(),
        })
      );
    }
  }

  // ============================================================================
  // SERVER LIFECYCLE
  // ============================================================================

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.WS_PORT, async () => {
        this.logger.info(`WebSocket server listening on port ${this.WS_PORT}`);
        this.logger.info('Device path: /device?token=xxx');
        this.logger.info('Dashboard path: /dashboard?token=xxx');

        // Telemetry retention: clean up records older than 90 days on startup
        this.db.query(
          `DELETE FROM telemetry_records WHERE timestamp < NOW() - INTERVAL '90 days'`
        ).then(res => {
          if (res.rowCount && res.rowCount > 0) {
            this.logger.info(`Telemetry retention: cleaned ${res.rowCount} records older than 90 days`);
          }
        }).catch(err => this.logger.error('Telemetry retention cleanup failed', err));

        this.db.query(
          `DELETE FROM gps_records WHERE timestamp < NOW() - INTERVAL '90 days'`
        ).then(res => {
          if (res.rowCount && res.rowCount > 0) {
            this.logger.info(`GPS retention: cleaned ${res.rowCount} records older than 90 days`);
          }
        }).catch(err => this.logger.error('GPS retention cleanup failed', err));

        // Mark stale offline devices (no heartbeat > 5 minutes)
        this.db.query(
          `UPDATE devices SET status = 'offline' WHERE status = 'online' AND last_heartbeat_at < NOW() - INTERVAL '5 minutes'`
        ).catch(() => {});

        // Start discovery services
        if (this.ENABLE_DISCOVERY) {
          try {
            await this.udpDiscovery.start();
          } catch (err) {
            this.logger.error('UDP Discovery failed to start (non-fatal)', err);
          }
          try {
            await this.mdnsResponder.start();
          } catch (err) {
            this.logger.error('mDNS responder failed to start (non-fatal)', err);
          }
        }

        resolve();
      });

      this.server.on('error', (error) => {
        this.logger.error('Failed to start server', error);
        reject(error);
      });
    });
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping WebSocket server...');

    // Close all connections
    this.devices.forEach((device) => {
      if (device.heartbeatTimer) {
        clearInterval(device.heartbeatTimer);
      }
      if (device.ws.readyState === WebSocket.OPEN) {
        device.ws.close(1000, 'Server shutting down');
      }
    });

    this.dashboards.forEach((_, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Server shutting down');
      }
    });

    // Stop discovery services
    await this.udpDiscovery.stop();
    await this.mdnsResponder.stop();

    // Close Redis and database connections
    await this.redis.quit();
    await this.redisPub.quit();
    await this.db.end();

    // Close HTTP server
    return new Promise((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          this.logger.error('Error closing server', error);
          reject(error);
        } else {
          this.logger.info('WebSocket server stopped');
          resolve();
        }
      });
    });
  }

  // ============================================================================
  // GETTERS (for monitoring/status)
  // ============================================================================

  getDeviceCount(): number {
    return this.devices.size;
  }

  getDashboardCount(): number {
    return this.dashboards.size;
  }

  getDeviceIds(): string[] {
    return Array.from(this.devices.keys());
  }

  getDeviceStatus(deviceId: string): { online: boolean; uptime?: number } | null {
    const device = this.devices.get(deviceId);
    if (!device) {
      return null;
    }

    return {
      online: device.ws.readyState === WebSocket.OPEN,
      uptime: Date.now() - device.lastHeartbeat,
    };
  }
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

async function main(): Promise<void> {
  const server = new NodeFleetWSServer();

  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    await server.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
