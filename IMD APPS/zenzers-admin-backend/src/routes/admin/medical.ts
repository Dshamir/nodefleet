import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';

const router = Router();
const logger = require('../../logging').getLogger('medical-proxy');

const MEDICAL_API_URL = process.env.MEDICAL_API_URL || 'http://medical-api:3002';

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
    const headers = { 'Authorization': authHeader, 'Content-Type': 'application/json' };

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
