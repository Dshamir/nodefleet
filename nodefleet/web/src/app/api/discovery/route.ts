import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import * as dgram from 'dgram';

interface DiscoveredDevice {
  ip: string;
  port: number;
  response: Record<string, unknown>;
  discoveredAt: string;
}

/**
 * GET /api/discovery — Scan the local network for ESP32 devices.
 *
 * Sends a UDP broadcast "NODEFLEET_ESP32_SCAN" on port 5556.
 * ESP32 devices running the NodeFleet firmware respond with their info.
 *
 * Also probes the ws-server's discovery service on port 5555 to verify
 * the server-side discovery is running.
 *
 * Timeout: 3 seconds (waits for all responses).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const discovered: DiscoveredDevice[] = [];
    let serverDiscoveryOnline = false;

    // Probe 1: Check if ws-server discovery is running
    try {
      const serverResult = await probeUDP('ws-server', 5555, 'NODEFLEET_DISCOVER', 2000);
      if (serverResult) {
        serverDiscoveryOnline = true;
      }
    } catch {}

    // Probe 2: Broadcast scan for ESP32 devices on the network
    // ESP32 devices listen on port 5556 for "NODEFLEET_ESP32_SCAN"
    // and respond with their device info (serial, model, status, IP)
    try {
      const devices = await broadcastScan(5556, 'NODEFLEET_ESP32_SCAN', 3000);
      discovered.push(...devices);
    } catch {}

    return NextResponse.json({
      serverDiscoveryOnline,
      devices: discovered,
      scannedAt: new Date().toISOString(),
      message: discovered.length > 0
        ? `Found ${discovered.length} device(s) on the network`
        : 'No devices found. Make sure ESP32 devices are powered on and connected to the same network.',
    });
  } catch (error) {
    console.error('Discovery scan error:', error);
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
          response: data,
          discoveredAt: new Date().toISOString(),
        });
      } catch {
        // Non-JSON response — still record the device
        devices.push({
          ip: rinfo.address,
          port: rinfo.port,
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
