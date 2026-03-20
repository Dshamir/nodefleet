#!/usr/bin/env node
// Seed dev-wiki article: Forensic Gap Closure — AWS to Self-Hosted Migration
// Usage: node scripts/seed-wiki-gap-closure.js
//   or:  docker exec imdapps-admin-backend-1 node scripts/seed-wiki-gap-closure.js

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://mongodb:27017/mediastore';

const article = {
  section: 'infrastructure',
  title: 'Forensic Gap Closure — AWS to Self-Hosted Migration (2026-03-20)',
  slug: 'forensic-gap-closure-aws-self-hosted-2026-03-20',
  tags: ['migration', 'aws', 'minio', 'keycloak', 'firebase', 'branch-io', 'cognito', 'gap-closure', 'infrastructure'],
  author: 'system',
  status: 'published',
  content: `# Forensic Gap Closure — AWS to Self-Hosted Migration

**Date:** 2026-03-20
**Commit:** 74015ba
**Variant:** FULL (Battalion-mode)
**Services affected:** medical-api, admin-backend, admin-console, docker-compose, keycloak

---

## Overview

Closed 16 gaps remaining from the AWS (Cognito, S3, SES, Firebase, Branch.io) to self-hosted (Keycloak, MinIO, SMTP) migration. All legacy AWS dependencies have been removed from active code paths.

---

## Gap Registry

| # | Gap | Priority | Resolution |
|---|-----|----------|------------|
| 1 | S3 avatar service uses aws-sdk v2 | P0 | Rewritten with @aws-sdk/client-s3 v3 + MinIO endpoint |
| 2 | Firebase FCM imports (unused) | P2 | Removed from app.module, events, patient-vital-thresholds; firebase.service.ts deleted |
| 3 | Branch.io deep linking | P1 | Replaced with internal URL builder using WEB_APP_URL |
| 4 | MailHog vars override docker-compose | P1 | USE_MAILHOG removed; SMTP-only config |
| 5 | Cognito-era email config | P1 | .env.example rewritten for Keycloak/SMTP/MinIO |
| 6 | Admin caregivers page auth mismatch | P1 | X-Internal-Auth header + InternalOrJwtGuard |
| 7 | Admin console "Access Denied" in Chrome | P1 | assign-platform-operator.sh script |
| 8 | Medical-web sign-up "email already associated" | P1 | Consistent error handling — HTTP 409 for duplicate email |
| 9 | No MinIO service in docker-compose | P0 | MinIO added (ports 49000/49001) with health check |
| 10 | No health checks on most services | P3 | Health checks on 7 services |
| 11 | Keycloak public client for backend auth | P1 | admin-backend-service confidential client |
| 12 | Cognito stub files still present | P2 | 4 files + directory deleted |
| 13 | Hardcoded AWS env vars | P0 | Replaced with MinIO + internal passkey vars |
| 14 | Onboarding pages reject Keycloak tokens | P1 | Verified — InternalOrJwtGuard covers this |
| 15 | OTP settings vs Keycloak email verification | P2 | Keycloak handles via verifyEmail: true |
| 16 | Admin messaging SMTP config | P3 | Already passed through docker-compose env vars |

---

## Infrastructure Changes

### MinIO (Object Storage)
- **Service:** \`minio\` in docker-compose.yml
- **Ports:** 49000 (API), 49001 (Console)
- **Bucket:** medical-avatars
- **Auth:** MINIO_ROOT_USER / MINIO_ROOT_PASSWORD
- **S3 Compatibility:** forcePathStyle: true required

### Health Checks Added
| Service | Check | Start Period |
|---------|-------|-------------|
| keycloak | curl /auth/realms/master | 60s |
| mongodb | mongosh ping | — |
| redis | redis-cli ping | — |
| rabbitmq | rabbitmq-diagnostics ping | — |
| admin-backend | curl /api/health | 15s |
| medical-api | curl /api | 30s |
| minio | mc ready local | — |

### Keycloak Clients
| Client | Type | Purpose |
|--------|------|---------|
| admin-console-client | Public (PKCE) | Admin SPA |
| medical-app-client | Public (PKCE) | Patient/doctor SPA |
| admin-backend-service | Confidential | Server-to-server auth |

---

## Cross-Service Auth Flow

\`\`\`
Admin Console (browser)
  → Keycloak JWT (admin-console-client)
    → Admin Backend (Express.js)
      → X-Internal-Auth: INTERNAL_SERVICES_PASSKEY
        → Medical API (NestJS)
          → InternalOrJwtGuard accepts passkey OR valid JWT
\`\`\`

This solves the audience mismatch: admin-console JWT is issued for \`admin-console-client\`, but medical-api validates against \`medical-app-client\`. The internal passkey bypasses JWT audience validation for trusted backend-to-backend calls.

---

## Files Modified

### docker-compose.yml
- Added minio service with health check
- Added health checks to keycloak, mongodb, redis, rabbitmq, admin-backend, medical-api
- Updated medical-api env: MinIO vars, INTERNAL_SERVICES_PASSKEY, removed Branch.io vars
- Updated admin-backend: AUTH_CLIENT_ID_BACKEND → admin-backend-service

### medical-api (alevelsoft-med-api)
- \`s3.service.ts\` — @aws-sdk/client-s3 with MinIO endpoint
- \`file-url.service.ts\` — MINIO_PUBLIC_URL fallback
- \`branch-io.service.ts\` — Internal URL builder (no SDK)
- \`app.module.ts\` — Removed FirebaseModule
- \`events.module.ts\` — Removed FirebaseService import
- \`patient-vital-thresholds.module.ts\` — Removed FirebaseService import
- \`admin.controller.ts\` — Added InternalOrJwtGuard
- \`auth.controller.ts\` — Consistent sign-up error handling (409 for duplicates)
- \`Dockerfile\` — Removed npm install aws-sdk
- \`package.json\` — Replaced branchio-sdk + nestjs-firebase with @aws-sdk/client-s3

### admin-backend (zenzers-admin-backend)
- \`routes/admin/medical.ts\` — X-Internal-Auth header on all proxy calls

### keycloak/
- \`setup-admin-console-client.sh\` — Added admin-backend-service client
- \`assign-platform-operator.sh\` — NEW: role assignment by email

---

## Post-Deployment Steps

1. \`docker compose up -d minio\` — start MinIO
2. \`./zenser.sh rebuild medical-api\` — apply all medical-api changes
3. \`./zenser.sh rebuild admin-backend\` — apply proxy auth changes
4. \`bash keycloak/setup-admin-console-client.sh\` — create backend client
5. \`bash keycloak/assign-platform-operator.sh admin@zenzers4life.com\` — fix Chrome access

---

## Verification

\`\`\`bash
# Verify no legacy deps remain
grep -r "cognito\\|aws-sdk\\|branchio\\|MAILHOG" --include="*.ts" --include="*.js"

# Verify MinIO is healthy
docker compose ps minio

# Verify admin console can reach medical-api
curl -s http://localhost:43001/api/admin/medical/patients | head

# Verify sign-up returns 409 for duplicate email
curl -s -X POST http://localhost:43002/patient/sign-up \\
  -H "Content-Type: application/json" \\
  -d '{"email":"existing@test.com","password":"Test1234!"}' | jq .statusCode
\`\`\`
`,
  updatedAt: new Date(),
};

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const col = db.collection('devWikiPages');

    const { createdAt, ...updateFields } = article;
    const result = await col.updateOne(
      { slug: article.slug },
      {
        $set: updateFields,
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );

    if (result.upsertedCount) {
      console.log('Created wiki article:', article.title);
    } else {
      console.log('Updated wiki article:', article.title);
    }
  } catch (err) {
    console.error('Failed to seed wiki article:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
