import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { config } from './config';
import { SeedResult, PatientMapping } from './types';

const PATIENT_NAMES = [
  { firstName: 'Margaret', lastName: 'Chen' },
  { firstName: 'Robert', lastName: 'Williams' },
  { firstName: 'Dorothy', lastName: 'Garcia' },
  { firstName: 'James', lastName: 'Thompson' },
  { firstName: 'Helen', lastName: 'Nakamura' },
  { firstName: 'Walter', lastName: 'Petrov' },
  { firstName: 'Ruth', lastName: 'Okonkwo' },
  { firstName: 'George', lastName: 'Dupont' },
  { firstName: 'Betty', lastName: 'Sharma' },
  { firstName: 'Harold', lastName: 'Andersson' },
];

async function httpRequest(url: string, options: RequestInit): Promise<any> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function getKeycloakAdminToken(): Promise<string> {
  const res = await fetch(`${config.keycloakUrl}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: 'admin',
      password: config.keycloakAdminPassword,
    }),
  });
  if (!res.ok) throw new Error(`Keycloak admin login failed: ${res.status}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

async function ensureRealmRole(adminToken: string, roleName: string): Promise<void> {
  // Check if role exists
  const res = await fetch(
    `${config.keycloakUrl}/admin/realms/zenzers/roles/${encodeURIComponent(roleName)}`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );
  if (res.ok) return;

  // Create role
  const createRes = await fetch(`${config.keycloakUrl}/admin/realms/zenzers/roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: roleName }),
  });
  if (createRes.ok || createRes.status === 409) {
    console.log(`[Seed] Ensured realm role: ${roleName}`);
  } else {
    console.warn(`[Seed] Failed to create realm role ${roleName}: ${createRes.status}`);
  }
}

async function assignRealmRole(adminToken: string, userId: string, roleName: string): Promise<void> {
  // Get role representation
  const roleRes = await fetch(
    `${config.keycloakUrl}/admin/realms/zenzers/roles/${encodeURIComponent(roleName)}`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );
  if (!roleRes.ok) {
    console.warn(`[Seed] Role ${roleName} not found, skipping assignment`);
    return;
  }
  const role = await roleRes.json() as { id: string; name: string };

  // Assign role to user
  const assignRes = await fetch(
    `${config.keycloakUrl}/admin/realms/zenzers/users/${userId}/role-mappings/realm`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify([{ id: role.id, name: role.name }]),
    },
  );
  if (assignRes.ok || assignRes.status === 204) {
    console.log(`[Seed] Assigned realm role ${roleName} to user ${userId}`);
  } else {
    console.warn(`[Seed] Failed to assign role: ${assignRes.status} ${await assignRes.text()}`);
  }
}

async function createKeycloakUser(
  adminToken: string,
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  role: string,
): Promise<string> {
  // Check if user already exists
  const searchRes = await fetch(
    `${config.keycloakUrl}/admin/realms/zenzers/users?email=${encodeURIComponent(email)}&exact=true`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );
  const existing = await searchRes.json() as Array<{ id: string }>;
  if (existing.length > 0) {
    console.log(`[Seed] Keycloak user already exists: ${email} (${existing[0].id})`);
    return existing[0].id;
  }

  // Create user
  const createRes = await fetch(`${config.keycloakUrl}/admin/realms/zenzers/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      username: email,
      email,
      firstName,
      lastName,
      enabled: true,
      emailVerified: true,
      attributes: { role: [role] },
      credentials: [{ type: 'password', value: password, temporary: false }],
    }),
  });

  if (createRes.status === 409) {
    // Race condition — fetch again
    const retry = await fetch(
      `${config.keycloakUrl}/admin/realms/zenzers/users?email=${encodeURIComponent(email)}&exact=true`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    const retryData = await retry.json() as Array<{ id: string }>;
    return retryData[0]?.id || '';
  }

  if (!createRes.ok) {
    throw new Error(`Keycloak create user failed: ${createRes.status} ${await createRes.text()}`);
  }

  // Get the created user's ID from Location header
  const location = createRes.headers.get('location') || '';
  const userId = location.split('/').pop() || '';
  console.log(`[Seed] Created Keycloak user: ${email} → ${userId}`);
  return userId;
}

async function ensureMedicalApiUser(
  keycloakUserId: string,
  email: string,
  firstName: string,
  lastName: string,
  role: string,
): Promise<string> {
  // Use Medical API admin endpoint directly (supports X-Internal-Auth)
  try {
    const result = await httpRequest(
      `${config.medicalApiUrl}/admin/users`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Auth': config.internalPasskey,
        },
        body: JSON.stringify({
          keycloakUserId,
          email,
          firstName,
          lastName,
          role,
        }),
      },
    );
    console.log(`[Seed] Medical API user created: ${email} (${result?.id || keycloakUserId})`);
    return result?.id || keycloakUserId;
  } catch (err: any) {
    // If user already exists, that's fine
    if (err.message.includes('409') || err.message.includes('already exists') || err.message.includes('duplicate')) {
      console.log(`[Seed] Medical API user already exists: ${email}`);
      return keycloakUserId;
    }
    throw err;
  }
}

async function storePasswordInMongo(email: string, password: string): Promise<void> {
  const client = new MongoClient(config.mongoUrl);
  try {
    await client.connect();
    const db = client.db();
    const hash = await bcrypt.hash(password, 10);
    await db.collection('mobilePasswords').updateOne(
      { email },
      { $set: { email, password: hash, updatedAt: new Date() } },
      { upsert: true },
    );
    console.log(`[Seed] Stored password hash for ${email}`);
  } finally {
    await client.close();
  }
}

export async function seedEmulatorUsers(): Promise<SeedResult> {
  console.log('[Seed] Starting emulator user provisioning...');

  const adminToken = await getKeycloakAdminToken();

  // 0. Ensure realm roles exist
  await ensureRealmRole(adminToken, 'Gateway');
  await ensureRealmRole(adminToken, 'Patient');

  // 1. Create gateway user
  const gatewayKcId = await createKeycloakUser(
    adminToken,
    config.gatewayEmail,
    config.gatewayPassword,
    'RPi Gateway',
    config.seniorHomeName,
    'Gateway',
  );
  await assignRealmRole(adminToken, gatewayKcId, 'Gateway');

  await ensureMedicalApiUser(
    gatewayKcId,
    config.gatewayEmail,
    'RPi Gateway',
    config.seniorHomeName,
    'Gateway',
  );

  await storePasswordInMongo(config.gatewayEmail, config.gatewayPassword);

  // 2. Create patient users
  const patients: PatientMapping[] = [];
  for (let i = 0; i < config.patientCount; i++) {
    const nameEntry = PATIENT_NAMES[i % PATIENT_NAMES.length];
    const email = `patient${i}@zenzers-emulator.local`;
    const password = `Patient${i}Emul8!`;

    const kcId = await createKeycloakUser(
      adminToken,
      email,
      password,
      nameEntry.firstName,
      nameEntry.lastName,
      'Patient',
    );
    await assignRealmRole(adminToken, kcId, 'Patient');

    await ensureMedicalApiUser(
      kcId,
      email,
      nameEntry.firstName,
      nameEntry.lastName,
      'Patient',
    );

    await storePasswordInMongo(email, password);

    patients.push({
      deviceIndex: i,
      userId: kcId,
      email,
      firstName: nameEntry.firstName,
      lastName: nameEntry.lastName,
    });
  }

  console.log(`[Seed] Provisioning complete: 1 gateway + ${patients.length} patients`);
  return { gatewayUserId: gatewayKcId, patients };
}
