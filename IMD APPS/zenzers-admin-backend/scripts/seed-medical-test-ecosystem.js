#!/usr/bin/env node
/**
 * Seed Medical Test Ecosystem
 *
 * Creates a complete test ecosystem in PostgreSQL via the Medical API admin endpoints:
 *   - 5 users (patient, doctor, caregiver, friend, family)
 *   - 200+ vital readings over 7 days
 *   - Data access relationships (direct insert via admin endpoint)
 *   - Emergency contacts
 *   - Vital thresholds
 *   - Diagnoses and medications
 *   - Password hashes in MongoDB for mobile login
 *
 * Idempotent: checks existence by email before creating.
 *
 * Usage:
 *   node scripts/seed-medical-test-ecosystem.js
 *
 * Environment:
 *   MEDICAL_API_URL   (default: http://localhost:3002)
 *   INTERNAL_SERVICES_PASSKEY (required)
 *   DATABASE_URL      (MongoDB, for password storage)
 */

const fetch = require('node-fetch');
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');

const MEDICAL_API_URL = process.env.MEDICAL_API_URL || 'http://localhost:3002';
const PASSKEY = process.env.INTERNAL_SERVICES_PASSKEY || 'dev-passkey-change-me';
const MONGO_URL = process.env.DATABASE_URL || 'mongodb://admin:admin@localhost:47017/mediastore?authSource=admin';
const DEFAULT_PASSWORD = 'Test1234!';

// ── User Definitions ──────────────────────────────────────────────────

const USERS = [
  {
    email: 'dshamir@blucap.ca',
    firstName: 'Daniel',
    lastName: 'Shamir',
    phone: '+15141234567',
    role: 'Patient',
    roleLabel: 'Patient',
    metadata: { dob: '1985-06-15', gender: 'Male', heightCm: 178, weightKg: 82 },
  },
  {
    email: 'sarah.chen@test.com',
    firstName: 'Sarah',
    lastName: 'Chen',
    phone: '+15149876543',
    role: 'Doctor',
    roleLabel: 'Doctor',
    metadata: { specialty: 'Cardiology', institution: 'Montreal General Hospital' },
  },
  {
    email: 'sarah.shamir@test.com',
    firstName: 'Sarah',
    lastName: 'Shamir',
    phone: '+15145551234',
    role: 'Caregiver',
    roleLabel: 'Family',
    metadata: { institution: '' },
  },
  {
    email: 'jake.friend@test.com',
    firstName: 'Jake',
    lastName: 'Thompson',
    phone: '+15145559876',
    role: 'Caregiver',
    roleLabel: 'Friend',
    metadata: { institution: '' },
  },
  {
    email: 'rachel.family@test.com',
    firstName: 'Rachel',
    lastName: 'Shamir',
    phone: '+15145554321',
    role: 'Caregiver',
    roleLabel: 'Family',
    metadata: { institution: '' },
  },
];

// ── Helpers ────────────────────────────────────────────────────────────

function adminHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Internal-Auth': PASSKEY,
  };
}

async function apiGet(path) {
  const res = await fetch(new URL(path, MEDICAL_API_URL).toString(), { headers: adminHeaders() });
  return { status: res.status, data: await res.json() };
}

async function apiPost(path, body) {
  const res = await fetch(new URL(path, MEDICAL_API_URL).toString(), {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

/** Find a user by email in the existing patients/doctors/caregivers lists */
async function findUserByEmail(email) {
  for (const endpoint of ['/admin/patients', '/admin/doctors', '/admin/caregivers']) {
    const result = await apiGet(`${endpoint}?limit=500`);
    if (result.status === 200 && result.data.data) {
      const found = result.data.data.find(u => u.email === email);
      if (found) return found;
    }
  }
  return null;
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Seed Medical Test Ecosystem                        ║');
  console.log('║  Medical API: ' + MEDICAL_API_URL.padEnd(38) + ' ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  // Test connectivity
  try {
    const health = await fetch(new URL('/api', MEDICAL_API_URL).toString());
    if (health.status >= 500) throw new Error(`Medical API returned ${health.status}`);
    console.log('✓ Medical API is reachable');
  } catch (err) {
    console.error('✗ Cannot reach Medical API at', MEDICAL_API_URL);
    console.error('  Make sure the medical-api container is running.');
    console.error('  Error:', err.message);
    process.exit(1);
  }

  // ── Step 1: Create users ────────────────────────────────────────────
  console.log('\n── Creating users ──────────────────────────────────');
  const userIds = {};

  for (const user of USERS) {
    const existing = await findUserByEmail(user.email);
    if (existing) {
      console.log(`  ✓ ${user.role.padEnd(10)} ${user.firstName} ${user.lastName} (${user.email}) — already exists [${existing.id}]`);
      userIds[user.email] = existing.id;
      continue;
    }

    const result = await apiPost('/admin/users', user);
    if (result.status === 201 || result.status === 200) {
      console.log(`  ✓ ${user.role.padEnd(10)} ${user.firstName} ${user.lastName} (${user.email}) — created [${result.data.userId}]`);
      userIds[user.email] = result.data.userId;
    } else if (result.status === 409) {
      console.log(`  ✓ ${user.role.padEnd(10)} ${user.firstName} ${user.lastName} (${user.email}) — already exists`);
      const found = await findUserByEmail(user.email);
      userIds[user.email] = found?.id || 'unknown';
    } else {
      console.error(`  ✗ ${user.email} — ${result.status}: ${JSON.stringify(result.data)}`);
    }
  }

  const danielId = userIds['dshamir@blucap.ca'];
  const doctorId = userIds['sarah.chen@test.com'];
  const sarahCgId = userIds['sarah.shamir@test.com'];
  const jakeId = userIds['jake.friend@test.com'];
  const rachelId = userIds['rachel.family@test.com'];

  if (!danielId) {
    console.error('\n✗ Cannot proceed without Daniel\'s user ID');
    process.exit(1);
  }

  // ── Step 2: Store passwords in MongoDB ──────────────────────────────
  console.log('\n── Storing passwords in MongoDB ────────────────────');
  let mongoClient;
  try {
    mongoClient = new MongoClient(MONGO_URL);
    await mongoClient.connect();
    const db = mongoClient.db();
    const coll = db.collection('mobilePasswords');

    const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    for (const user of USERS) {
      const pgUserId = userIds[user.email];
      if (!pgUserId || pgUserId === 'unknown') continue;

      await coll.updateOne(
        { email: user.email },
        {
          $set: {
            email: user.email,
            pgUserId,
            passwordHash: hashed,
            emailVerified: true,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
      console.log(`  ✓ ${user.email} → password stored (${DEFAULT_PASSWORD})`);
    }
  } catch (err) {
    console.error('  ⚠ MongoDB password storage failed:', err.message);
    console.error('  Mobile login may not work, but PostgreSQL data is fine.');
  } finally {
    if (mongoClient) await mongoClient.close();
  }

  // ── Step 3: Fetch Daniel's thresholds ID ────────────────────────────
  console.log('\n── Fetching Daniel\'s vital thresholds ─────────────');
  let thresholdsId;
  try {
    const threshResult = await apiGet(`/admin/thresholds/${danielId}`);
    if (threshResult.status === 200 && threshResult.data.id) {
      thresholdsId = threshResult.data.id;
      console.log(`  ✓ Thresholds ID: ${thresholdsId}`);
    } else {
      console.error(`  ✗ Could not fetch thresholds: ${threshResult.status} ${JSON.stringify(threshResult.data)}`);
    }
  } catch (err) {
    console.error(`  ✗ Thresholds fetch failed: ${err.message}`);
  }

  if (!thresholdsId) {
    console.error('\n✗ Cannot proceed without Daniel\'s thresholds ID (required for vitals)');
    process.exit(1);
  }

  // ── Step 4: Generate mock telemetry (200+ vitals over 7 days) ───────
  console.log('\n── Generating mock telemetry (200+ readings) ───────');

  const now = Math.floor(Date.now() / 1000);
  const sevenDaysAgo = now - 7 * 86400;
  const readingsPerDay = 30;
  let vitalCount = 0;
  const BATCH_SIZE = 20;

  for (let day = 0; day < 7; day++) {
    const dayStart = sevenDaysAgo + day * 86400;
    const dayVitals = [];

    for (let i = 0; i < readingsPerDay; i++) {
      const timestamp = dayStart + Math.floor(i * (86400 / readingsPerDay));
      const isAbnormal = Math.random() < 0.1;

      const hr = isAbnormal ? randInt(110, 150) : randInt(60, 100);
      const temp = isAbnormal ? parseFloat(rand(37.8, 39.5).toFixed(1)) : parseFloat(rand(36.1, 37.5).toFixed(1));
      const spo2 = isAbnormal ? randInt(88, 93) : randInt(94, 99);
      const rr = isAbnormal ? randInt(22, 30) : randInt(12, 20);
      const sbp = isAbnormal ? randInt(145, 180) : randInt(110, 140);
      const dbp = isAbnormal ? randInt(95, 110) : randInt(70, 90);

      dayVitals.push({
        timestamp,
        hr,
        isHrNormal: hr >= 60 && hr <= 100,
        temp,
        isTempNormal: temp >= 36.1 && temp <= 37.5,
        spo2,
        isSpo2Normal: spo2 >= 94,
        rr,
        isRrNormal: rr >= 12 && rr <= 20,
        sbp,
        isSbpNormal: sbp >= 90 && sbp <= 140,
        dbp,
        isDbpNormal: dbp >= 60 && dbp <= 90,
        fall: false,
        fallType: null,
      });
    }

    // Send in batches of BATCH_SIZE via admin bulk endpoint
    for (let b = 0; b < dayVitals.length; b += BATCH_SIZE) {
      const batch = dayVitals.slice(b, b + BATCH_SIZE);
      try {
        const result = await apiPost('/admin/vitals/bulk', {
          userId: danielId,
          thresholdsId,
          vitals: batch,
        });
        if (result.status === 201 || result.status === 200) {
          vitalCount += result.data.inserted || batch.length;
        } else {
          console.error(`  ⚠ Batch insert failed: ${result.status} ${JSON.stringify(result.data)}`);
        }
      } catch (err) {
        console.error(`  ⚠ Batch insert error: ${err.message}`);
      }
    }
    process.stdout.write(`  Day ${day + 1}/7: ${readingsPerDay} readings\n`);
  }
  console.log(`  ✓ ${vitalCount} vital readings inserted for Daniel`);

  // ── Step 5: Create data access relationships ────────────────────────
  console.log('\n── Creating data access relationships ──────────────');

  const relationships = [
    { grantedId: doctorId, grantedEmail: 'sarah.chen@test.com', role: 'Doctor' },
    { grantedId: sarahCgId, grantedEmail: 'sarah.shamir@test.com', role: 'Caregiver' },
    { grantedId: jakeId, grantedEmail: 'jake.friend@test.com', role: 'Friend' },
    { grantedId: rachelId, grantedEmail: 'rachel.family@test.com', role: 'Family' },
  ];

  for (const rel of relationships) {
    if (!rel.grantedId || rel.grantedId === 'unknown') {
      console.log(`  ⚠ Skipping relationship for ${rel.grantedEmail} — no user ID`);
      continue;
    }
    try {
      const result = await apiPost('/admin/data-access', {
        patientUserId: danielId,
        grantedUserId: rel.grantedId,
        grantedEmail: rel.grantedEmail,
        patientEmail: 'dshamir@blucap.ca',
        direction: 'FromPatient',
        status: 'Approved',
      });
      if (result.status === 201 || result.status === 200) {
        console.log(`  ✓ ${rel.role.padEnd(10)} ${rel.grantedEmail} → can view Daniel's data`);
      } else {
        console.error(`  ⚠ ${rel.grantedEmail}: ${result.status} ${JSON.stringify(result.data)}`);
      }
    } catch (err) {
      console.log(`  ⚠ ${rel.grantedEmail}: ${err.message}`);
    }
  }

  // ── Step 6: Emergency contacts ──────────────────────────────────────
  console.log('\n── Creating emergency contacts ─────────────────────');

  try {
    const url = new URL('/patient/person-emergency-contact', MEDICAL_API_URL);
    const contactRes = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': PASSKEY,
        'X-Internal-User-Id': danielId,
        'X-Internal-User-Role': 'Patient',
      },
      body: JSON.stringify({
        firstName: 'Sarah',
        lastName: 'Shamir',
        email: 'sarah.shamir@test.com',
        phone: '+15145551234',
        relationship: 'Friends&Family',
      }),
    });
    if (contactRes.status < 300) {
      console.log('  ✓ Person: Sarah Shamir (Wife)');
    } else {
      console.log(`  ⚠ Person contact: ${contactRes.status}`);
    }
  } catch (err) {
    console.log('  ⚠ Emergency contact creation failed:', err.message);
  }

  try {
    const url = new URL('/patient/organization-emergency-contact', MEDICAL_API_URL);
    const orgRes = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': PASSKEY,
        'X-Internal-User-Id': danielId,
        'X-Internal-User-Role': 'Patient',
      },
      body: JSON.stringify({
        name: 'Montreal General Hospital',
        phone: '+15149341934',
        email: 'emergency@mgh.ca',
        type: 'Other',
      }),
    });
    if (orgRes.status < 300) {
      console.log('  ✓ Organization: Montreal General Hospital');
    } else {
      console.log(`  ⚠ Organization contact: ${orgRes.status}`);
    }
  } catch (err) {
    console.log('  ⚠ Organization contact creation failed:', err.message);
  }

  // ── Step 7: Diagnoses ───────────────────────────────────────────────
  console.log('\n── Creating diagnoses ──────────────────────────────');

  const diagnoses = [
    { diagnosisName: 'Hypertension', createdBy: doctorId || danielId },
    { diagnosisName: 'Pre-diabetes', createdBy: doctorId || danielId },
  ];

  for (const diag of diagnoses) {
    try {
      const url = new URL('/patient-diagnosis', MEDICAL_API_URL);
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Auth': PASSKEY,
          'X-Internal-User-Id': danielId,
          'X-Internal-User-Role': 'Patient',
        },
        body: JSON.stringify({ ...diag, patientUserId: danielId }),
      });
      if (res.status < 300) {
        console.log(`  ✓ ${diag.diagnosisName}`);
      } else {
        console.log(`  ⚠ ${diag.diagnosisName}: ${res.status}`);
      }
    } catch (err) {
      console.log(`  ⚠ ${diag.diagnosisName}: ${err.message}`);
    }
  }

  // ── Step 8: Medications ─────────────────────────────────────────────
  console.log('\n── Creating medications ────────────────────────────');

  const medications = [
    { genericName: 'Lisinopril', brandNames: ['Zestril'], dose: 10, timesPerDay: 'QD', createdBy: doctorId || danielId },
    { genericName: 'Metformin', brandNames: ['Glucophage'], dose: 500, timesPerDay: 'BID', createdBy: doctorId || danielId },
  ];

  for (const med of medications) {
    try {
      const url = new URL('/patient-medication', MEDICAL_API_URL);
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Auth': PASSKEY,
          'X-Internal-User-Id': danielId,
          'X-Internal-User-Role': 'Patient',
        },
        body: JSON.stringify({ ...med, patientUserId: danielId }),
      });
      if (res.status < 300) {
        console.log(`  ✓ ${med.genericName} ${med.dose}mg ${med.timesPerDay}`);
      } else {
        console.log(`  ⚠ ${med.genericName}: ${res.status}`);
      }
    } catch (err) {
      console.log(`  ⚠ ${med.genericName}: ${err.message}`);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  Seed Complete                                       ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Users:           ${Object.keys(userIds).length.toString().padEnd(35)}║`);
  console.log(`║  Vital readings:  ${vitalCount.toString().padEnd(35)}║`);
  console.log(`║  Data access:     ${relationships.length.toString().padEnd(35)}║`);
  console.log(`║  Diagnoses:       ${diagnoses.length.toString().padEnd(35)}║`);
  console.log(`║  Medications:     ${medications.length.toString().padEnd(35)}║`);
  console.log(`║  Default password: ${DEFAULT_PASSWORD.padEnd(34)}║`);
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  Test login:                                         ║');
  console.log('║    Email: dshamir@blucap.ca                          ║');
  console.log(`║    Password: ${DEFAULT_PASSWORD.padEnd(40)}║`);
  console.log('╚══════════════════════════════════════════════════════╝');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
