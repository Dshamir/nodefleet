#!/usr/bin/env node
/**
 * Seed Dev Wiki: Vitals Monitor — Patient-Centric Dashboard with HIPAA Masking
 * Run: docker compose exec admin-backend node scripts/seed-wiki-vitals-monitor.js
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://mongodb:27017/dental';

const articles = [
  {
    section: 'guides',
    title: 'Vitals Monitor — Patient-Centric Real-Time Dashboard',
    slug: 'vitals-monitor-dashboard',
    tags: ['vitals', 'medical', 'dashboard', 'real-time', 'patient', 'monitoring', 'hipaa', 'phi'],
    author: 'system',
    status: 'published',
    content: `# Vitals Monitor — Patient-Centric Real-Time Dashboard

The Vitals Monitor page (\`/admin/vitals-monitor\`) provides real-time monitoring of patient vital signs with enriched patient context, care team details, and HIPAA-compliant data masking.

**Added:** March 19, 2026
**Route:** \`/admin/vitals-monitor\` (list) and \`/admin/vitals-monitor/:patientId\` (detail)

---

## 1. Architecture Overview

The Vitals Monitor uses a **composite API pattern** where the admin-backend fans out to 5 upstream Medical API endpoints in parallel, joins the results by patientId, and returns a unified \`PatientVitalNode\` per patient.

\`\`\`
Browser (30s poll)
  |
  v
GET /admin/vitals/patients ──> admin-backend (composite endpoint)
                                  |
                                  ├── /admin/vitals/active   [REQUIRED]
                                  ├── /admin/patients         [REQUIRED]
                                  ├── /admin/doctors          [OPTIONAL]
                                  ├── /admin/caregivers       [OPTIONAL]
                                  ├── /admin/gateways         [OPTIONAL]
                                  └── /admin/data-access      [OPTIONAL]
\`\`\`

**Key design decisions:**
- \`Promise.allSettled()\` — if optional endpoints (doctors, caregivers, gateways) fail, the page still renders with null fallbacks
- **30-second in-memory cache** — multiple admin users polling simultaneously share cached results instead of fanning out 5 upstream calls per request
- **Single-patient endpoint** (\`/admin/vitals/patients/:patientId\`) — filters from the same cache, avoids fetching entire list for detail page

---

## 2. Backend Endpoints

### GET /admin/vitals/patients

Returns all patients with active vitals, merged with doctor, caregiver, and gateway data.

**Response:**
\`\`\`json
{
  "patients": [
    {
      "patientId": "uuid",
      "patientName": "John Doe",
      "email": "john@example.com",
      "phone": "+1-555-123-4567",
      "dateOfBirth": "1985-03-15",
      "doctor": { "id": "uuid", "name": "Dr. Smith", "email": "...", "phone": "...", "specialization": "Cardiology" },
      "caregiver": { "id": "uuid", "name": "Jane Doe", "email": "...", "phone": "..." },
      "gateway": { "deviceId": "ZG-001", "status": "online", "lastSeen": "2026-03-19T12:00:00Z", "batteryPercent": 87 },
      "latestVitals": { "heartRate": 75, "bloodPressureSystolic": 120, "bloodPressureDiastolic": 80, "temperature": 37.2, "spO2": 98, "timestamp": "...", "status": "normal" }
    }
  ],
  "total": 12
}
\`\`\`

### GET /admin/vitals/patients/:patientId

Same data for a single patient. Returns \`{ patient: PatientVitalNode }\`.

### GET /admin/vitals/:patientId/telemetry?page=1&limit=50

Paginated telemetry log with all raw vital readings and normal-flag indicators.

**Response:**
\`\`\`json
{
  "entries": [
    {
      "id": "uuid",
      "syncTimestamp": "2026-03-19T12:00:00Z",
      "heartRate": 75,
      "bloodPressureSystolic": 120,
      "bloodPressureDiastolic": 80,
      "temperature": 37.2,
      "spO2": 98,
      "respiratoryRate": 16,
      "fall": false,
      "status": "normal",
      "isHrNormal": true,
      "isSbpNormal": true,
      "isDbpNormal": true,
      "isSpo2Normal": true,
      "isTempNormal": true,
      "isRrNormal": true,
      "deviceSerial": "ZNZ-2026-A001",
      "relayType": "gateway",
      "relayId": "38b41c33-..."
    }
  ],
  "total": 200,
  "page": 1,
  "limit": 50
}
\`\`\`

**Cap:** Server-side limit of 500 records max to prevent memory spikes.

> **Provenance fields** (\`deviceSerial\`, \`relayType\`, \`relayId\`) are nullable — legacy vitals show \`null\`. See the [Telemetry Provenance](/admin/dev-wiki/telemetry-provenance) article for full details.

### POST /admin/vitals/unmask-audit

Logs a HIPAA audit trail entry when the admin unmasks PHI. Fire-and-forget from the frontend.

---

## 3. Frontend Pages

### Vitals Monitor List (\`/admin/vitals-monitor\`)

- **Data source:** \`GET /admin/vitals/patients\` with \`refetchInterval: 30_000\`
- **Layout:** Responsive grid (1-4 columns) of \`PatientVitalCard\` components
- **Search:** Client-side filter by patient name
- **HIPAA toggle:** Eye icon button in header — unmasks/masks all PII fields
- **Navigation:** "Details" button on each card navigates to \`/admin/vitals-monitor/:patientId\`

### Patient Detail (\`/admin/vitals-monitor/:patientId\`)

- **Data source:** \`GET /admin/vitals/patients/:patientId\` + \`GET /admin/vitals/:patientId/telemetry\`
- **Layout:** Patient header (contact, doctor, caregiver, gateway) + vitals summary cards + telemetry DataTable
- **Telemetry table:** PrimeReact DataTable with server-side pagination (50/page), expandable rows showing raw normal-flag data
- **Breadcrumb:** Dashboard > MEDICAL > Vitals Monitor > Patient Detail

---

## 4. Patient Card Layout

Each card shows one patient (not one reading):

\`\`\`
+--------------------------------------+
| [Patient Name*]     Online/Offline   |  <- name masked, gateway badge
| Phone: ***-***-1234  Email: j****@.. |  <- contact masked
|--------------------------------------|
|  HR: 75 bpm      BP: 120/80 mmHg    |  <- vitals NOT masked
|  Temp: 37.2C     SpO2: 98%          |
|--------------------------------------|
|  Dr. S**** (Cardiology)             |  <- doctor masked
|  Caregiver: M*** J***               |  <- caregiver masked
|--------------------------------------|
|  Normal               [Details ->]   |  <- status + nav
+--------------------------------------+
\`\`\`

**Color coding** (same as before): green = normal, yellow = warning, red = critical.

**Null-state rendering:**
- \`doctor: null\` -> "No doctor assigned" (muted text)
- \`caregiver: null\` -> "No caregiver assigned" (muted text)
- \`gateway: null\` -> gray "Unknown" badge
- \`phone/email: null\` -> dash placeholder

---

## 5. Files Reference

| File | Purpose |
|------|---------|
| \`admin-backend/src/routes/admin/medical.ts\` | Composite endpoints, telemetry proxy, unmask audit |
| \`admin-console/src/pages/vitals-monitor/types.ts\` | Shared TypeScript interfaces |
| \`admin-console/src/utils/hipaa-mask.ts\` | Masking utility + \`useHipaaMask\` hook |
| \`admin-console/src/pages/vitals-monitor/PatientVitalCard.tsx\` | Patient card component |
| \`admin-console/src/pages/vitals-monitor/VitalsMonitorPage.tsx\` | List page (rewritten) |
| \`admin-console/src/pages/vitals-monitor/PatientDetailPage.tsx\` | Detail dashboard |
| \`admin-console/src/App.tsx\` | Route: \`vitals-monitor/:patientId\` |
| \`admin-console/src/layouts/AdminLayout.tsx\` | Breadcrumb for patient detail |

---

## 6. Performance Considerations

| Concern | Mitigation |
|---------|-----------|
| Fan-out to 5 upstream APIs | 30s in-memory cache on admin-backend |
| Detail page fetches full list | Dedicated single-patient endpoint filters cached data |
| Telemetry memory spike | Server-side cap at 500 records, paginated at 50/page |
| Multiple admins polling | Shared cache — only 1 upstream fan-out per 30s |

---

## 7. Continuous Test Data — Device & Gateway Emulators

The Vitals Monitor requires active patient vitals to display. Two data sources are available:

| Source | Type | Description |
|--------|------|-------------|
| \`seed-medical-test-ecosystem.js\` | **Static** | Seeds 210 historical vital readings for 1 patient (7 days × 30/day) |
| \`zenzer-device-emulator\` + \`rpi-gateway-emulator\` | **Continuous** | 5 virtual patients, live vitals every 5s, submitted every 10s |

For realistic dashboard testing, run both emulators:

\`\`\`bash
docker compose up -d --build zenzer-device-emulator rpi-gateway-emulator
\`\`\`

This will auto-provision 5 emulated patients (with names like Margaret Chen, Robert Williams, etc.) and stream continuous vitals that appear on the Vitals Monitor within 30 seconds (cache refresh interval).

See wiki article **"Zenzer Device Emulator & RPi Gateway Emulator"** for full architecture and configuration.

---

*Last updated: March 25, 2026*
`
  },
  {
    section: 'security',
    title: 'HIPAA PHI Masking — Vitals Monitor Implementation',
    slug: 'hipaa-phi-masking-vitals',
    tags: ['hipaa', 'phi', 'masking', 'security', 'compliance', 'audit', 'vitals'],
    author: 'system',
    status: 'published',
    content: `# HIPAA PHI Masking — Vitals Monitor Implementation

Documents the HIPAA-compliant Protected Health Information (PHI) masking system implemented for the Vitals Monitor dashboard.

**Added:** March 19, 2026
**Regulation:** HIPAA Security Rule (45 CFR 164.312(b))

---

## 1. What Gets Masked

| Field | Masked Format | Example |
|-------|-------------|---------|
| Patient name | First letter + asterisks per word | \`J**** D**\` |
| Email | First char + \`****\` + domain | \`j****@example.com\` |
| Phone | Last 4 digits visible | \`***-***-1234\` |
| Date of birth | Year only | \`**/**/1990\` |
| Doctor/Caregiver name | Same as patient name | \`S**** M***\` |
| Doctor/Caregiver phone | Same as phone | \`***-***-4321\` |

**NOT masked:** Vital signs (HR, BP, SpO2, Temperature) — these are clinical metrics required for real-time monitoring.

---

## 2. Default Behavior

- **Masked on load** — all PHI fields are masked by default when any admin loads the Vitals Monitor
- **Single toggle** — eye icon button in page header toggles all fields simultaneously
- **Auto-relock** — after 5 minutes of unmasked state, PHI automatically re-masks via \`setTimeout\`
- **Cleared on unmount** — timer is cleaned up when navigating away

---

## 3. Audit Trail

Every unmask action is logged to the HIPAA data access audit collection:

| Event | Endpoint | Logged Fields |
|-------|----------|---------------|
| View vitals list | \`GET /admin/vitals/patients\` | userId, action: \`view\`, resourceType: \`patient-vitals\` |
| View patient detail | \`GET /admin/vitals/patients/:id\` | userId, action: \`view\`, resourceId: patientId |
| Unmask PHI | \`POST /admin/vitals/unmask-audit\` | userId, action: \`unmask-phi\`, IP, timestamp |

The unmask audit call is **fire-and-forget** — it does not block the UI toggle. The backend logs the event even if the response fails to reach the client.

---

## 4. Implementation Details

### Frontend: \`useHipaaMask\` Hook (\`src/utils/hipaa-mask.ts\`)

\`\`\`typescript
const { unmasked, toggle, mask } = useHipaaMask()

// Usage in JSX:
<span>{mask(patient.email, 'email')}</span>   // -> "j****@example.com"
<span>{mask(patient.phone, 'phone')}</span>   // -> "***-***-1234"
<span>{mask(patient.patientName, 'name')}</span> // -> "J**** D**"
\`\`\`

The hook:
1. Defaults to \`unmasked = false\`
2. On \`toggle()\` to unmask: fires \`POST /admin/vitals/unmask-audit\`, starts 5-min auto-relock timer
3. On \`toggle()\` to mask: clears timer
4. On unmount: clears timer

### Backend: \`logAccess()\` Integration

All new vitals endpoints call the existing \`logAccess()\` function from \`data-access-log.ts\`, which writes to the \`dataAccessLog\` MongoDB collection. This is the same audit mechanism used by the Data Access page.

---

## 5. Future Enhancements

- **Role-based unmask** — only certain admin roles can unmask PHI (requires RBAC gate)
- **Per-field masking** — allow unmasking individual fields instead of all-or-nothing
- **Unmask reason prompt** — require admin to enter a justification before unmasking
- **WebSocket/SSE** — replace 30s polling with real-time push for critical alerts

---

## 6. Files Reference

| File | Purpose |
|------|---------|
| \`admin-console/src/utils/hipaa-mask.ts\` | \`maskValue()\` utility + \`useHipaaMask()\` hook |
| \`admin-backend/src/routes/admin/medical.ts\` | \`POST /admin/vitals/unmask-audit\` endpoint |
| \`admin-backend/src/services/data-access-log.ts\` | \`logAccess()\` — shared HIPAA audit logging |

---

*Last updated: March 19, 2026*
`
  }
];

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();

    for (const article of articles) {
      const result = await db.collection('devWikiPages').updateOne(
        { slug: article.slug },
        {
          $set: {
            ...article,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );

      if (result.upsertedCount > 0) {
        console.log(`Created wiki article: "${article.title}" (${result.upsertedId})`);
      } else {
        console.log(`Updated wiki article: "${article.title}"`);
      }
    }
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
