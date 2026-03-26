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
    const url = req.url || '/';
    const method = req.method || 'GET';

    // Health check endpoint for Docker
    if (url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        devices: deviceManager.getAllDevices().length,
        uptime: process.uptime(),
      }));
      return;
    }

    // GET /device-info/{id} — device identity info
    const deviceInfoMatch = url.match(/^\/device-info\/(\d+)$/);
    if (deviceInfoMatch && method === 'GET') {
      const deviceId = parseInt(deviceInfoMatch[1], 10);
      const device = deviceManager.getDevice(deviceId);
      if (!device) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Device ${deviceId} not found` }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(device.getDeviceInfo()));
      return;
    }

    // POST /device/{id}/dataset — upload biometric dataset
    const datasetPostMatch = url.match(/^\/device\/(\d+)\/dataset$/);
    if (datasetPostMatch && method === 'POST') {
      const deviceId = parseInt(datasetPostMatch[1], 10);
      const device = deviceManager.getDevice(deviceId);
      if (!device) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Device ${deviceId} not found` }));
        return;
      }
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const readings = JSON.parse(body);
          if (!Array.isArray(readings) || readings.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Body must be a non-empty array of VitalReading' }));
            return;
          }
          device.loadDataset(readings);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'loaded', readings: readings.length }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // DELETE /device/{id}/dataset — revert to synthetic
    const datasetDeleteMatch = url.match(/^\/device\/(\d+)\/dataset$/);
    if (datasetDeleteMatch && method === 'DELETE') {
      const deviceId = parseInt(datasetDeleteMatch[1], 10);
      const device = deviceManager.getDevice(deviceId);
      if (!device) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Device ${deviceId} not found` }));
        return;
      }
      device.clearDataset();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'cleared', mode: 'synthetic' }));
      return;
    }

    // GET /device/{id}/dataset/status — check mode
    const datasetStatusMatch = url.match(/^\/device\/(\d+)\/dataset\/status$/);
    if (datasetStatusMatch && method === 'GET') {
      const deviceId = parseInt(datasetStatusMatch[1], 10);
      const device = deviceManager.getDevice(deviceId);
      if (!device) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Device ${deviceId} not found` }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(device.getDatasetStatus()));
      return;
    }

    // GET /device/{id}/state — returns device state, paired user, dataset status
    const deviceStateMatch = url.match(/^\/device\/(\d+)\/state$/);
    if (deviceStateMatch && method === 'GET') {
      const deviceId = parseInt(deviceStateMatch[1], 10);
      const device = deviceManager.getDevice(deviceId);
      if (!device) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Device ${deviceId} not found` }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        state: device.state,
        pairedUserId: device.pairedUserId,
        datasetStatus: device.getDatasetStatus(),
        serialNumber: device.serialNumber,
        modelNumber: device.modelNumber,
        firmwareVersion: device.firmwareVersion,
        macAddress: device.macAddress,
        lastReading: device.getLastReading(),
      }));
      return;
    }

    // Serve the watch UI
    if (url === '/' || url === '/index.html') {
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

  // Send device-info as first message
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'device-info',
      serialNumber: device.serialNumber,
      macAddress: device.macAddress,
      firmwareVersion: device.firmwareVersion,
      modelNumber: device.modelNumber,
    }));
  }

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

  // Handle write commands from client (for mobile handshake + pairing emulation)
  ws.on('message', (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.action === 'pair' && msg.userId) {
        device.pair(msg.userId);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'pair-ack',
            serialNumber: device.serialNumber,
            status: 'paired',
            userId: msg.userId,
          }));
        }
      } else if (msg.action === 'unpair') {
        device.unpair();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'pair-ack',
            serialNumber: device.serialNumber,
            status: 'unpaired',
          }));
        }
      } else if (msg.action === 'write') {
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
