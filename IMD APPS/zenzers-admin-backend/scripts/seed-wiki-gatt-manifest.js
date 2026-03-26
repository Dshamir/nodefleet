#!/usr/bin/env node
/**
 * Seed Dev Wiki: GATT Manifest in Device Emulator UI
 * Run: docker compose exec admin-backend node scripts/seed-wiki-gatt-manifest.js
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://mongodb:27017/dental';

const articles = [
  {
    section: 'guides',
    title: 'GATT Service Manifest in Device Emulator UI (2026-03-26)',
    slug: 'gatt-manifest-emulator-2026-03-26',
    tags: ['gatt', 'ble', 'device-emulator', 'watch-ui', 'services', 'characteristics'],
    author: 'system',
    status: 'published',
    content: `# GATT Service Manifest in Device Emulator UI

**Date:** 2026-03-26
**Files modified:** \`public/index.html\`, \`ws-server.ts\`

---

## Feature

Each watch card in the emulator UI (\`http://localhost:48765\`) now has a "GATT" toggle button that reveals a collapsible panel showing BLE GATT services and characteristics.

## GATT Panel Contents

\`\`\`
▼ GATT Services
  ┌ Device Information (0x180A)
  │  Model Number (0x2A24): ZENZERS-V1
  │  Serial Number (0x2A25): ZNZ-2026-A001
  │  Firmware Rev (0x2A26): 1.0.0
  │  Hardware Rev (0x2A27): 1.0
  │  Manufacturer (0x2A29): ZENZERS Medical
  │
  ┌ Vital Signs
  │  Heart Rate (0x2A37): 72 bpm
  │  Temperature (0x2A1C): 36.6°C
  │  SpO2 (0x2A5F): 98%
  │  Battery (0x2A19): 85%
  │  Fall Alert (0x2A46): No
  │
  ┌ Device State
  │  State: PAIRED
  │  Paired User: 38b41c33-...
  │  Dataset: synthetic
\`\`\`

## New HTTP Endpoint

\`GET /device/{id}/state\` — returns device state, paired user, dataset status, and device info.

Response:
\`\`\`json
{
  "state": "PAIRED",
  "pairedUserId": "38b41c33-...",
  "datasetStatus": { "mode": "synthetic" },
  "serialNumber": "ZNZ-2026-A001",
  "modelNumber": "ZENZERS-V1",
  "firmwareVersion": "1.0.0",
  "macAddress": "AA:BB:CC:DD:EE:00",
  "lastReading": { ... }
}
\`\`\`

## Implementation

- GATT panel fetches from \`/device/{id}/state\` on toggle
- Vitals values come from cached WS messages (\`devices[id].vitals\`)
- Auto-refreshes every 2s while panel is visible
- Device-info WS messages (\`device-info\` type) are stored for enrichment

## Verification

| Test | Expected |
|------|----------|
| Open http://localhost:48765 | Each watch has "GATT" button |
| Click GATT | Shows services with live values |
| Values update | Vitals refresh every 2s |
| State shows correctly | ADVERTISING / CONNECTED / PAIRED |
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
          $set: { ...article, body: article.content, updatedAt: now },
          $setOnInsert: { createdAt: now, createdBy: 'system', editHistory: [], deleted: false, sortOrder: 0 },
        },
        { upsert: true },
      );
      console.log(`  + ${article.title}`);
    }
    console.log('Done.');
  } finally {
    await client.close();
  }
}

seed().catch(console.error);
