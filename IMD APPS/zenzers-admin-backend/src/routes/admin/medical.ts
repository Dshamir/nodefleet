import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';
import { logAccess } from '../../services/data-access-log';

const router = Router();
const logger = require('../../logging').getLogger('medical-proxy');

const MEDICAL_API_URL = process.env.MEDICAL_API_URL || 'http://medical-api:3002';
const INTERNAL_PASSKEY = process.env.INTERNAL_SERVICES_PASSKEY || '';

// ---------------------------------------------------------------------------
// In-memory cache for composite vitals/patients endpoint (30s TTL)
// ---------------------------------------------------------------------------
let compositeCache: { data: any; expires: number } | null = null;
const CACHE_TTL = 30_000;

// ---------------------------------------------------------------------------
// Proxy helpers
// ---------------------------------------------------------------------------

async function proxyGet(path: string, req: Request, res: Response, transform?: (data: any) => any) {
  try {
    const url = new URL(path, MEDICAL_API_URL);
    Object.entries(req.query).forEach(([key, val]) => {
      if (typeof val === 'string') url.searchParams.set(key, val);
    });
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': req.headers.authorization || '',
        'Content-Type': 'application/json',
        'X-Internal-Auth': INTERNAL_PASSKEY,
      },
    });
    let data = await response.json() as any;
    if (transform && response.status >= 200 && response.status < 300) {
      data = transform(data);
    }
    res.status(response.status).json(data);
  } catch (err: any) {
    logger.error(`Proxy GET ${path} failed: ${err.message}`);
    res.status(502).json({ error: 'Medical API unavailable', details: err.message });
  }
}

async function proxyMutation(method: string, path: string, req: Request, res: Response) {
  try {
    const url = new URL(path, MEDICAL_API_URL);
    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Authorization': req.headers.authorization || '',
        'Content-Type': 'application/json',
        'X-Internal-Auth': INTERNAL_PASSKEY,
      },
      body: req.body ? JSON.stringify(req.body) : undefined,
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err: any) {
    logger.error(`Proxy ${method} ${path} failed: ${err.message}`);
    res.status(502).json({ error: 'Medical API unavailable', details: err.message });
  }
}

// ---------------------------------------------------------------------------
// Field mapping helpers
// ---------------------------------------------------------------------------

/** Build full name from firstName + lastName */
function fullName(u: any): string {
  return [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.email || 'Unknown';
}

// ---------------------------------------------------------------------------
// Patients — expects { patients: [{ id, name, email, phone, dateOfBirth, status }] }
// ---------------------------------------------------------------------------
router.get('/patients', (req, res) => proxyGet('/admin/patients', req, res, (raw) => ({
  patients: (raw.data || []).map((u: any) => ({
    id: u.id,
    name: fullName(u),
    email: u.email || '',
    phone: u.phone || '',
    dateOfBirth: u.patientMetadata?.dob || null,
    status: u.deletedAt ? 'inactive' : 'active',
  })),
  total: raw.total || 0,
})));
router.get('/patients/:id', (req, res) => proxyGet(`/admin/patients/${req.params.id}`, req, res));

// ---------------------------------------------------------------------------
// Doctors — expects { doctors: [{ id, name, email, specialization, patientsCount, status }] }
// ---------------------------------------------------------------------------
router.get('/doctors', (req, res) => proxyGet('/admin/doctors', req, res, (raw) => ({
  doctors: (raw.data || []).map((d: any) => ({
    id: d.id,
    name: fullName(d),
    email: d.email || '',
    specialization: d.doctorMetadata?.specialty || d.specialty || '',
    patientsCount: d.patientsCount || 0,
    status: d.deletedAt ? 'inactive' : 'active',
  })),
  total: raw.total || 0,
})));
router.get('/doctors/:id', (req, res) => proxyGet(`/admin/doctors/${req.params.id}`, req, res));

// ---------------------------------------------------------------------------
// Caregivers — expects { caregivers: [{ id, name, email, patientsAssigned, status }] }
// ---------------------------------------------------------------------------
router.get('/caregivers', (req, res) => proxyGet('/admin/caregivers', req, res, (raw) => ({
  caregivers: (raw.data || []).map((c: any) => ({
    id: c.id,
    name: fullName(c),
    email: c.email || '',
    patientsAssigned: c.patientsAssigned || 0,
    status: c.deletedAt ? 'inactive' : 'active',
  })),
  total: raw.total || 0,
})));

// ---------------------------------------------------------------------------
// Composite: Patient Vitals (fan-out 5 upstream APIs, join by patientId)
// ---------------------------------------------------------------------------

async function fetchCompositePatients(authHeader: string) {
  if (compositeCache && Date.now() < compositeCache.expires) {
    return compositeCache.data;
  }

  const headers = { 'Authorization': authHeader, 'Content-Type': 'application/json', 'X-Internal-Auth': INTERNAL_PASSKEY };
  const makeUrl = (path: string) => new URL(path, MEDICAL_API_URL).toString();

  const [vitalsRes, patientsRes, doctorsRes, caregiversRes, gatewaysRes, dataAccessRes] =
    await Promise.allSettled([
      fetch(makeUrl('/admin/vitals/active'), { headers }),
      fetch(makeUrl('/admin/patients'), { headers }),
      fetch(makeUrl('/admin/doctors'), { headers }),
      fetch(makeUrl('/admin/caregivers'), { headers }),
      fetch(makeUrl('/admin/gateways'), { headers }),
      fetch(makeUrl('/admin/data-access'), { headers }),
    ]);

  // Required endpoints — fail if either is missing
  if (vitalsRes.status === 'rejected' || patientsRes.status === 'rejected') {
    throw new Error('Required upstream API (vitals or patients) unavailable');
  }
  const vitalsRaw = await (vitalsRes as PromiseFulfilledResult<any>).value.json() as any;
  const patientsRaw = await (patientsRes as PromiseFulfilledResult<any>).value.json() as any;

  // Optional endpoints — null on failure
  let doctorsRaw: any = null;
  let caregiversRaw: any = null;
  let gatewaysRaw: any = null;
  let dataAccessRaw: any = null;

  if (doctorsRes.status === 'fulfilled') {
    try { doctorsRaw = await doctorsRes.value.json(); } catch { logger.warn('Failed to parse doctors response'); }
  }
  if (caregiversRes.status === 'fulfilled') {
    try { caregiversRaw = await caregiversRes.value.json(); } catch { logger.warn('Failed to parse caregivers response'); }
  }
  if (gatewaysRes.status === 'fulfilled') {
    try { gatewaysRaw = await gatewaysRes.value.json(); } catch { logger.warn('Failed to parse gateways response'); }
  }
  if (dataAccessRes.status === 'fulfilled') {
    try { dataAccessRaw = await dataAccessRes.value.json(); } catch { logger.warn('Failed to parse data-access response'); }
  }

  // Build lookup maps
  const patientMap: Record<string, any> = {};
  for (const p of (patientsRaw.data || [])) {
    patientMap[p.id] = p;
  }

  const doctorMap: Record<string, any> = {};
  if (doctorsRaw?.data) {
    for (const d of doctorsRaw.data) {
      doctorMap[d.id] = d;
    }
  }

  const caregiverMap: Record<string, any> = {};
  if (caregiversRaw?.data) {
    for (const c of caregiversRaw.data) {
      caregiverMap[c.id] = c;
    }
  }

  const gatewayByPatient: Record<string, any> = {};
  if (gatewaysRaw?.data) {
    for (const g of gatewaysRaw.data) {
      const pid = g.userId || g.patientId;
      if (pid) gatewayByPatient[pid] = g;
    }
  }

  // data-access: doctor/caregiver → patient relationships
  const doctorForPatient: Record<string, string> = {};
  const caregiverForPatient: Record<string, string> = {};
  if (dataAccessRaw?.data) {
    for (const da of dataAccessRaw.data) {
      const patientId = da.patientUserId;
      const grantedId = da.grantedUserId;
      const role = da.grantedUser?.role?.toLowerCase() || '';
      if (role === 'caregiver') {
        caregiverForPatient[patientId] = grantedId;
      } else {
        doctorForPatient[patientId] = grantedId;
      }
    }
  }

  // Group vitals by patient, keep most recent
  const latestByPatient: Record<string, any> = {};
  for (const v of (vitalsRaw.data || [])) {
    const pid = v.userId;
    if (!pid) continue;
    const ts = v.createdAt || (v.timestamp ? new Date(v.timestamp * 1000).toISOString() : null);
    if (!latestByPatient[pid] || (ts && ts > (latestByPatient[pid]._ts || ''))) {
      latestByPatient[pid] = { ...v, _ts: ts };
    }
  }

  // Build composite patient nodes
  const patients: any[] = [];
  for (const [pid, v] of Object.entries(latestByPatient)) {
    const p = patientMap[pid];
    let status: string = 'normal';
    if ((v as any).fall) status = 'critical';
    else if ((v as any).isHrNormal === false || (v as any).isSbpNormal === false || (v as any).isDbpNormal === false ||
             (v as any).isSpo2Normal === false || (v as any).isTempNormal === false || (v as any).isRrNormal === false) {
      status = 'warning';
    }

    const docId = doctorForPatient[pid];
    const cgId = caregiverForPatient[pid];
    const gw = gatewayByPatient[pid];
    const doc = docId ? doctorMap[docId] : null;
    const cg = cgId ? caregiverMap[cgId] : null;

    patients.push({
      patientId: pid,
      patientName: p ? fullName(p) : fullName((v as any).user),
      email: p?.email || '',
      phone: p?.phone || '',
      dateOfBirth: p?.patientMetadata?.dob || null,
      doctor: doc ? {
        id: doc.id,
        name: fullName(doc),
        email: doc.email || '',
        phone: doc.phone || '',
        specialization: doc.doctorMetadata?.specialty || doc.specialty || '',
      } : null,
      caregiver: cg ? {
        id: cg.id,
        name: fullName(cg),
        email: cg.email || '',
        phone: cg.phone || '',
      } : null,
      gateway: gw ? {
        deviceId: gw.deviceId || gw.id,
        status: gw.status || 'offline',
        lastSeen: gw.lastSeen || gw.createdAt || null,
        batteryPercent: gw.batteryPercent ?? 0,
      } : null,
      latestVitals: {
        heartRate: (v as any).hr ?? null,
        bloodPressureSystolic: (v as any).sbp ?? null,
        bloodPressureDiastolic: (v as any).dbp ?? null,
        temperature: (v as any).temp ?? null,
        spO2: (v as any).spo2 ?? null,
        timestamp: (v as any)._ts,
        status,
      },
    });
  }

  const result = { patients, total: patients.length };
  compositeCache = { data: result, expires: Date.now() + CACHE_TTL };
  return result;
}

// GET /admin/vitals/patients — composite list
router.get('/vitals/patients', async (req: Request, res: Response) => {
  try {
    const data = await fetchCompositePatients(req.headers.authorization || '');
    logAccess({
      userId: (req as any).userId || 'admin',
      action: 'view',
      resourceType: 'patient-vitals',
      resourceId: 'list',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });
    res.json(data);
  } catch (err: any) {
    logger.error(`Composite vitals/patients failed: ${err.message}`);
    res.status(502).json({ error: 'Medical API unavailable', details: err.message });
  }
});

// GET /admin/vitals/patients/:patientId — single patient composite
router.get('/vitals/patients/:patientId', async (req: Request, res: Response) => {
  try {
    const data = await fetchCompositePatients(req.headers.authorization || '');
    const patient = data.patients.find((p: any) => p.patientId === req.params.patientId);
    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }
    logAccess({
      userId: (req as any).userId || 'admin',
      action: 'view',
      resourceType: 'patient-vitals',
      resourceId: req.params.patientId,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });
    res.json({ patient });
  } catch (err: any) {
    logger.error(`Composite vitals/patients/:id failed: ${err.message}`);
    res.status(502).json({ error: 'Medical API unavailable', details: err.message });
  }
});

// GET /admin/vitals/:patientId/telemetry — paginated telemetry log
router.get('/vitals/:patientId/telemetry', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const url = new URL(`/admin/vitals/${req.params.patientId}`, MEDICAL_API_URL);
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': req.headers.authorization || '',
        'Content-Type': 'application/json',
        'X-Internal-Auth': INTERNAL_PASSKEY,
      },
    });
    const raw = await response.json() as any;
    const allEntries = (raw.data || []).slice(0, 500); // cap at 500

    const entries = allEntries.map((v: any) => {
      let status: string = 'normal';
      if (v.fall) status = 'critical';
      else if (v.isHrNormal === false || v.isSbpNormal === false || v.isDbpNormal === false ||
               v.isSpo2Normal === false || v.isTempNormal === false || v.isRrNormal === false) {
        status = 'warning';
      }
      return {
        id: v.id,
        syncTimestamp: v.createdAt || (v.timestamp ? new Date(v.timestamp * 1000).toISOString() : null),
        heartRate: v.hr ?? null,
        bloodPressureSystolic: v.sbp ?? null,
        bloodPressureDiastolic: v.dbp ?? null,
        temperature: v.temp ?? null,
        spO2: v.spo2 ?? null,
        respiratoryRate: v.rr ?? null,
        fall: !!v.fall,
        status,
        isHrNormal: v.isHrNormal ?? null,
        isSbpNormal: v.isSbpNormal ?? null,
        isDbpNormal: v.isDbpNormal ?? null,
        isSpo2Normal: v.isSpo2Normal ?? null,
        isTempNormal: v.isTempNormal ?? null,
        isRrNormal: v.isRrNormal ?? null,
      };
    });

    const start = (page - 1) * limit;
    const paged = entries.slice(start, start + limit);

    logAccess({
      userId: (req as any).userId || 'admin',
      action: 'view',
      resourceType: 'patient-vitals',
      resourceId: req.params.patientId,
      fields: ['telemetry'],
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    res.json({ entries: paged, total: entries.length, page, limit });
  } catch (err: any) {
    logger.error(`Telemetry fetch failed: ${err.message}`);
    res.status(502).json({ error: 'Medical API unavailable', details: err.message });
  }
});

// POST /admin/vitals/unmask-audit — HIPAA unmask event logging
router.post('/vitals/unmask-audit', async (req: Request, res: Response) => {
  try {
    await logAccess({
      userId: (req as any).userId || 'admin',
      action: 'unmask-phi',
      resourceType: 'patient-vitals',
      resourceId: 'all',
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      reason: 'Admin toggled PHI unmask',
    });
    res.json({ ok: true });
  } catch (err: any) {
    logger.error(`Unmask audit log failed: ${err.message}`);
    res.json({ ok: true }); // Don't fail the unmask action
  }
});

// ---------------------------------------------------------------------------
// Vitals — expects { vitals: [{ id, patientId, patientName, heartRate,
//   bloodPressureSystolic, bloodPressureDiastolic, temperature, spO2,
//   timestamp, status }] }
// ---------------------------------------------------------------------------
router.get('/vitals/active', (req, res) => proxyGet('/admin/vitals/active', req, res, (raw) => ({
  vitals: (raw.data || []).map((v: any) => {
    // Determine status from normal flags
    let status: string = 'normal';
    if (v.fall) status = 'critical';
    else if (v.isHrNormal === false || v.isSbpNormal === false || v.isDbpNormal === false ||
             v.isSpo2Normal === false || v.isTempNormal === false || v.isRrNormal === false) {
      status = 'warning';
    }
    return {
      id: v.id,
      patientId: v.userId,
      patientName: fullName(v.user),
      heartRate: v.hr ?? null,
      bloodPressureSystolic: v.sbp ?? null,
      bloodPressureDiastolic: v.dbp ?? null,
      temperature: v.temp ?? null,
      spO2: v.spo2 ?? null,
      timestamp: v.createdAt || (v.timestamp ? new Date(v.timestamp * 1000).toISOString() : null),
      status,
    };
  }),
  total: raw.total || 0,
})));
router.get('/vitals/:patientId', (req, res) => proxyGet(`/admin/vitals/${req.params.patientId}`, req, res));

// ---------------------------------------------------------------------------
// Medical Records — expects { records: [{ id, patientName, recordType,
//   description, date, doctorName }] }
// Fetches patients + doctors lists to resolve UUID → name
// ---------------------------------------------------------------------------
router.get('/medical-records', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization || '';
    const headers = { 'Authorization': authHeader, 'Content-Type': 'application/json', 'X-Internal-Auth': INTERNAL_PASSKEY };

    // Fetch records, patients, and doctors in parallel
    const [recordsRes, patientsRes, doctorsRes] = await Promise.all([
      fetch(new URL('/admin/medical-records', MEDICAL_API_URL).toString(), { headers }),
      fetch(new URL('/admin/patients', MEDICAL_API_URL).toString(), { headers }),
      fetch(new URL('/admin/doctors', MEDICAL_API_URL).toString(), { headers }),
    ]);

    const raw = await recordsRes.json() as any;
    const patientsRaw = await patientsRes.json() as any;
    const doctorsRaw = await doctorsRes.json() as any;

    // Build UUID → name lookups
    const nameMap: Record<string, string> = {};
    for (const p of (patientsRaw.data || [])) {
      nameMap[p.id] = fullName(p);
    }
    for (const d of (doctorsRaw.data || [])) {
      nameMap[d.id] = fullName(d);
    }

    const records: any[] = [];

    if (raw.diagnoses?.data) {
      for (const d of raw.diagnoses.data) {
        records.push({
          id: d.id,
          patientName: nameMap[d.patientUserId] || d.patientUserId,
          recordType: 'diagnosis',
          description: d.diagnosisName || d.name || '',
          date: d.createdAt || null,
          doctorName: nameMap[d.createdBy] || d.createdBy,
        });
      }
    }

    if (raw.medications?.data) {
      for (const m of raw.medications.data) {
        const dose = m.dose ? `${m.dose}` : '';
        const freq = m.timesPerDay ? ` (${m.timesPerDay})` : '';
        records.push({
          id: m.id,
          patientName: nameMap[m.patientUserId] || m.patientUserId,
          recordType: 'medication',
          description: `${m.genericName || ''}${dose ? ' ' + dose : ''}${freq}`,
          date: m.createdAt || null,
          doctorName: nameMap[m.createdBy] || m.createdBy,
        });
      }
    }

    res.json({ records, total: records.length });
  } catch (err: any) {
    logger.error(`Medical records fetch failed: ${err.message}`);
    res.status(502).json({ error: 'Medical API unavailable', details: err.message });
  }
});

// ---------------------------------------------------------------------------
// Emergency Contacts — expects { contacts: [{ id, patientName, contactName,
//   relationship, phone, email }] }
// ---------------------------------------------------------------------------
router.get('/emergency-contacts', (req, res) => proxyGet('/admin/emergency-contacts', req, res, (raw) => ({
  contacts: (raw.data || []).map((c: any) => ({
    id: c.id,
    patientName: fullName({ firstName: c.firstName, lastName: c.lastName }),
    contactName: fullName({ firstName: c.firstName, lastName: c.lastName }),
    relationship: c.relationship || '',
    phone: c.phone || '',
    email: c.email || '',
  })),
  total: raw.total || 0,
})));

// ---------------------------------------------------------------------------
// Data Access — expects { entries: [{ id, patientName, grantedTo,
//   grantedToRole, accessLevel, grantedDate, status }] }
// ---------------------------------------------------------------------------
router.get('/data-access', (req, res) => proxyGet('/admin/data-access', req, res, (raw) => ({
  entries: (raw.data || []).map((e: any) => {
    const grantedRole = e.grantedUser?.role?.toLowerCase() || '';
    return {
      id: e.id,
      patientName: fullName(e.patientUser),
      grantedTo: fullName(e.grantedUser),
      grantedToRole: grantedRole === 'caregiver' ? 'caregiver' : 'doctor',
      accessLevel: 'full',
      grantedDate: e.createdAt || null,
      status: (e.status || 'Approved').toLowerCase() === 'approved' ? 'active'
            : (e.status || '').toLowerCase() === 'refused' ? 'revoked' : 'expired',
    };
  }),
  total: raw.total || 0,
})));

// ---------------------------------------------------------------------------
// Gateway Devices — expects { gateways: [{ id, deviceId, patientName,
//   deviceType, status, lastSeen, batteryPercent }] }
// ---------------------------------------------------------------------------
router.get('/gateways', (req, res) => proxyGet('/admin/gateways', req, res, (raw) => ({
  gateways: (raw.data || []).map((g: any) => ({
    id: g.id,
    deviceId: g.deviceId || g.id,
    patientName: fullName(g.user),
    deviceType: g.deviceType || 'Zenzer Gateway',
    status: g.status || 'offline',
    lastSeen: g.lastSeen || g.createdAt || null,
    batteryPercent: g.batteryPercent ?? 0,
  })),
  total: raw.total || 0,
})));

// ---------------------------------------------------------------------------
// Medical Stats (for dashboard)
// ---------------------------------------------------------------------------
router.get('/medical-stats', (req, res) => proxyGet('/admin/stats', req, res));

// ---------------------------------------------------------------------------
// CRUD: User Management
// ---------------------------------------------------------------------------
router.put('/users/:id', (req, res) => proxyMutation('PUT', `/admin/users/${req.params.id}`, req, res));
router.delete('/users/:id', (req, res) => proxyMutation('DELETE', `/admin/users/${req.params.id}`, req, res));

export default router;
