#!/usr/bin/env node
/**
 * Seed Dev Wiki: Scan/Select/Pair UX for Simulation Mode
 * Run: docker compose exec admin-backend node scripts/seed-wiki-scan-select-pair.js
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://mongodb:27017/dental';

const articles = [
  {
    section: 'guides',
    title: 'Scan / Select / Pair UX — Simulation Mode Device Picker (2026-03-26)',
    slug: 'scan-select-pair-ux-2026-03-26',
    tags: ['simulation', 'device-picker', 'ble', 'pairing', 'websocket', 'mobile-app', 'redux', 'connect-ble'],
    author: 'system',
    status: 'published',
    content: `# Scan / Select / Pair UX — Simulation Mode Device Picker

**Date:** 2026-03-26
**Files modified:** \`ws-device-simulator.ts\`, \`connect-device.slice.ts\`, \`ConnectBle.tsx\`, \`drawer.stack.tsx\`

---

## Problem

Simulation mode hardcoded connection to \`devices[0]\` (ZENZERS-000) with no user choice. User needed a proper scan → select → pair flow matching the real BLE experience.

## Solution

### 1. ws-device-simulator.ts — Refactored API

| Old API | New API | Purpose |
|---------|---------|---------|
| \`startSimulation(dispatch)\` | \`startSimulationScan(dispatch)\` | Scan only, no auto-connect |
| (none) | \`connectToDevice(dispatch, deviceId)\` | Connect to user-chosen device |
| (none) | \`pairDevice(userId)\` | Send pair command over WS |
| (none) | \`disconnectSimulatedDevice(dispatch)\` | Disconnect current device |

### 2. connect-device.slice.ts — New State

\`\`\`typescript
simulatedDevices: SimulatedDevice[]    // Discovered emulated devices
simulationPairStatus: SimulationPairStatus  // 'idle' | 'connecting' | 'pairing' | 'paired'
\`\`\`

### 3. ConnectBle.tsx — SimulationDeviceList Component

When \`isSimulationMode()\`:
- Shows "Scanning for devices..." spinner while waiting for first WS scan result
- Lists 5 ZENZERS devices with name, serial number, RSSI signal
- Tap a device → "Connecting..." → "Pairing..." → "Paired ✓" → navigate to Vitals
- Shows disconnect button when paired

### 4. drawer.stack.tsx

Changed \`startSimulation(dispatch)\` → \`startSimulationScan(dispatch)\` so it only scans on mount.

## Verification

| Test | Expected |
|------|----------|
| App → ConnectBle screen | Shows 5 ZENZERS devices |
| Tap ZENZERS-002 | Connecting → Pairing → Paired → Vitals |
| Vitals screen shows data | From selected device (not always device 0) |
`,
  },
];

async function seed() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const col = db.collection('devWikiPages');

    for (const article of articles) {
      const now = new Date();
      await col.updateOne(
        { slug: article.slug },
        {
          $set: {
            ...article,
            body: article.content,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
            createdBy: 'system',
            editHistory: [],
            deleted: false,
            sortOrder: 0,
          },
        },
        { upsert: true },
      );
      console.log(`  + ${article.title}`);
    }

    console.log('Done. Wiki article seeded.');
  } finally {
    await client.close();
  }
}

seed().catch(console.error);
