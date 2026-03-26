#!/usr/bin/env node
/**
 * Seed Dev Wiki: Device Binding API + Pair Command Flow
 * Run: docker compose exec admin-backend node scripts/seed-wiki-device-binding-api.js
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://mongodb:27017/dental';

const articles = [
  {
    section: 'api-reference',
    title: 'Device Binding API + Pair Command Flow (2026-03-26)',
    slug: 'device-binding-pair-flow-2026-03-26',
    tags: ['device-binding', 'pairing', 'rtk-query', 'websocket', 'api', 'mobile-app'],
    author: 'system',
    status: 'published',
    content: `# Device Binding API + Pair Command Flow

**Date:** 2026-03-26
**Files:** \`device-binding.api.ts\` (new), pair flow in \`ws-device-simulator.ts\` + \`ConnectBle.tsx\`

---

## Pair Command Flow

1. User taps device in SimulationDeviceList → \`connectToDevice(dispatch, deviceId)\`
2. WS connects to \`/device/{id}\` → receives \`device-info\` with serial number
3. On connection established → \`pairDevice(userId)\` sends \`{action: 'pair', userId}\`
4. Server responds with \`{type: 'pair-ack', status: 'paired'}\`
5. UI shows "Pairing..." → "Paired ✓" → navigates to Vitals

## Device Binding API (RTK Query)

\`\`\`typescript
// POST /device-binding — register binding server-side
usePostDeviceBindingMutation()
  body: { deviceSerial: string, userId: string }
  response: { id, deviceSerial, userId, status, createdAt }

// GET /device-binding/:serial — check existing binding
useGetDeviceBindingQuery(deviceSerial)
\`\`\`

## Verification

| Test | Expected |
|------|----------|
| Select device → pair | "Pairing..." → "Paired ✓" → Vitals |
| DB check | \`device_binding\` has entry for selected serial |
| Gateway logs | Show correct device serial in vitals |
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
