/**
 * Mobile-App-Compatible API Routes
 *
 * Serves the endpoints that the Zenzers4Life mobile app (alevelsoft-med-app)
 * expects. Provides direct JWT auth against MongoDB users collection,
 * bypassing Keycloak for local development.
 *
 * Endpoints:
 *   POST /sign-in, /refresh-token, /sign-out
 *   POST /patient/sign-up, /sign-up/confirm, /sign-up/resend-code
 *   POST /forgot-password, /forgot-password/confirm
 *   GET|PATCH /patient/my-profile
 *   POST /change-password
 *   PATCH /measurement-system
 *   POST /patient/vitals, GET /patient/my-vitals
 *   GET /vitals/absolute, GET /patient/my-vital-thresholds
 *   GET /patient/emergency-contacts
 *   POST|DELETE /patient/person-emergency-contact
 *   GET /specialties, /diagnoses, /medications
 */
import { Router, Request, Response, NextFunction } from 'express';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb, ObjectId } = require('./admin/db');

const router = Router();

// ── Config ────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'zenzers-dev-jwt-secret-change-in-prod';
const ACCESS_TOKEN_TTL = '1h';
const REFRESH_TOKEN_TTL = '30d';

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

function userToResponse(user: any) {
  const role = normalizeRole(user.role);
  return {
    avatar: user.avatar || '',
    deletedAt: user.deletedAt || null,
    userId: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roleLabel: user.roleLabel || role,
    phone: user.phone || '',
    role,
    passwordUpdatedAt: user.passwordUpdatedAt || 0,
    measurementSystem: user.measurementSystem || 'Metric',
  };
}

/** Middleware: verify Bearer token and attach req.userId / req.userEmail */
async function requireAuth(req: Request & { userId?: string; userEmail?: string }, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: 'Missing or invalid token' });
  try {
    const decoded: any = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId = decoded.sub;
    req.userEmail = decoded.email;
    next();
  } catch {
    return res.status(401).json({ message: 'Token expired or invalid' });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// AUTH ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

/**
 * POST /sign-in
 * Body: { email, password, rememberMe? }
 * Returns: { accessToken, accessTokenExpireTime, refreshToken, user }
 */
router.post('/sign-in', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const db = await getDb();
    const user = await db.collection('mobileUsers').findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    const accessToken = signAccessToken(user._id.toString(), user.email, user.role);
    const refreshToken = signRefreshToken(user._id.toString());

    // Store refresh token
    await db.collection('mobileRefreshTokens').insertOne({
      userId: user._id,
      token: refreshToken,
      createdAt: new Date(),
    });

    return res.json({
      accessToken,
      accessTokenExpireTime: Math.floor(Date.now() / 1000) + 3600,
      refreshToken,
      user: userToResponse(user),
    });
  } catch (err: any) {
    console.error('[mobile-api] sign-in error:', err.message);
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

    const user = await db.collection('mobileUsers').findOne({ _id: new ObjectId(decoded.sub) });
    if (!user) return res.status(401).json({ message: 'User not found' });

    const newAccessToken = signAccessToken(user._id.toString(), user.email, user.role);
    const newRefreshToken = signRefreshToken(user._id.toString());

    // Rotate refresh token
    await db.collection('mobileRefreshTokens').deleteOne({ _id: stored._id });
    await db.collection('mobileRefreshTokens').insertOne({
      userId: user._id,
      token: newRefreshToken,
      createdAt: new Date(),
    });

    return res.json({
      accessToken: newAccessToken,
      accessTokenExpireTime: Math.floor(Date.now() / 1000) + 3600,
      refreshToken: newRefreshToken,
      user: userToResponse(user),
    });
  } catch {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});

/**
 * POST /sign-out
 * Body: { refreshToken }
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
 * Body: { email, password, firstName, lastName, phone }
 */
router.post('/patient/sign-up', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const db = await getDb();
    const existing = await db.collection('mobileUsers').findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const now = new Date();
    const result = await db.collection('mobileUsers').insertOne({
      email: email.toLowerCase().trim(),
      password: hashed,
      firstName: firstName || '',
      lastName: lastName || '',
      phone: phone || '',
      role: 'patient',
      roleLabel: 'patient',
      avatar: '',
      measurementSystem: 'Metric',
      patientMetadata: {},
      emailVerified: false,
      verificationCode: String(Math.floor(100000 + Math.random() * 900000)),
      deletedAt: null,
      passwordUpdatedAt: now.getTime(),
      createdAt: now,
      updatedAt: now,
    });

    return res.status(201).json({
      message: 'Registration successful. Check email for verification code.',
      userId: result.insertedId.toString(),
    });
  } catch (err: any) {
    console.error('[mobile-api] sign-up error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /sign-up/confirm
 * Body: { email, code }
 */
router.post('/sign-up/confirm', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    const db = await getDb();
    const user = await db.collection('mobileUsers').findOne({ email: email?.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // In dev, accept any 6-digit code or the stored code
    if (user.verificationCode && user.verificationCode !== String(code)) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    await db.collection('mobileUsers').updateOne(
      { _id: user._id },
      { $set: { emailVerified: true }, $unset: { verificationCode: '' } },
    );
    return res.json({ message: 'Email verified' });
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /sign-up/resend-code
 * Body: { email }
 */
router.post('/sign-up/resend-code', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const db = await getDb();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await db.collection('mobileUsers').updateOne(
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
 * Body: { email }
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const db = await getDb();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await db.collection('mobileUsers').updateOne(
      { email: email?.toLowerCase().trim() },
      { $set: { resetCode: code } },
    );
    // In dev, just log the code
    console.log(`[mobile-api] Password reset code for ${email}: ${code}`);
    return res.json({ message: 'Password reset code sent' });
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /forgot-password/confirm
 * Body: { email, code, newPassword }
 */
router.post('/forgot-password/confirm', async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;
    const db = await getDb();
    const user = await db.collection('mobileUsers').findOne({ email: email?.toLowerCase().trim() });
    if (!user || (user.resetCode && user.resetCode !== String(code))) {
      return res.status(400).json({ message: 'Invalid code' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.collection('mobileUsers').updateOne(
      { _id: user._id },
      { $set: { password: hashed, passwordUpdatedAt: Date.now() }, $unset: { resetCode: '' } },
    );
    return res.json({ message: 'Password reset successful' });
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// PROFILE ENDPOINTS (auth required)
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /patient/my-profile
 */
router.get('/patient/my-profile', requireAuth, async (req: Request & { userId?: string }, res: Response) => {
  try {
    const db = await getDb();
    const user = await db.collection('mobileUsers').findOne({ _id: new ObjectId(req.userId) });
    if (!user) return res.status(404).json({ message: 'Profile not found' });
    return res.json(userToResponse(user));
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * PATCH /patient/my-profile
 * Body: partial profile fields
 */
router.patch('/patient/my-profile', requireAuth, async (req: Request & { userId?: string }, res: Response) => {
  try {
    const allowed = ['firstName', 'lastName', 'phone', 'avatar', 'patientMetadata', 'dob', 'gender', 'height', 'weight'];
    const updates: any = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updatedAt = new Date();

    const db = await getDb();
    await db.collection('mobileUsers').updateOne({ _id: new ObjectId(req.userId) }, { $set: updates });
    const user = await db.collection('mobileUsers').findOne({ _id: new ObjectId(req.userId) });
    return res.json(userToResponse(user));
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /change-password
 * Body: { currentPassword, newPassword }
 */
router.post('/change-password', requireAuth, async (req: Request & { userId?: string }, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const db = await getDb();
    const user = await db.collection('mobileUsers').findOne({ _id: new ObjectId(req.userId) });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ message: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.collection('mobileUsers').updateOne(
      { _id: new ObjectId(req.userId) },
      { $set: { password: hashed, passwordUpdatedAt: Date.now() } },
    );
    return res.json({ message: 'Password changed' });
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * PATCH /measurement-system
 * Body: { measurementSystem: 'Metric' | 'Imperial' }
 */
router.patch('/measurement-system', requireAuth, async (req: Request & { userId?: string }, res: Response) => {
  try {
    const { measurementSystem } = req.body;
    const db = await getDb();
    await db.collection('mobileUsers').updateOne(
      { _id: new ObjectId(req.userId) },
      { $set: { measurementSystem, updatedAt: new Date() } },
    );
    return res.json({ measurementSystem });
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// VITALS ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

/**
 * POST /patient/vitals
 * Body: { heartRate, oxygenSaturation, temperature, respirationRate, bloodPressure, steps, fallType, battery, ... }
 */
router.post('/patient/vitals', requireAuth, async (req: Request & { userId?: string }, res: Response) => {
  try {
    const db = await getDb();
    const vital = {
      userId: new ObjectId(req.userId),
      ...req.body,
      timestamp: req.body.timestamp || new Date(),
      createdAt: new Date(),
    };
    const result = await db.collection('mobileVitals').insertOne(vital);
    return res.status(201).json({ id: result.insertedId.toString(), message: 'Vitals recorded' });
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /patient/my-vitals?from=ISO&to=ISO&limit=100&offset=0
 */
router.get('/patient/my-vitals', requireAuth, async (req: Request & { userId?: string }, res: Response) => {
  try {
    const db = await getDb();
    const filter: any = { userId: new ObjectId(req.userId) };
    if (req.query.from || req.query.to) {
      filter.timestamp = {};
      if (req.query.from) filter.timestamp.$gte = new Date(req.query.from as string);
      if (req.query.to) filter.timestamp.$lte = new Date(req.query.to as string);
    }
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    const vitals = await db.collection('mobileVitals')
      .find(filter)
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    const total = await db.collection('mobileVitals').countDocuments(filter);
    // App expects VitalsResponse shape: { vitals[], thresholds[], users[], total }
    return res.json({ vitals, thresholds: [], users: [], total });
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /vitals/absolute
 * Returns default vital thresholds (no auth required)
 */
router.get('/vitals/absolute', (_req: Request, res: Response) => {
  return res.json({
    heartRate: { min: 40, max: 220 },
    oxygenSaturation: { min: 70, max: 100 },
    temperature: { min: 32, max: 42 },
    respirationRate: { min: 4, max: 60 },
    meanArterialPressure: { min: 43, max: 160 },
    bloodPressure: { minSbp: 70, maxSbp: 220, minDbp: 30, maxDbp: 130 },
  });
});

/**
 * GET /patient/my-vital-thresholds
 */
router.get('/patient/my-vital-thresholds', requireAuth, async (req: Request & { userId?: string }, res: Response) => {
  try {
    const db = await getDb();
    const stored = await db.collection('mobileVitalThresholds').findOne({ userId: new ObjectId(req.userId) });
    // App expects { threshold: { isPending, minHr, maxHr, ... }, users: [] }
    const threshold = {
      isPending: false,
      thresholdsId: stored?._id?.toString() || 'default',
      createdAt: stored?.createdAt || new Date().toISOString(),
      minHr: stored?.heartRate?.min ?? 60,
      maxHr: stored?.heartRate?.max ?? 100,
      hrSetBy: '', hrSetAt: 0,
      minTemp: stored?.temperature?.min ?? 36.1,
      maxTemp: stored?.temperature?.max ?? 37.2,
      tempSetBy: '', tempSetAt: 0,
      minSpo2: stored?.oxygenSaturation?.min ?? 95,
      spo2SetBy: '', spo2SetAt: 0,
      minRr: stored?.respirationRate?.min ?? 12,
      maxRr: stored?.respirationRate?.max ?? 20,
      rrSetBy: '', rrSetAt: 0,
      minSbp: stored?.bloodPressure?.minSbp ?? 90,
      maxSbp: stored?.bloodPressure?.maxSbp ?? 140,
      sbpSetBy: '', sbpSetAt: 0,
      minDbp: stored?.bloodPressure?.minDbp ?? 60,
      maxDbp: stored?.bloodPressure?.maxDbp ?? 90,
      dbpSetBy: '', dbpSetAt: 0,
      minMap: stored?.meanArterialPressure?.min ?? 70,
      maxMap: stored?.meanArterialPressure?.max ?? 105,
      mapSetBy: '', mapSetAt: 0,
    };
    return res.json({ threshold, users: [] });
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// EMERGENCY CONTACTS
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /patient/emergency-contacts
 * Returns: { persons: [...], organizations: [...] }
 */
router.get('/patient/emergency-contacts', requireAuth, async (req: Request & { userId?: string }, res: Response) => {
  try {
    const db = await getDb();
    const contacts = await db.collection('mobileEmergencyContacts')
      .find({ userId: new ObjectId(req.userId) })
      .toArray();
    const persons = contacts.filter((c: any) => c.type === 'person').map((c: any) => ({
      ...c,
      contactId: c._id.toString(),
    }));
    const organizations = contacts.filter((c: any) => c.type === 'organization').map((c: any) => ({
      ...c,
      contactId: c._id.toString(),
    }));
    return res.json({ persons, organizations });
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /patient/person-emergency-contact
 */
router.post('/patient/person-emergency-contact', requireAuth, async (req: Request & { userId?: string }, res: Response) => {
  try {
    const db = await getDb();
    const contact = {
      userId: new ObjectId(req.userId),
      type: 'person',
      ...req.body,
      createdAt: new Date(),
    };
    const result = await db.collection('mobileEmergencyContacts').insertOne(contact);
    return res.status(201).json({ ...contact, _id: result.insertedId });
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * DELETE /patient/person-emergency-contact/:id
 */
router.delete('/patient/person-emergency-contact/:id', requireAuth, async (req: Request & { userId?: string }, res: Response) => {
  try {
    const db = await getDb();
    await db.collection('mobileEmergencyContacts').deleteOne({
      _id: new ObjectId(req.params.id),
      userId: new ObjectId(req.userId),
    });
    return res.json({ message: 'Contact removed' });
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// REFERENCE DATA
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /specialties
 */
router.get('/specialties', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const specialties = await db.collection('specialties').find({}).toArray();
    if (specialties.length === 0) {
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
    return res.json(specialties);
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /diagnoses
 */
router.get('/diagnoses', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const diagnoses = await db.collection('diagnoses').find({}).toArray();
    if (diagnoses.length === 0) {
      // App expects { diagnosisName } per Diagnosis type
      return res.json([
        { _id: '1', diagnosisName: 'Hypertension' },
        { _id: '2', diagnosisName: 'Diabetes Type 2' },
        { _id: '3', diagnosisName: 'Asthma' },
        { _id: '4', diagnosisName: 'COPD' },
        { _id: '5', diagnosisName: 'Heart Failure' },
      ]);
    }
    return res.json(diagnoses);
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /medications
 */
router.get('/medications', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const medications = await db.collection('medications').find({}).toArray();
    if (medications.length === 0) {
      // App expects { genericName, brandNames } per MedicationList type
      return res.json([
        { _id: '1', genericName: 'Metformin', brandNames: 'Glucophage', dosageUnit: 'mg' },
        { _id: '2', genericName: 'Lisinopril', brandNames: 'Zestril', dosageUnit: 'mg' },
        { _id: '3', genericName: 'Atorvastatin', brandNames: 'Lipitor', dosageUnit: 'mg' },
        { _id: '4', genericName: 'Metoprolol', brandNames: 'Lopressor', dosageUnit: 'mg' },
        { _id: '5', genericName: 'Salbutamol', brandNames: 'Ventolin', dosageUnit: 'mcg' },
      ]);
    }
    return res.json(medications);
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// STUB ENDPOINTS — return empty/default data for endpoints the mobile
// app calls but that aren't critical for basic login flow
// ═══════════════════════════════════════════════════════════════════════

/** GET /patient/suggested-contacts */
router.get('/patient/suggested-contacts', requireAuth, (_req: Request, res: Response) => {
  return res.json({ persons: [], organizations: [] });
});

/** GET /patient/data-accesses */
router.get('/patient/data-accesses', requireAuth, (_req: Request, res: Response) => {
  return res.json([]);
});

/** POST /patient/data-access/* */
router.post('/patient/data-access/:action', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});

/** GET /patient/my-doctors */
router.get('/patient/my-doctors', requireAuth, (_req: Request, res: Response) => {
  return res.json([]);
});

/** GET /patient/my-caregivers */
router.get('/patient/my-caregivers', requireAuth, (_req: Request, res: Response) => {
  return res.json([]);
});

/** PATCH /patient/organization-emergency-contact(s)/* */
router.all('/patient/organization-emergency-contact*', requireAuth, (req: Request, res: Response) => {
  if (req.method === 'GET') return res.json([]);
  return res.json({ message: 'OK' });
});

/** PATCH /patient/person-emergency-contacts/order */
router.patch('/patient/person-emergency-contacts/order', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});

/** GET/POST /patient/person-suggested-contact/* */
router.all('/patient/person-suggested-contact*', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});

/** GET/POST /patient/organization-suggested-contact/* */
router.all('/patient/organization-suggested-contact*', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});

/** POST /change-email, /change-email/confirm */
router.post('/change-email', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});
router.post('/change-email/confirm', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});

/** PATCH /my-profile/delete, /my-profile/recovery */
router.patch('/my-profile/delete', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});
router.patch('/my-profile/recovery', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});

/** GET /patient-diagnoses/:id, /patient-medications/:id, /patient-status/:id */
router.get('/patient-diagnoses/:id', requireAuth, (_req: Request, res: Response) => {
  return res.json([]);
});
router.get('/patient-medications/:id', requireAuth, (_req: Request, res: Response) => {
  return res.json([]);
});
router.get('/patient-status/:id', requireAuth, (_req: Request, res: Response) => {
  return res.json({ status: 'normal' });
});
router.put('/patient-status/:type/:id', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});

/** POST/DELETE /patient-diagnosis, /patient-medication */
router.post('/patient-diagnosis', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});
router.delete('/patient-diagnosis/:id', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});
router.post('/patient-medication', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});
router.patch('/patient-medication/:id', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});
router.delete('/patient-medication/:id', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});

/** GET /patient-vital-thresholds/:id */
router.get('/patient-vital-thresholds/:id', requireAuth, (_req: Request, res: Response) => {
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
});

/** GET /patient-vitals/:id */
router.get('/patient-vitals/:id', requireAuth, (_req: Request, res: Response) => {
  return res.json({ vitals: [], thresholds: [], users: [], total: 0 });
});

/** Avatar upload/delete stubs */
router.post('/avatar/upload', requireAuth, (_req: Request, res: Response) => {
  return res.json({ avatar: '' });
});
router.delete('/avatar', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});

/** Data access stubs */
router.get('/data-accesses', requireAuth, (_req: Request, res: Response) => {
  return res.json([]);
});
router.all('/data-access*', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});
router.get('/profile/my-patients', requireAuth, (_req: Request, res: Response) => {
  return res.json([]);
});

/** Doctor/caregiver profile stubs */
router.get('/doctor/my-profile', requireAuth, (_req: Request, res: Response) => {
  return res.json({});
});
router.get('/caregiver/my-profile', requireAuth, (_req: Request, res: Response) => {
  return res.json({});
});
router.patch('/doctor/my-profile', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});
router.patch('/caregiver/my-profile', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});

/** Doctor threshold stubs */
router.put('/doctor/:type/:id', requireAuth, (_req: Request, res: Response) => {
  return res.json({ message: 'OK' });
});

/** Sign-up stubs for doctor/caregiver */
router.post('/doctor/sign-up', async (req: Request, res: Response) => {
  return res.status(201).json({ message: 'Registration successful' });
});
router.post('/caregiver/sign-up', async (req: Request, res: Response) => {
  return res.status(201).json({ message: 'Registration successful' });
});

export default router;
