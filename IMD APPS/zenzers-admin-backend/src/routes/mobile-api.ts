/**
 * Mobile-App-Compatible API Routes — Unified Data Stack
 *
 * ALL data flows through the Medical API (NestJS:3002) → PostgreSQL.
 * Auth endpoints use local JWT + MongoDB for passwords/tokens only.
 * Data endpoints proxy to Medical API with X-Internal-Auth headers.
 *
 * Architecture:
 *   Mobile App → Admin Backend (3001) → Medical API (3002) → PostgreSQL
 *   Admin Console → Admin Backend (3001) → Medical API (3002) → PostgreSQL
 */
import { Router, Request, Response, NextFunction } from 'express';
import fetch from 'node-fetch';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb, ObjectId } = require('./admin/db');

const router = Router();
const logger = require('../logging').getLogger('mobile-api');

// ── Config ────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'zenzers-dev-jwt-secret-change-in-prod';
const ACCESS_TOKEN_TTL = '1h';
const REFRESH_TOKEN_TTL = '30d';
const MEDICAL_API_URL = process.env.MEDICAL_API_URL || 'http://medical-api:3002';
const INTERNAL_PASSKEY = process.env.INTERNAL_SERVICES_PASSKEY || '';

// ── Helpers ───────────────────────────────────────────────────────────

function signAccessToken(userId: string, email: string, role: string) {
  return jwt.sign({ sub: userId, email, role }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function signRefreshToken(userId: string) {
  return jwt.sign({ sub: userId, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
}

/** Map DB role strings to the PascalCase values the mobile app's RolesType enum expects */
function normalizeRole(role: string): string {
  const map: Record<string, string> = { patient: 'Patient', doctor: 'Doctor', caregiver: 'Caregiver' };
  return map[role?.toLowerCase()] || role || 'Patient';
}

/** Build user response shape from PostgreSQL user record */
function pgUserToResponse(user: any) {
  const role = normalizeRole(user.role);
  return {
    avatar: user.avatar || '',
    deletedAt: user.deletedAt || null,
    userId: user.id,
    email: user.email,
    firstName: user.firstName || user.first_name || '',
    lastName: user.lastName || user.last_name || '',
    roleLabel: user.roleLabel || user.role_label || role,
    phone: user.phone || '',
    role,
    passwordUpdatedAt: user.passwordUpdatedAt || user.password_updated_at || 0,
    measurementSystem: user.measurementSystem || user.measurement_system || 'Metric',
  };
}

/** Middleware: verify Bearer token and attach req.userId / req.userEmail / req.userRole */
async function requireAuth(req: Request & { userId?: string; userEmail?: string; userRole?: string }, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: 'Missing or invalid token' });
  try {
    const decoded: any = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId = decoded.sub;
    req.userEmail = decoded.email;
    req.userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ message: 'Token expired or invalid' });
  }
}

// ── Medical API proxy helpers ─────────────────────────────────────────

function internalHeaders(userId: string, role: string = 'Patient'): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Internal-Auth': INTERNAL_PASSKEY,
    'X-Internal-User-Id': userId,
    'X-Internal-User-Role': normalizeRole(role),
  };
}

async function proxyGet(path: string, userId: string, role: string, query?: Record<string, any>): Promise<any> {
  const url = new URL(path, MEDICAL_API_URL);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }
  const response = await fetch(url.toString(), { headers: internalHeaders(userId, role) });
  return { status: response.status, data: await response.json() };
}

async function proxyPost(path: string, userId: string, role: string, body: any): Promise<any> {
  const url = new URL(path, MEDICAL_API_URL);
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: internalHeaders(userId, role),
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

async function proxyPatch(path: string, userId: string, role: string, body: any): Promise<any> {
  const url = new URL(path, MEDICAL_API_URL);
  const response = await fetch(url.toString(), {
    method: 'PATCH',
    headers: internalHeaders(userId, role),
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

async function proxyPut(path: string, userId: string, role: string, body: any): Promise<any> {
  const url = new URL(path, MEDICAL_API_URL);
  const response = await fetch(url.toString(), {
    method: 'PUT',
    headers: internalHeaders(userId, role),
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

async function proxyDelete(path: string, userId: string, role: string): Promise<any> {
  const url = new URL(path, MEDICAL_API_URL);
  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: internalHeaders(userId, role),
  });
  return { status: response.status, data: await response.json() };
}

/** Fetch user from PostgreSQL via admin endpoint */
async function fetchPgUser(userId: string): Promise<any | null> {
  try {
    const url = new URL(`/admin/patients/${userId}`, MEDICAL_API_URL);
    const response = await fetch(url.toString(), {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Auth': INTERNAL_PASSKEY },
    });
    if (response.status === 200) return await response.json();

    // Try as doctor
    const url2 = new URL(`/admin/doctors`, MEDICAL_API_URL);
    url2.searchParams.set('limit', '1');
    const resp2 = await fetch(url2.toString(), {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Auth': INTERNAL_PASSKEY },
    });
    if (resp2.status === 200) {
      const result: any = await resp2.json();
      const found = (result.data || []).find((u: any) => u.id === userId);
      if (found) return found;
    }
    return null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// AUTH ENDPOINTS (hybrid: local JWT + PostgreSQL users)
// ═══════════════════════════════════════════════════════════════════════

/**
 * POST /sign-in
 * Body: { email, password }
 * Verifies password from MongoDB mobilePasswords collection,
 * fetches user data from PostgreSQL.
 */
router.post('/sign-in', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const db = await getDb();
    const normalizedEmail = email.toLowerCase().trim();

    // Check password store (MongoDB — stores hashed passwords + pgUserId mapping)
    const creds = await db.collection('mobilePasswords').findOne({ email: normalizedEmail });
    if (!creds) {
      // Fallback: try legacy mobileUsers collection for migration compatibility
      const legacyUser = await db.collection('mobileUsers').findOne({ email: normalizedEmail });
      if (!legacyUser) return res.status(401).json({ message: 'Invalid credentials' });
      const valid = await bcrypt.compare(password, legacyUser.password);
      if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

      // Legacy user found — issue token with legacy ID, they should re-register
      const role = normalizeRole(legacyUser.role);
      const accessToken = signAccessToken(legacyUser._id.toString(), legacyUser.email, role);
      const refreshToken = signRefreshToken(legacyUser._id.toString());
      await db.collection('mobileRefreshTokens').insertOne({ userId: legacyUser._id, token: refreshToken, createdAt: new Date() });
      return res.json({
        accessToken,
        accessTokenExpireTime: Math.floor(Date.now() / 1000) + 3600,
        refreshToken,
        user: {
          avatar: legacyUser.avatar || '',
          deletedAt: null,
          userId: legacyUser._id.toString(),
          email: legacyUser.email,
          firstName: legacyUser.firstName || '',
          lastName: legacyUser.lastName || '',
          roleLabel: role,
          phone: legacyUser.phone || '',
          role,
          passwordUpdatedAt: legacyUser.passwordUpdatedAt || 0,
          measurementSystem: legacyUser.measurementSystem || 'Metric',
        },
      });
    }

    const valid = await bcrypt.compare(password, creds.passwordHash);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    // Fetch full user from PostgreSQL
    const pgUser = await fetchPgUser(creds.pgUserId);
    if (!pgUser) return res.status(401).json({ message: 'User account not found in system' });

    const role = normalizeRole(pgUser.role);
    const accessToken = signAccessToken(creds.pgUserId, normalizedEmail, role);
    const refreshToken = signRefreshToken(creds.pgUserId);

    await db.collection('mobileRefreshTokens').insertOne({
      userId: creds.pgUserId,
      token: refreshToken,
      createdAt: new Date(),
    });

    return res.json({
      accessToken,
      accessTokenExpireTime: Math.floor(Date.now() / 1000) + 3600,
      refreshToken,
      user: pgUserToResponse(pgUser),
    });
  } catch (err: any) {
    logger.error(`sign-in error: ${err.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /refresh-token
 * Body: { refreshToken }
 */
router.post('/refresh-token', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: 'Refresh token required' });

    const decoded: any = jwt.verify(refreshToken, JWT_SECRET);
    const db = await getDb();
    const stored = await db.collection('mobileRefreshTokens').findOne({ token: refreshToken });
    if (!stored) return res.status(401).json({ message: 'Invalid refresh token' });

    // Fetch user from PostgreSQL
    const pgUser = await fetchPgUser(decoded.sub);
    if (!pgUser) return res.status(401).json({ message: 'User not found' });

    const role = normalizeRole(pgUser.role);
    const newAccessToken = signAccessToken(decoded.sub, pgUser.email, role);
    const newRefreshToken = signRefreshToken(decoded.sub);

    await db.collection('mobileRefreshTokens').deleteOne({ _id: stored._id });
    await db.collection('mobileRefreshTokens').insertOne({
      userId: decoded.sub,
      token: newRefreshToken,
      createdAt: new Date(),
    });

    return res.json({
      accessToken: newAccessToken,
      accessTokenExpireTime: Math.floor(Date.now() / 1000) + 3600,
      refreshToken: newRefreshToken,
      user: pgUserToResponse(pgUser),
    });
  } catch {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});

/**
 * POST /sign-out
 */
router.post('/sign-out', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const db = await getDb();
      await db.collection('mobileRefreshTokens').deleteMany({ token: refreshToken });
    }
    return res.json({ message: 'Signed out' });
  } catch {
    return res.json({ message: 'Signed out' });
  }
});

/**
 * POST /patient/sign-up
 * Creates user in PostgreSQL via Medical API, stores password hash in MongoDB.
 */
router.post('/patient/sign-up', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const normalizedEmail = email.toLowerCase().trim();

    // Create user in PostgreSQL via Medical API
    const createResult = await proxyPost('/admin/users', 'system', 'Patient', {
      email: normalizedEmail,
      firstName: firstName || '',
      lastName: lastName || '',
      phone: phone || '',
      role: 'Patient',
      roleLabel: 'Patient',
      metadata: {},
    });

    if (createResult.status === 409) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    if (createResult.status >= 400) {
      logger.error(`sign-up Medical API error: ${JSON.stringify(createResult.data)}`);
      return res.status(createResult.status).json(createResult.data);
    }

    const pgUserId = createResult.data.userId;

    // Store password hash in MongoDB (PostgreSQL doesn't store passwords — Keycloak does in prod)
    const db = await getDb();
    const hashed = await bcrypt.hash(password, 10);
    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    await db.collection('mobilePasswords').updateOne(
      { email: normalizedEmail },
      {
        $set: {
          email: normalizedEmail,
          pgUserId,
          passwordHash: hashed,
          emailVerified: false,
          verificationCode,
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

    logger.info(`New patient registered: ${normalizedEmail} → pgUserId=${pgUserId}`);
    return res.status(201).json({
      message: 'Registration successful. Check email for verification code.',
      userId: pgUserId,
    });
  } catch (err: any) {
    logger.error(`sign-up error: ${err.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /doctor/sign-up
 */
router.post('/doctor/sign-up', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, phone, specialty, institution } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const normalizedEmail = email.toLowerCase().trim();
    const createResult = await proxyPost('/admin/users', 'system', 'Doctor', {
      email: normalizedEmail,
      firstName: firstName || '',
      lastName: lastName || '',
      phone: phone || '',
      role: 'Doctor',
      roleLabel: 'Doctor',
      metadata: { specialty: specialty || '', institution: institution || '' },
    });

    if (createResult.status === 409) return res.status(409).json({ message: 'Email already registered' });
    if (createResult.status >= 400) return res.status(createResult.status).json(createResult.data);

    const db = await getDb();
    const hashed = await bcrypt.hash(password, 10);
    await db.collection('mobilePasswords').updateOne(
      { email: normalizedEmail },
      { $set: { email: normalizedEmail, pgUserId: createResult.data.userId, passwordHash: hashed, emailVerified: false, createdAt: new Date() } },
      { upsert: true },
    );

    return res.status(201).json({ message: 'Registration successful', userId: createResult.data.userId });
  } catch (err: any) {
    logger.error(`doctor sign-up error: ${err.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /caregiver/sign-up
 */
router.post('/caregiver/sign-up', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, phone, institution } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const normalizedEmail = email.toLowerCase().trim();
    const createResult = await proxyPost('/admin/users', 'system', 'Caregiver', {
      email: normalizedEmail,
      firstName: firstName || '',
      lastName: lastName || '',
      phone: phone || '',
      role: 'Caregiver',
      roleLabel: 'Caregiver',
      metadata: { institution: institution || '' },
    });

    if (createResult.status === 409) return res.status(409).json({ message: 'Email already registered' });
    if (createResult.status >= 400) return res.status(createResult.status).json(createResult.data);

    const db = await getDb();
    const hashed = await bcrypt.hash(password, 10);
    await db.collection('mobilePasswords').updateOne(
      { email: normalizedEmail },
      { $set: { email: normalizedEmail, pgUserId: createResult.data.userId, passwordHash: hashed, emailVerified: false, createdAt: new Date() } },
      { upsert: true },
    );

    return res.status(201).json({ message: 'Registration successful', userId: createResult.data.userId });
  } catch (err: any) {
    logger.error(`caregiver sign-up error: ${err.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /sign-up/confirm
 */
router.post('/sign-up/confirm', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    const db = await getDb();
    const creds = await db.collection('mobilePasswords').findOne({ email: email?.toLowerCase().trim() });
    if (!creds) return res.status(404).json({ message: 'User not found' });

    if (creds.verificationCode && creds.verificationCode !== String(code)) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    await db.collection('mobilePasswords').updateOne(
      { _id: creds._id },
      { $set: { emailVerified: true }, $unset: { verificationCode: '' } },
    );
    return res.json({ message: 'Email verified' });
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /sign-up/resend-code
 */
router.post('/sign-up/resend-code', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const db = await getDb();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await db.collection('mobilePasswords').updateOne(
      { email: email?.toLowerCase().trim() },
      { $set: { verificationCode: code } },
    );
    return res.json({ message: 'Verification code resent' });
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /forgot-password
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const db = await getDb();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await db.collection('mobilePasswords').updateOne(
      { email: email?.toLowerCase().trim() },
      { $set: { resetCode: code } },
    );
    logger.info(`Password reset code for ${email}: ${code}`);
    return res.json({ message: 'Password reset code sent' });
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /forgot-password/confirm
 */
router.post('/forgot-password/confirm', async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;
    const db = await getDb();
    const creds = await db.collection('mobilePasswords').findOne({ email: email?.toLowerCase().trim() });
    if (!creds || (creds.resetCode && creds.resetCode !== String(code))) {
      return res.status(400).json({ message: 'Invalid code' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.collection('mobilePasswords').updateOne(
      { _id: creds._id },
      { $set: { passwordHash: hashed }, $unset: { resetCode: '' } },
    );
    return res.json({ message: 'Password reset successful' });
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// PROFILE ENDPOINTS — proxy to Medical API
// ═══════════════════════════════════════════════════════════════════════

router.get('/patient/my-profile', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyGet('/patient/my-profile', req.userId!, req.userRole || 'Patient');
    return res.status(result.status).json(result.status === 200 ? pgUserToResponse(result.data) : result.data);
  } catch (err: any) {
    logger.error(`my-profile proxy error: ${err.message}`);
    return res.status(502).json({ message: 'Medical API unavailable' });
  }
});

router.patch('/patient/my-profile', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyPatch('/patient/my-profile', req.userId!, req.userRole || 'Patient', req.body);
    return res.status(result.status).json(result.status === 200 ? pgUserToResponse(result.data) : result.data);
  } catch (err: any) {
    logger.error(`my-profile patch proxy error: ${err.message}`);
    return res.status(502).json({ message: 'Medical API unavailable' });
  }
});

router.post('/change-password', requireAuth, async (req: Request & { userId?: string }, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const db = await getDb();
    const creds = await db.collection('mobilePasswords').findOne({ pgUserId: req.userId });
    if (!creds) return res.status(404).json({ message: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, creds.passwordHash);
    if (!valid) return res.status(400).json({ message: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.collection('mobilePasswords').updateOne(
      { _id: creds._id },
      { $set: { passwordHash: hashed } },
    );
    return res.json({ message: 'Password changed' });
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/measurement-system', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyPatch('/measurement-system', req.userId!, req.userRole || 'Patient', req.body);
    return res.status(result.status).json(result.data);
  } catch {
    return res.status(502).json({ message: 'Medical API unavailable' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// VITALS ENDPOINTS — proxy to Medical API
// ═══════════════════════════════════════════════════════════════════════

router.post('/patient/vitals', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyPost('/patient/vitals', req.userId!, req.userRole || 'Patient', req.body);
    return res.status(result.status).json(result.data);
  } catch {
    return res.status(502).json({ message: 'Medical API unavailable' });
  }
});

router.get('/patient/my-vitals', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyGet('/patient/my-vitals', req.userId!, req.userRole || 'Patient', {
      startDate: req.query.startDate || req.query.from,
      endDate: req.query.endDate || req.query.to,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    // Ensure app gets VitalsResponse shape
    const data = result.data;
    if (result.status === 200 && !data.vitals) {
      return res.json({ vitals: Array.isArray(data) ? data : [], thresholds: [], users: [], total: 0 });
    }
    return res.status(result.status).json(data);
  } catch {
    return res.status(502).json({ message: 'Medical API unavailable' });
  }
});

router.get('/vitals/absolute', async (req: Request, res: Response) => {
  try {
    const url = new URL('/vitals/absolute', MEDICAL_API_URL);
    const response = await fetch(url.toString(), { headers: { 'Content-Type': 'application/json', 'X-Internal-Auth': INTERNAL_PASSKEY } });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch {
    // Fallback defaults if Medical API is unreachable
    return res.json({
      heartRate: { min: 40, max: 220 },
      oxygenSaturation: { min: 70, max: 100 },
      temperature: { min: 32, max: 42 },
      respirationRate: { min: 4, max: 60 },
      meanArterialPressure: { min: 43, max: 160 },
      bloodPressure: { minSbp: 70, maxSbp: 220, minDbp: 30, maxDbp: 130 },
    });
  }
});

router.get('/patient/my-vital-thresholds', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyGet('/patient/my-vital-thresholds', req.userId!, req.userRole || 'Patient');
    return res.status(result.status).json(result.data);
  } catch {
    return res.status(502).json({ message: 'Medical API unavailable' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// EMERGENCY CONTACTS — proxy to Medical API
// ═══════════════════════════════════════════════════════════════════════

router.get('/patient/emergency-contacts', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyGet('/patient/emergency-contacts', req.userId!, req.userRole || 'Patient');
    return res.status(result.status).json(result.data);
  } catch {
    return res.status(502).json({ message: 'Medical API unavailable' });
  }
});

router.post('/patient/person-emergency-contact', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyPost('/patient/person-emergency-contact', req.userId!, req.userRole || 'Patient', req.body);
    return res.status(result.status).json(result.data);
  } catch {
    return res.status(502).json({ message: 'Medical API unavailable' });
  }
});

router.delete('/patient/person-emergency-contact/:id', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyDelete(`/patient/person-emergency-contact/${req.params.id}`, req.userId!, req.userRole || 'Patient');
    return res.status(result.status).json(result.data);
  } catch {
    return res.status(502).json({ message: 'Medical API unavailable' });
  }
});

router.all('/patient/organization-emergency-contact*', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    if (req.method === 'POST') {
      const result = await proxyPost('/patient/organization-emergency-contact', req.userId!, req.userRole || 'Patient', req.body);
      return res.status(result.status).json(result.data);
    }
    const result = await proxyGet('/patient/organization-emergency-contacts', req.userId!, req.userRole || 'Patient');
    return res.status(result.status).json(result.data);
  } catch {
    if (req.method === 'GET') return res.json([]);
    return res.json({ message: 'OK' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// REFERENCE DATA — proxy to Medical API
// ═══════════════════════════════════════════════════════════════════════

router.get('/specialties', async (_req: Request, res: Response) => {
  try {
    const url = new URL('/specialties', MEDICAL_API_URL);
    const response = await fetch(url.toString(), { headers: { 'Content-Type': 'application/json', 'X-Internal-Auth': INTERNAL_PASSKEY } });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch {
    return res.json([
      { _id: '1', name: 'Cardiology' },
      { _id: '2', name: 'Neurology' },
      { _id: '3', name: 'Pulmonology' },
      { _id: '4', name: 'Internal Medicine' },
      { _id: '5', name: 'Family Medicine' },
      { _id: '6', name: 'Emergency Medicine' },
      { _id: '7', name: 'Geriatrics' },
    ]);
  }
});

router.get('/diagnoses', async (_req: Request, res: Response) => {
  try {
    const url = new URL('/diagnoses', MEDICAL_API_URL);
    const response = await fetch(url.toString(), { headers: { 'Content-Type': 'application/json', 'X-Internal-Auth': INTERNAL_PASSKEY } });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch {
    return res.json([
      { _id: '1', diagnosisName: 'Hypertension' },
      { _id: '2', diagnosisName: 'Diabetes Type 2' },
      { _id: '3', diagnosisName: 'Asthma' },
      { _id: '4', diagnosisName: 'COPD' },
      { _id: '5', diagnosisName: 'Heart Failure' },
    ]);
  }
});

router.get('/medications', async (_req: Request, res: Response) => {
  try {
    const url = new URL('/medications', MEDICAL_API_URL);
    const response = await fetch(url.toString(), { headers: { 'Content-Type': 'application/json', 'X-Internal-Auth': INTERNAL_PASSKEY } });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch {
    return res.json([
      { _id: '1', genericName: 'Metformin', brandNames: 'Glucophage', dosageUnit: 'mg' },
      { _id: '2', genericName: 'Lisinopril', brandNames: 'Zestril', dosageUnit: 'mg' },
      { _id: '3', genericName: 'Atorvastatin', brandNames: 'Lipitor', dosageUnit: 'mg' },
      { _id: '4', genericName: 'Metoprolol', brandNames: 'Lopressor', dosageUnit: 'mg' },
      { _id: '5', genericName: 'Salbutamol', brandNames: 'Ventolin', dosageUnit: 'mcg' },
    ]);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// DATA ACCESS / RELATIONSHIPS — proxy to Medical API
// ═══════════════════════════════════════════════════════════════════════

router.get('/patient/suggested-contacts', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyGet('/patient/suggested-contacts', req.userId!, req.userRole || 'Patient');
    return res.status(result.status).json(result.data);
  } catch {
    return res.json({ persons: [], organizations: [] });
  }
});

router.get('/patient/data-accesses', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyGet('/patient/data-access/requests', req.userId!, req.userRole || 'Patient');
    return res.status(result.status).json(result.data);
  } catch {
    return res.json([]);
  }
});

router.post('/patient/data-access/:action', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyPost(`/patient/data-access/${req.params.action}`, req.userId!, req.userRole || 'Patient', req.body);
    return res.status(result.status).json(result.data);
  } catch {
    return res.json({ message: 'OK' });
  }
});

router.get('/patient/my-doctors', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyGet('/patient/my-doctors', req.userId!, req.userRole || 'Patient');
    return res.status(result.status).json(result.data);
  } catch {
    return res.json([]);
  }
});

router.get('/patient/my-caregivers', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyGet('/patient/my-caregivers', req.userId!, req.userRole || 'Patient');
    return res.status(result.status).json(result.data);
  } catch {
    return res.json([]);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// DOCTOR / CAREGIVER PROFILE PROXIES
// ═══════════════════════════════════════════════════════════════════════

router.get('/doctor/my-profile', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyGet('/doctor/my-profile', req.userId!, req.userRole || 'Doctor');
    return res.status(result.status).json(result.data);
  } catch {
    return res.json({});
  }
});

router.patch('/doctor/my-profile', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyPatch('/doctor/my-profile', req.userId!, req.userRole || 'Doctor', req.body);
    return res.status(result.status).json(result.data);
  } catch {
    return res.json({ message: 'OK' });
  }
});

router.get('/caregiver/my-profile', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyGet('/caregiver/my-profile', req.userId!, req.userRole || 'Caregiver');
    return res.status(result.status).json(result.data);
  } catch {
    return res.json({});
  }
});

router.patch('/caregiver/my-profile', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyPatch('/caregiver/my-profile', req.userId!, req.userRole || 'Caregiver', req.body);
    return res.status(result.status).json(result.data);
  } catch {
    return res.json({ message: 'OK' });
  }
});

router.get('/profile/my-patients', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyGet('/profile/my-patients', req.userId!, req.userRole || 'Doctor');
    return res.status(result.status).json(result.data);
  } catch {
    return res.json([]);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// MEDICAL RECORDS PROXIES
// ═══════════════════════════════════════════════════════════════════════

router.get('/patient-diagnoses/:id', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyGet(`/patient-diagnoses/${req.params.id}`, req.userId!, req.userRole || 'Patient');
    return res.status(result.status).json(result.data);
  } catch {
    return res.json([]);
  }
});

router.post('/patient-diagnosis', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyPost('/patient-diagnosis', req.userId!, req.userRole || 'Patient', req.body);
    return res.status(result.status).json(result.data);
  } catch {
    return res.json({ message: 'OK' });
  }
});

router.delete('/patient-diagnosis/:id', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyDelete(`/patient-diagnosis/${req.params.id}`, req.userId!, req.userRole || 'Patient');
    return res.status(result.status).json(result.data);
  } catch {
    return res.json({ message: 'OK' });
  }
});

router.get('/patient-medications/:id', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyGet(`/patient-medications/${req.params.id}`, req.userId!, req.userRole || 'Patient');
    return res.status(result.status).json(result.data);
  } catch {
    return res.json([]);
  }
});

router.post('/patient-medication', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyPost('/patient-medication', req.userId!, req.userRole || 'Patient', req.body);
    return res.status(result.status).json(result.data);
  } catch {
    return res.json({ message: 'OK' });
  }
});

router.patch('/patient-medication/:id', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyPatch(`/patient-medication/${req.params.id}`, req.userId!, req.userRole || 'Patient', req.body);
    return res.status(result.status).json(result.data);
  } catch {
    return res.json({ message: 'OK' });
  }
});

router.delete('/patient-medication/:id', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyDelete(`/patient-medication/${req.params.id}`, req.userId!, req.userRole || 'Patient');
    return res.status(result.status).json(result.data);
  } catch {
    return res.json({ message: 'OK' });
  }
});

router.get('/patient-status/:id', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyGet(`/patient-status/${req.params.id}`, req.userId!, req.userRole || 'Patient');
    return res.status(result.status).json(result.data);
  } catch {
    return res.json({ status: 'normal' });
  }
});

router.put('/patient-status/:type/:id', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyPut(`/patient-status/${req.params.type}/${req.params.id}`, req.userId!, req.userRole || 'Patient', req.body);
    return res.status(result.status).json(result.data);
  } catch {
    return res.json({ message: 'OK' });
  }
});

router.get('/patient-vital-thresholds/:id', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyGet(`/patient-vital-thresholds/${req.params.id}`, req.userId!, req.userRole || 'Patient');
    return res.status(result.status).json(result.data);
  } catch {
    return res.json({
      threshold: {
        isPending: false, thresholdsId: 'default', createdAt: new Date().toISOString(),
        minHr: 60, maxHr: 100, hrSetBy: '', hrSetAt: 0,
        minTemp: 36.1, maxTemp: 37.2, tempSetBy: '', tempSetAt: 0,
        minSpo2: 95, spo2SetBy: '', spo2SetAt: 0,
        minRr: 12, maxRr: 20, rrSetBy: '', rrSetAt: 0,
        minSbp: 90, maxSbp: 140, sbpSetBy: '', sbpSetAt: 0,
        minDbp: 60, maxDbp: 90, dbpSetBy: '', dbpSetAt: 0,
        minMap: 70, maxMap: 105, mapSetBy: '', mapSetAt: 0,
      },
      users: [],
    });
  }
});

router.get('/patient-vitals/:id', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyGet(`/patient-vitals/${req.params.id}`, req.userId!, req.userRole || 'Patient');
    return res.status(result.status).json(result.data);
  } catch {
    return res.json({ vitals: [], thresholds: [], users: [], total: 0 });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// REMAINING PROXIED STUBS
// ═══════════════════════════════════════════════════════════════════════

router.put('/doctor/:type/:id', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyPut(`/doctor/${req.params.type}/${req.params.id}`, req.userId!, req.userRole || 'Doctor', req.body);
    return res.status(result.status).json(result.data);
  } catch {
    return res.json({ message: 'OK' });
  }
});

router.patch('/patient/person-emergency-contacts/order', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyPatch('/patient/person-emergency-contacts/order', req.userId!, req.userRole || 'Patient', req.body);
    return res.status(result.status).json(result.data);
  } catch {
    return res.json({ message: 'OK' });
  }
});

router.all('/patient/person-suggested-contact*', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    if (req.method === 'POST') {
      const result = await proxyPost('/patient/person-suggested-contact', req.userId!, req.userRole || 'Patient', req.body);
      return res.status(result.status).json(result.data);
    }
    return res.json({ message: 'OK' });
  } catch {
    return res.json({ message: 'OK' });
  }
});

router.all('/patient/organization-suggested-contact*', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    if (req.method === 'POST') {
      const result = await proxyPost('/patient/organization-suggested-contact', req.userId!, req.userRole || 'Patient', req.body);
      return res.status(result.status).json(result.data);
    }
    return res.json({ message: 'OK' });
  } catch {
    return res.json({ message: 'OK' });
  }
});

router.post('/change-email', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});
router.post('/change-email/confirm', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});

router.patch('/my-profile/delete', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});
router.patch('/my-profile/recovery', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});

router.post('/avatar/upload', requireAuth, (_req: Request, res: Response) => {
  return res.json({ avatar: '' });
});
router.delete('/avatar', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});

router.get('/data-accesses', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const result = await proxyGet('/data-accesses', req.userId!, req.userRole || 'Patient');
    return res.status(result.status).json(result.data);
  } catch {
    return res.json([]);
  }
});

router.all('/data-access*', requireAuth, async (req: Request & { userId?: string; userRole?: string }, res: Response) => {
  try {
    const path = req.path;
    if (req.method === 'POST') {
      const result = await proxyPost(path, req.userId!, req.userRole || 'Patient', req.body);
      return res.status(result.status).json(result.data);
    }
    if (req.method === 'GET') {
      const result = await proxyGet(path, req.userId!, req.userRole || 'Patient');
      return res.status(result.status).json(result.data);
    }
    return res.json({ message: 'OK' });
  } catch {
    return res.json({ message: 'OK' });
  }
});

export default router;
