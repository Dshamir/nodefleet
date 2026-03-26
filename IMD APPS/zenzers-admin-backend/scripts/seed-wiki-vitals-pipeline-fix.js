#!/usr/bin/env node
/**
 * Seed Dev Wiki: Fix Full Vitals Pipeline — Health Checks, Gateway Auth, Real-Time Charts
 * Run: docker compose exec admin-backend node scripts/seed-wiki-vitals-pipeline-fix.js
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://mongodb:27017/dental';

const articles = [
  {
    section: 'guides',
    title: 'Fix Full Vitals Pipeline — Health Checks, Gateway Auth & Real-Time Charts (2026-03-26)',
    slug: 'vitals-pipeline-fix-2026-03-26',
    tags: ['vitals', 'pipeline', 'healthcheck', 'docker', 'gateway', 'keycloak', 'realm-roles', 'websocket', 'charts', 'real-time', 'medical-api', 'mobile-app'],
    author: 'system',
    status: 'published',
    content: `# Fix Full Vitals Pipeline — Health Checks, Gateway Auth & Real-Time Charts

**Date:** 2026-03-26
**Services affected:** docker-compose.yml, medical-api, rpi-gateway-emulator, mobile app (med-app)
**Result:** 879+ vitals flowing into PostgreSQL, all services healthy, real-time chart data enabled

---

## Problem

The mobile app showed real-time vitals from the device emulator (simulation mode worked), but:
1. **History tab empty** — no vitals persisted in PostgreSQL
2. **Charts had no data** — they read from \`historyVitals\` which comes from the DB
3. **No data for ZENZERS-000** — device emulator generated it but nothing reached the database
4. **Docker health checks failing** — keycloak and medical-api showed "unhealthy" even though services ran fine

## Root Causes & Fixes

### 1. Docker Health Checks (docker-compose.yml)

| Service | Problem | Fix |
|---------|---------|-----|
| keycloak (26.x) | \`curl\` not installed in Keycloak image | Replaced with bash \`/dev/tcp\` check: \`exec 3<>/dev/tcp/localhost/8080\` |
| medical-api (node:22-alpine) | \`curl\` not installed in alpine image | Replaced with \`wget -qO- http://localhost:3002/api\` |
| admin-backend (node:22-alpine) | Same as medical-api | Replaced with \`wget -qO- http://localhost:3001/api/health\` |

### 2. Gateway User Provisioning (seed.ts)

**Bug A — Wrong endpoint for user creation:**
- Gateway called \`admin-backend /api/admin/users\` which requires JWT auth
- Gateway only had \`X-Internal-Auth\` passkey, not a JWT
- **Fix:** Changed to call Medical API \`/admin/users\` directly, which accepts \`X-Internal-Auth\` via \`InternalOrJwtGuard\`

**Bug B — User ID mismatch (401 "User account not found"):**
- \`AdminController.createUser\` generated \`randomUUID()\` for user IDs
- Medical API's \`AuthedUserService\` looks up users by Keycloak \`sub\` (JWT claim)
- Keycloak UUID ≠ random UUID → user not found on authenticated requests
- **Fix:** \`createUser\` now accepts optional \`keycloakUserId\` field and uses it as the user's primary key

**Bug C — Missing Keycloak realm roles (403 "Insufficient role permissions"):**
- Seed set Keycloak user \`attributes: { role: ['Gateway'] }\` but NOT realm roles
- Medical API checks \`realm_access.roles\` from JWT (via \`KeycloakAccessTokenClaimsModel\`)
- Keycloak attributes ≠ realm roles
- **Fix:** Added \`ensureRealmRole()\` and \`assignRealmRole()\` — creates "Gateway" and "Patient" realm roles in Keycloak, then assigns them to each user

### 3. Vitals Format (vitals-collector.ts)

**Bug D — Float values vs integer columns (400 "invalid input syntax for type integer"):**
- Device emulator generates float vitals (e.g., HR=76.4, SpO2=97.2)
- PostgreSQL \`vital\` table columns are integer type
- **Fix:** Added \`Math.round()\` for all vital values in \`VitalsCollector.addReading()\`

### 4. Real-Time Chart Updates (mobile app)

**Problem:** \`Chart.tsx\` only polled REST API every 60s. No WebSocket push for chart data.

**Fix — New hook \`use-realtime-chart-data.ts\`:**
- Subscribes to WebSocket \`messageToClient\` events (reusing existing \`useSocket()\`)
- Accumulates incoming vitals as chart data points \`{ x: timestamp, y: value }\`
- Buffers per vital type (hr, temp, spo2, rr, sbp, dbp)

**Fix — Modified \`Chart.tsx\`:**
- Imports and uses \`useRealtimeChartData(patientUserId)\`
- Merges realtime WebSocket points with existing history data before rendering
- Reduced poll interval from 60s to 10s (gateway submits every 10s)

---

## Files Changed

| File | Change |
|------|--------|
| \`docker-compose.yml\` | Health checks: curl → wget/tcp for keycloak, medical-api, admin-backend |
| \`packages/rpi-gateway-emulator/src/seed.ts\` | Call medical-api directly, add Keycloak realm role creation + assignment, pass keycloakUserId |
| \`packages/rpi-gateway-emulator/src/vitals-collector.ts\` | Math.round() all vital values |
| \`alevelsoft-med-api/.../admin.controller.ts\` | Accept optional \`keycloakUserId\` in createUser |
| \`alevelsoft-med-app/.../use-realtime-chart-data.ts\` | **NEW** — WebSocket hook for real-time chart data |
| \`alevelsoft-med-app/.../Chart.tsx\` | Merge realtime points, reduce poll to 10s |

---

## Verification

| Check | How | Expected |
|-------|-----|----------|
| Health checks pass | \`docker ps\` | keycloak, medical-api, admin-backend show "healthy" |
| Gateway running | \`docker logs imdapps-rpi-gateway-emulator-1\` | "Successfully submitted N vitals" |
| DB has vitals | \`psql -c "SELECT count(*) FROM vital;"\` | Growing count (879+ after 5 min) |
| History tab | Mobile app → HISTORY | Vitals list with timestamps |
| Charts render | History → tap vital | Line chart with data points |
| Real-time updates | Watch chart while emulator running | New points every ~10s |

---

## Key Learnings

1. **Keycloak attributes ≠ realm roles.** \`attributes: { role: ['X'] }\` is metadata, NOT authorization. JWT \`realm_access.roles\` comes from assigned realm roles only.
2. **User ID must match Keycloak \`sub\`.** If you create users in both Keycloak and a downstream DB, the downstream DB must use the Keycloak UUID as primary key. Otherwise JWT-based lookup fails.
3. **Alpine images have \`wget\` but not \`curl\`.** Docker health checks for node:alpine should use \`wget -qO-\`.
4. **Keycloak 26.x images have no \`curl\`.** Use bash \`/dev/tcp\` or the built-in health endpoint.
5. **PostgreSQL integer columns reject floats.** Round emulator-generated vitals before insertion.

---

*Last updated: 2026-03-26*
`,
  },
];

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const col = db.collection('devWikiPages');

    for (const article of articles) {
      const now = new Date();
      const result = await col.updateOne(
        { slug: article.slug },
        {
          $set: {
            ...article,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true },
      );

      if (result.upsertedCount) {
        console.log(`✓ Created: "${article.title}"`);
      } else {
        console.log(`✓ Updated: "${article.title}"`);
      }
    }

    console.log(`\nDone — ${articles.length} wiki articles seeded.`);
  } catch (err) {
    console.error('✗ Seed failed:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
