import { IncomingMessage } from 'http';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { DeviceManager } from './device-manager';
import { BleNotification, VitalReading } from './types';
import { config } from './config';

export function createWsServer(deviceManager: DeviceManager): http.Server {
  // Resolve public dir — works from both src/ (dev) and dist/ (built)
  const publicDir = fs.existsSync(path.join(__dirname, 'public'))
    ? path.join(__dirname, 'public')
    : path.join(__dirname, '..', 'src', 'public');

  const server = http.createServer((req, res) => {
    // Health check endpoint for Docker
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        devices: deviceManager.getAllDevices().length,
        uptime: process.uptime(),
      }));
      return;
    }

    // Serve the watch UI
    if (req.url === '/' || req.url === '/index.html') {
      const htmlPath = path.join(publicDir, 'index.html');
      if (fs.existsSync(htmlPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(htmlPath));
        return;
      }
    }

    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = req.url || '/';

    if (url === '/scan') {
      handleScan(ws, deviceManager);
    } else if (url.startsWith('/device/')) {
      const idStr = url.replace('/device/', '');
      const deviceId = parseInt(idStr, 10);
      handleDeviceConnection(ws, deviceManager, deviceId);
    } else {
      ws.close(4004, `Unknown path: ${url}`);
    }
  });

  return server;
}

function handleScan(ws: WebSocket, deviceManager: DeviceManager): void {
  console.log('[WS] Scan client connected');

  // Send device list immediately, then every 2s
  const send = () => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(deviceManager.getAdvertisingDevices()));
    }
  };
  send();
  const interval = setInterval(send, 2000);

  ws.on('close', () => {
    clearInterval(interval);
    console.log('[WS] Scan client disconnected');
  });
}

function handleDeviceConnection(
  ws: WebSocket,
  deviceManager: DeviceManager,
  deviceId: number,
): void {
  const device = deviceManager.getDevice(deviceId);
  if (!device) {
    ws.close(4004, `Device ${deviceId} not found`);
    return;
  }

  console.log(`[WS] Client connected to device ${device.name}`);
  device.connect();

  // Forward BLE notifications to the WS client
  const onNotification = (notification: BleNotification) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(notification));
    }
  };

  // Forward decoded vitals as a convenience event
  const onVitals = (vitals: VitalReading) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'vitals', ...vitals }));
    }
  };

  device.on('notification', onNotification);
  device.on('vitals', onVitals);

  // Handle write commands from client (for mobile handshake emulation)
  ws.on('message', (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.action === 'write') {
        console.log(`[WS] Write to ${device.name} char ${msg.characteristic}: [${msg.data}]`);
        // Acknowledge — in real BLE the device would process the command
      }
    } catch {
      // Ignore non-JSON messages
    }
  });

  ws.on('close', () => {
    device.removeListener('notification', onNotification);
    device.removeListener('vitals', onVitals);
    device.disconnect();
    console.log(`[WS] Client disconnected from device ${device.name}`);
  });
}
