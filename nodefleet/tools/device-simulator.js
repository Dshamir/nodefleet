#!/usr/bin/env node
/**
 * NodeFleet Device Simulator
 *
 * Simulates an ESP32-S3 SIM7670G device for dashboard development
 * without physical hardware. Sends heartbeat, GPS, and responds to commands.
 *
 * Usage:
 *   # First create a device in the dashboard and get pairing code
 *   node tools/device-simulator.js --pair <PAIRING_CODE>
 *
 *   # Or use an existing token
 *   node tools/device-simulator.js --token <JWT_TOKEN>
 *
 *   # Custom server
 *   node tools/device-simulator.js --pair ABC123 --host 192.168.0.19 --port 50081 --api-port 50300
 */

import WebSocket from 'ws';

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
};

const HOST = getArg('host') || 'localhost';
const WS_PORT = getArg('port') || '50081';
const API_PORT = getArg('api-port') || '50300';
const PAIRING_CODE = getArg('pair');
let TOKEN = getArg('token');

const HEARTBEAT_INTERVAL = 30000;
const GPS_INTERVAL = 60000;

// Simulated device state
const state = {
  battery: 85 + Math.random() * 10,
  signal: -70 + Math.floor(Math.random() * 20),
  cpuTemp: 35 + Math.random() * 10,
  freeMemory: 180000 + Math.floor(Math.random() * 50000),
  uptime: 0,
  lat: 45.5017 + (Math.random() - 0.5) * 0.01,
  lng: -73.5673 + (Math.random() - 0.5) * 0.01,
  alt: 30 + Math.random() * 20,
  speed: 0,
  heading: Math.random() * 360,
};

async function pair() {
  console.log(`[SIM] Pairing with code: ${PAIRING_CODE}`);
  const res = await fetch(`http://${HOST}:${API_PORT}/api/devices/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pairingCode: PAIRING_CODE }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`[SIM] Pairing failed:`, data);
    process.exit(1);
  }
  console.log(`[SIM] Paired! Device: ${data.deviceName} (${data.deviceId})`);
  return data.token;
}

function connect(token) {
  const url = `ws://${HOST}:${WS_PORT}/device?token=${token}`;
  console.log(`[SIM] Connecting to ${HOST}:${WS_PORT}...`);

  const ws = new WebSocket(url);
  const bootTime = Date.now();

  ws.on('open', () => {
    console.log(`[SIM] Connected! Sending heartbeats every ${HEARTBEAT_INTERVAL / 1000}s`);

    // Heartbeat loop
    const hbInterval = setInterval(() => {
      state.uptime = Math.floor((Date.now() - bootTime) / 1000);
      state.battery = Math.max(0, state.battery - 0.01);
      state.cpuTemp = 35 + Math.random() * 10;
      state.freeMemory = 180000 + Math.floor(Math.random() * 50000);

      const hb = {
        type: 'heartbeat',
        battery: Math.round(state.battery),
        signal: state.signal,
        cpuTemp: parseFloat(state.cpuTemp.toFixed(1)),
        freeMemory: state.freeMemory,
        uptime: state.uptime,
        firmware_version: '1.0.0-sim',
      };
      ws.send(JSON.stringify(hb));
      console.log(`[HB] battery=${hb.battery}% signal=${hb.signal}dBm temp=${hb.cpuTemp}C uptime=${hb.uptime}s`);
    }, HEARTBEAT_INTERVAL);

    // GPS loop
    const gpsInterval = setInterval(() => {
      // Simulate slow drift
      state.lat += (Math.random() - 0.5) * 0.0001;
      state.lng += (Math.random() - 0.5) * 0.0001;
      state.speed = Math.random() * 2;
      state.heading = (state.heading + (Math.random() - 0.5) * 10) % 360;

      const gps = {
        type: 'gps',
        lat: parseFloat(state.lat.toFixed(6)),
        lng: parseFloat(state.lng.toFixed(6)),
        alt: parseFloat(state.alt.toFixed(1)),
        speed: parseFloat(state.speed.toFixed(1)),
        heading: parseFloat(state.heading.toFixed(1)),
        accuracy: 5,
        satellites: 8 + Math.floor(Math.random() * 6),
      };
      ws.send(JSON.stringify(gps));
      console.log(`[GPS] ${gps.lat}, ${gps.lng} alt=${gps.alt}m spd=${gps.speed}m/s sat=${gps.satellites}`);
    }, GPS_INTERVAL);

    ws.on('close', () => {
      clearInterval(hbInterval);
      clearInterval(gpsInterval);
      console.log('[SIM] Disconnected. Reconnecting in 5s...');
      setTimeout(() => connect(token), 5000);
    });
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log(`[CMD] Received: ${msg.command} (id: ${msg.commandId})`);

    let status = 'success';
    let result = '';

    switch (msg.command) {
      case 'capture_photo':
        result = 'Simulated photo captured (320x240 JPEG, 4.2KB)';
        break;
      case 'capture_video':
        result = 'Simulated video captured (5s MJPEG, 150KB)';
        break;
      case 'record_audio':
        result = 'Simulated audio recorded (3s WAV, 96KB)';
        break;
      case 'get_status':
        result = JSON.stringify(state);
        break;
      case 'reboot':
        result = 'Simulated reboot (reconnecting in 3s)';
        setTimeout(() => { ws.close(); }, 1000);
        break;
      case 'factory_reset':
        result = 'Simulated factory reset';
        break;
      case 'set_config':
        result = `Config set: ${msg.payload?.key}=${msg.payload?.value}`;
        break;
      case 'read_config':
        result = `${msg.payload?.key}=simulated_value`;
        break;
      case 'power_mode':
        result = `Power mode: ${msg.payload?.mode}`;
        break;
      default:
        status = 'error';
        result = `Unknown command: ${msg.command}`;
    }

    const ack = {
      type: 'command_ack',
      commandId: msg.commandId,
      status,
      result,
    };
    ws.send(JSON.stringify(ack));
    console.log(`[ACK] ${msg.command} → ${status}: ${result}`);
  });

  ws.on('error', (err) => {
    console.error(`[SIM] Error:`, err.message);
  });
}

async function main() {
  if (!TOKEN && !PAIRING_CODE) {
    console.log('Usage:');
    console.log('  node tools/device-simulator.js --pair <CODE>');
    console.log('  node tools/device-simulator.js --token <JWT>');
    console.log('Options:');
    console.log('  --host <ip>       Server host (default: localhost)');
    console.log('  --port <port>     WS port (default: 50081)');
    console.log('  --api-port <port> API port (default: 50300)');
    process.exit(1);
  }

  if (PAIRING_CODE) {
    TOKEN = await pair();
  }

  connect(TOKEN);
}

main().catch(console.error);
