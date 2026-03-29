import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { devices } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as dgram from 'dgram';
import { createLogger } from '@/lib/logger';

const logger = createLogger('discovery');

interface DiscoveredDevice {
  ip: string;
  port: number;
  deviceId?: string;
  name?: string;
  status?: string;
  protocol: 'websocket' | 'udp' | 'mdns' | 'database';
  response: Record<string, unknown>;
  discoveredAt: string;
}

/**
 * GET /api/discovery — Multi-protocol device discovery.
 *
 * Uses 3 redundant discovery methods:
 *   1. WebSocket — Queries ws-server /devices endpoint for live connections
 *   2. UDP Broadcast — Sends NODEFLEET_ESP32_SCAN on port 5556 for LAN devices
 *   3. Database — Queries devices table for known online devices
 *
 * Results are merged and deduplicated by deviceId.
 * Discovery service health is checked via UDP probe on port 5555.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allDevices: DiscoveredDevice[] = [];
    const seenDeviceIds = new Set<string>();
    let serverDiscoveryOnline = false;

    // --- Protocol 1: WebSocket-connected devices (most reliable) ---
    try {
      const wsUrl = process.env.WS_SERVER_URL?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://ws-server:8080';
      const wsRes = await fetch(`${wsUrl}/devices`, {
        signal: AbortSignal.timeout(3000),
      });
      if (wsRes.ok) {
        const data = await wsRes.json();
        serverDiscoveryOnline = true;
        if (data.devices && Array.isArray(data.devices)) {
          for (const d of data.devices) {
            if (d.deviceId && !seenDeviceIds.has(d.deviceId)) {
              seenDeviceIds.add(d.deviceId);
              allDevices.push({
                ip: 'ws-server',
                port: 8080,
                deviceId: d.deviceId,
                name: d.deviceId,
                status: 'connected',
                protocol: 'websocket',
                response: {
                  orgId: d.orgId,
                  lastHeartbeat: d.lastHeartbeat,
                  connectedSince: d.connectedSince,
                },
                discoveredAt: new Date().toISOString(),
              });
            }
          }
          logger.info(`WebSocket discovery: found ${data.devices.length} connected device(s)`);
        }
      }
    } catch (err) {
      logger.warn('WebSocket discovery probe failed', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    }

    // --- Protocol 1b: UDP discovery service health check ---
    if (!serverDiscoveryOnline) {
      try {
        const probeResult = await probeUDP('ws-server', 5555, 'NODEFLEET_DISCOVER', 2000);
        if (probeResult) {
          serverDiscoveryOnline = true;
        }
      } catch {}
    }

    // --- Protocol 2: UDP Broadcast scan for ESP32 devices on LAN ---
    try {
      const udpDevices = await broadcastScan(5556, 'NODEFLEET_ESP32_SCAN', 3000);
      for (const d of udpDevices) {
        const deviceId = d.response.deviceId as string | undefined;
        if (deviceId && seenDeviceIds.has(deviceId)) continue; // dedup
        if (deviceId) seenDeviceIds.add(deviceId);
        allDevices.push({
          ...d,
          protocol: 'udp',
        });
      }
      if (udpDevices.length > 0) {
        logger.info(`UDP broadcast discovery: found ${udpDevices.length} device(s)`);
      }
    } catch {}

    // --- Protocol 3: Database — known online devices as fallback ---
    try {
      const dbDevices = await db
        .select({
          id: devices.id,
          name: devices.name,
          hwModel: devices.hwModel,
          status: devices.status,
          ipAddress: devices.ipAddress,
          lastHeartbeatAt: devices.lastHeartbeatAt,
        })
        .from(devices)
        .where(eq(devices.status, 'online'));

      for (const d of dbDevices) {
        if (seenDeviceIds.has(d.id)) continue; // dedup — already found via WS or UDP
        seenDeviceIds.add(d.id);
        allDevices.push({
          ip: d.ipAddress || 'unknown',
          port: 0,
          deviceId: d.id,
          name: d.name,
          status: d.status,
          protocol: 'database',
          response: {
            hwModel: d.hwModel,
            lastHeartbeat: d.lastHeartbeatAt?.toISOString(),
            note: 'Found in database but not detected via WebSocket or UDP — may be stale',
          },
          discoveredAt: new Date().toISOString(),
        });
      }

      if (dbDevices.length > 0) {
        logger.info(`Database discovery: found ${dbDevices.length} online device(s), ${dbDevices.length - (allDevices.length - dbDevices.length)} new`);
      }
    } catch (err) {
      logger.warn('Database discovery query failed', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    }

    // Count by protocol for reporting
    const byProtocol = {
      websocket: allDevices.filter(d => d.protocol === 'websocket').length,
      udp: allDevices.filter(d => d.protocol === 'udp').length,
      database: allDevices.filter(d => d.protocol === 'database').length,
    };

    return NextResponse.json({
      serverDiscoveryOnline,
      devices: allDevices,
      count: allDevices.length,
      byProtocol,
      scannedAt: new Date().toISOString(),
      message: allDevices.length > 0
        ? `Found ${allDevices.length} device(s) via ${Object.entries(byProtocol).filter(([,v]) => v > 0).map(([k,v]) => `${k} (${v})`).join(', ')}`
        : 'No devices found. Make sure ESP32 devices are powered on and connected to the same network.',
    });
  } catch (error) {
    logger.error('Discovery scan error', { error: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}

function probeUDP(host: string, port: number, message: string, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const timer = setTimeout(() => {
      socket.close();
      resolve(null);
    }, timeoutMs);

    socket.on('message', (msg) => {
      clearTimeout(timer);
      const response = msg.toString();
      socket.close();
      resolve(response);
    });

    socket.on('error', () => {
      clearTimeout(timer);
      socket.close();
      resolve(null);
    });

    const buf = Buffer.from(message);
    socket.send(buf, port, host, (err) => {
      if (err) {
        clearTimeout(timer);
        socket.close();
        resolve(null);
      }
    });
  });
}

function broadcastScan(port: number, message: string, timeoutMs: number): Promise<DiscoveredDevice[]> {
  return new Promise((resolve) => {
    const devices: DiscoveredDevice[] = [];
    const seen = new Set<string>();

    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    const timer = setTimeout(() => {
      socket.close();
      resolve(devices);
    }, timeoutMs);

    socket.on('message', (msg, rinfo) => {
      const key = `${rinfo.address}:${rinfo.port}`;
      if (seen.has(key)) return;
      seen.add(key);

      try {
        const data = JSON.parse(msg.toString());
        devices.push({
          ip: rinfo.address,
          port: rinfo.port,
          protocol: 'udp',
          response: data,
          discoveredAt: new Date().toISOString(),
        });
      } catch {
        devices.push({
          ip: rinfo.address,
          port: rinfo.port,
          protocol: 'udp',
          response: { raw: msg.toString() },
          discoveredAt: new Date().toISOString(),
        });
      }
    });

    socket.on('error', () => {
      clearTimeout(timer);
      socket.close();
      resolve(devices);
    });

    socket.bind(() => {
      try {
        socket.setBroadcast(true);
        const buf = Buffer.from(message);
        socket.send(buf, port, '255.255.255.255', (err) => {
          if (err) {
            clearTimeout(timer);
            socket.close();
            resolve(devices);
          }
        });
      } catch {
        clearTimeout(timer);
        socket.close();
        resolve(devices);
      }
    });
  });
}
