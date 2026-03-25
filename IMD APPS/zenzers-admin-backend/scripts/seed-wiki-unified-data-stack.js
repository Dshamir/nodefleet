#!/usr/bin/env node
// Seed dev-wiki article: Unified Data Stack Activation & Test Ecosystem Seeding
// Usage: node scripts/seed-wiki-unified-data-stack.js
//   or:  docker exec imdapps-admin-backend-1 node scripts/seed-wiki-unified-data-stack.js

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://mongodb:27017/mediastore';

const article = {
  section: 'guides',
  title: 'Unified Data Stack Activation — Admin Endpoints, Seed Script & Keycloak Users (2026-03-25)',
  slug: 'unified-data-stack-activation-2026-03-25',
  tags: ['medical-api', 'admin-controller', 'seed-script', 'keycloak', 'vitals', 'data-access', 'postgresql', 'mongodb', 'docker', 'test-data'],
  author: 'system',
  status: 'published',
  content: `# Unified Data Stack Activation — Admin Endpoints, Seed Script & Keycloak Users

**Date:** 2026-03-25
**Commit:** afbd3bb
**Services affected:** medical-api, admin-backend, admin-console
**Scope:** 8 files changed, 1,816 insertions, 454 deletions

---

## Problem

The unified data stack code was written (Phases 1-6) but **never activated**:
- Containers not rebuilt — code changes not deployed
- Seed script never run — PostgreSQL had zero test data
- Seed script had bugs — vitals format wrong (flat objects instead of wrapped array), data-access only printed SQL
- Test users existed in PostgreSQL but NOT in Keycloak — login impossible
- Mobile app not restarted against new backend

**4 symptoms:**
1. Admin console showed empty data (nothing in PostgreSQL)
2. Mobile app login failed (no Keycloak users)
3. Vitals Monitor page empty (no vital readings)
4. Data Access Management empty (relationships only printed as SQL, never inserted)

## Root Causes

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Vitals not inserted | \`POST /patient/vitals\` expects \`{ vitals: [{ timestamp, thresholdsId, ... }] }\` but seed sent flat objects | Created \`POST /admin/vitals/bulk\` endpoint that bypasses patient auth |
| Data-access not inserted | Seed only \`console.log()\`'d SQL statements | Created \`POST /admin/data-access\` endpoint for direct TypeORM insert |
| User creation 500 (null id) | \`UserModel.id\` is \`@PrimaryGeneratedColumn('uuid')\` but \`queryRunner.manager.save()\` didn't auto-generate | Set \`user.id = randomUUID()\` explicitly |
| User creation 500 (duplicate key) | \`avatar\` column has unique constraint, all users set to \`''\` | Changed to \`user.avatar = null\` |
| User creation 500 (missing field) | \`passwordUpdatedAt\` not set, column is NOT NULL | Added \`user.passwordUpdatedAt = Math.floor(Date.now() / 1000)\` |
| Emergency contacts 400 | \`relationship\` must be enum: \`MedicalProfessional\`, \`Caregiver\`, \`Friends&Family\` | Fixed enum value |
| Org contact 400 | Missing required \`type\` field: \`Pharmacy\`, \`Nursing Home\`, \`Other\` | Added \`type: 'Other'\` |
| Keycloak login fails | Users existed in PostgreSQL but NOT in Keycloak realm \`zenzers\` | Created all 5 users in Keycloak via Admin API |

## Solution

### 1. New Admin Controller Endpoints (medical-api)

**File:** \`alevelsoft-med-api/.../src/presentation/controllers/admin.controller.ts\`

Three new endpoints added to \`AdminController\`, all guarded by \`InternalOrJwtGuard\`:

#### \`GET /admin/thresholds/:patientId\`
Returns the patient's \`PatientVitalThresholdsModel\` — needed to get \`thresholdsId\` for vitals insertion.

#### \`POST /admin/vitals/bulk\`
Accepts \`{ userId, thresholdsId, vitals: [...] }\` and does direct TypeORM \`vitalRepository.save()\`.
Bypasses \`@Roles('Patient')\` guard on the patient vitals endpoint.
Used by seed script to insert 210 vitals in batches of 20.

#### \`POST /admin/data-access\`
Accepts \`{ patientUserId, grantedUserId, grantedEmail, patientEmail, direction, status }\`.
Generates UUID via \`randomUUID()\` (since \`PatientDataAccessModel\` uses \`@PrimaryColumn('uuid')\`, not \`@PrimaryGeneratedColumn\`).
Idempotent — checks for existing relationship before inserting.

### 2. Rewritten Seed Script

**File:** \`zenzers-admin-backend/scripts/seed-medical-test-ecosystem.js\`

Complete rewrite with these fixes:
- **Step 3 (new):** Fetches Daniel's \`thresholdsId\` via \`GET /admin/thresholds/:id\`
- **Step 4:** Uses \`POST /admin/vitals/bulk\` with batches of 20 (not individual POSTs to patient endpoint)
- **Step 5:** Uses \`POST /admin/data-access\` (not console.log SQL)
- **Step 6:** Fixed emergency contact enum values
- Removed dead code (SQL printing section)

### 3. Keycloak User Provisioning

All 5 test users created in Keycloak realm \`zenzers\` via Admin REST API:
- \`POST /auth/admin/realms/zenzers/users\` — create user with \`emailVerified: true\`
- \`PUT /auth/admin/realms/zenzers/users/:id/reset-password\` — set password \`Test1234!\`
- Daniel's \`emailVerified\` was \`false\` — fixed via \`PUT\` update

### 4. Container Rebuilds

Both \`medical-api\` and \`admin-backend\` rebuilt 3 times (iterative bug fixes):
\`\`\`bash
docker compose build medical-api --no-cache
docker compose build admin-backend --no-cache
docker compose up -d medical-api admin-backend
\`\`\`

### 5. Mobile App Restart

- Killed Metro bundler (PID 2978300)
- Cleared Metro cache: \`npx react-native start --reset-cache\`
- Force-stopped app: \`adb shell am force-stop com.zenzers.medical\`
- Cleared app cache: \`adb shell pm clear com.zenzers.medical\`
- Relaunched: \`adb shell monkey -p com.zenzers.medical -c android.intent.category.LAUNCHER 1\`

---

## Test Users

All authenticate via Keycloak (realm: \`zenzers\`), exist in PostgreSQL (\`medical_db\`), and have passwords in MongoDB (\`mobilePasswords\`).

| Email | Password | Role | Notes |
|-------|----------|------|-------|
| \`dshamir@blucap.ca\` | \`Test1234!\` | Patient | Primary — has vitals, diagnoses, meds |
| \`sarah.chen@test.com\` | \`Test1234!\` | Doctor | Cardiologist — data access to Daniel |
| \`sarah.shamir@test.com\` | \`Test1234!\` | Caregiver (Family) | Daniel's wife |
| \`jake.friend@test.com\` | \`Test1234!\` | Caregiver (Friend) | Data access to Daniel |
| \`rachel.family@test.com\` | \`Test1234!\` | Caregiver (Family) | Data access to Daniel |

## Seeded Data

| Data | Count | Details |
|------|-------|---------|
| Users | 5 | 1 patient, 1 doctor, 3 caregivers |
| MongoDB passwords | 5 | bcrypt hashed \`Test1234!\` |
| Vital readings | 210 | 7 days x 30/day — HR, SpO2, temp, RR, SBP, DBP |
| Data access | 4 | Doctor + 3 caregivers → Daniel (Approved) |
| Diagnoses | 2 | Hypertension, Pre-diabetes |
| Medications | 2 | Lisinopril 10mg QD, Metformin 500mg BID |
| Emergency contacts | 2 | Person (Sarah Shamir), Org (Montreal General Hospital) |

## Running the Seed Script

\`\`\`bash
cd zenzers-admin-backend
MEDICAL_API_URL=http://localhost:43002 \\
INTERNAL_SERVICES_PASSKEY=J5OhTsuXMnfeMSTwq6Bw \\
DATABASE_URL='mongodb://zenzers_root:nZYQvt3ivjXLa8VoQ3e1@localhost:47017/mediastore?authSource=admin' \\
node scripts/seed-medical-test-ecosystem.js
\`\`\`

Script is idempotent — checks existence before creating.

## Verification

\`\`\`bash
# Stats
curl -s -H 'X-Internal-Auth: J5OhTsuXMnfeMSTwq6Bw' http://localhost:43002/admin/stats

# Patients
curl -s -H 'X-Internal-Auth: J5OhTsuXMnfeMSTwq6Bw' http://localhost:43002/admin/patients

# Vitals for Daniel
curl -s -H 'X-Internal-Auth: J5OhTsuXMnfeMSTwq6Bw' http://localhost:43002/admin/vitals/40c00cce-8823-4862-bf63-6267bfc12710

# Data access
curl -s -H 'X-Internal-Auth: J5OhTsuXMnfeMSTwq6Bw' http://localhost:43002/admin/data-access

# Medical records
curl -s -H 'X-Internal-Auth: J5OhTsuXMnfeMSTwq6Bw' http://localhost:43002/admin/medical-records
\`\`\`

## Architecture Notes

- **Triple-store auth:** Users must exist in all 3 stores — Keycloak (SSO login), PostgreSQL (medical data), MongoDB (mobile password hash). Missing any one causes login failure.
- **Internal auth bypass:** \`RequestUserService\` checks \`X-Internal-Auth\` header before attempting JWT validation. If passkey matches, creates synthetic \`InternalAccessTokenClaims\` with userId and role from headers.
- **Bulk vitals endpoint:** Uses direct \`vitalRepository.save(entities)\` instead of going through the use-case layer. Acceptable for seeding but should not be used in production.
- **PatientDataAccessModel PK:** Uses \`@PrimaryColumn('uuid')\` (not \`@PrimaryGeneratedColumn\`), so UUID must be provided explicitly via \`randomUUID()\`.
- **Avatar unique constraint:** The \`user.avatar\` column has a unique constraint. Setting all users to empty string \`''\` causes duplicate key violations. Use \`null\` instead.
`,
  createdAt: new Date(),
  updatedAt: new Date(),
};

(async () => {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const col = db.collection('devwikis');
    const existing = await col.findOne({ slug: article.slug });
    if (existing) {
      await col.updateOne({ slug: article.slug }, { $set: { ...article, updatedAt: new Date() } });
      console.log(`Updated wiki article: ${article.title}`);
    } else {
      await col.insertOne(article);
      console.log(`Inserted wiki article: ${article.title}`);
    }
  } finally {
    await client.close();
  }
})();
