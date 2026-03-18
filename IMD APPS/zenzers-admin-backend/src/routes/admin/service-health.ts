const { Router } = require('express');
const net = require('net');
const http = require('http');
const dns = require('dns');
const { getDb } = require('./db');
const logger = require('../../logging').getLogger('service-health');

const router = Router();

interface HealthResult {
  name: string;
  description: string;
  status: 'healthy' | 'down' | 'degraded';
  latencyMs: number;
  error?: string;
}

interface ServiceDef {
  name: string;
  description: string;
  category: 'core' | 'data' | 'messaging' | 'ai' | 'worker' | 'infrastructure' | 'monitoring';
  check: 'self' | 'mongo' | 'redis' | 'tcp' | 'http' | 'dns' | 'dns-replicas';
  host?: string;
  port?: number;
  path?: string;
  timeoutMs?: number;
}

// ── Service Registry (Zenzers 4Life) ────────────────────────────────────────
const SERVICES: ServiceDef[] = [
  // Core application
  { name: 'Backend API', description: 'Express.js REST API server (Node.js)', category: 'core', check: 'self' },
  { name: 'Admin Console', description: 'Admin dashboard & platform management UI', category: 'core', check: 'http', host: 'admin-console', port: 3000, path: '/' },
  { name: 'Medical Web', description: 'Zenzer patient & provider-facing web application', category: 'core', check: 'http', host: 'medical-web', port: 80, path: '/' },
  { name: 'Medical API', description: 'NestJS medical records API (patients, vitals, doctors)', category: 'core', check: 'http', host: 'medical-api', port: 3002, path: '/api' },
  { name: 'Landing Page', description: 'Public SaaS CMS-powered marketing landing page', category: 'core', check: 'http', host: 'admin-backend', port: 3001, path: '/api/cms/page-by-type/home' },

  // Data stores
  { name: 'MongoDB', description: 'Primary document database for projects, users & media', category: 'data', check: 'mongo' },
  { name: 'PostgreSQL', description: 'Relational database for tenants, subscriptions & audit logs', category: 'data', check: 'tcp', host: 'postgres', port: 5432 },
  { name: 'Redis', description: 'In-memory cache, session store & pub/sub messaging', category: 'data', check: 'redis' },

  // Messaging & Auth
  { name: 'RabbitMQ', description: 'AMQP message broker for async job dispatching', category: 'messaging', check: 'tcp', host: 'rabbitmq', port: 5672 },
  { name: 'Keycloak', description: 'Identity & access management (OIDC/OAuth2)', category: 'messaging', check: 'http', host: 'keycloak', port: 8080, path: '/auth/realms/zenzers' },

  // Infrastructure
  { name: 'Nginx', description: 'Reverse proxy, SSL termination & request routing', category: 'infrastructure', check: 'http', host: 'nginx', port: 80, path: '/' },
  { name: 'Ngrok', description: 'Secure tunnel providing external HTTPS access', category: 'infrastructure', check: 'dns', host: 'ngrok' },
];

// ── Check helpers ───────────────────────────────────────────────────────────

async function checkWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ ok: false, latencyMs: timeoutMs, error: 'Timeout' });
    }, timeoutMs);

    fn()
      .then(() => {
        clearTimeout(timer);
        resolve({ ok: true, latencyMs: Date.now() - start });
      })
      .catch((err: any) => {
        clearTimeout(timer);
        resolve({ ok: false, latencyMs: Date.now() - start, error: err.message || String(err) });
      });
  });
}

function httpGet(host: string, port: number, path: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: host, port, path, timeout: timeoutMs }, (res: any) => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        res.resume();
        resolve();
      } else {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
      }
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

function tcpConnect(host: string, port: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.connect(port, host, () => {
      socket.destroy();
      resolve();
    });
    socket.on('error', (err: Error) => {
      socket.destroy();
      reject(err);
    });
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Timeout'));
    });
  });
}

function dnsLookup(host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    dns.lookup(host, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function dnsResolveAll(host: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    dns.resolve4(host, (err: Error | null, addresses: string[]) => {
      if (err) reject(err);
      else resolve(addresses || []);
    });
  });
}

// ── Per-service check dispatch ──────────────────────────────────────────────

async function checkService(svc: ServiceDef): Promise<HealthResult> {
  const timeout = svc.timeoutMs || 3000;
  let result: { ok: boolean; latencyMs: number; error?: string };

  switch (svc.check) {
    case 'self':
      return { name: svc.name, description: svc.description, status: 'healthy', latencyMs: 0 };

    case 'mongo':
      result = await checkWithTimeout(async () => {
        const db = await getDb();
        await db.admin().ping();
      }, timeout);
      break;

    case 'redis':
      result = await checkWithTimeout(async () => {
        const redis = require('../../services/redis');
        const client = redis.getClient?.() || redis.client;
        if (client && typeof client.ping === 'function') {
          await client.ping();
        } else {
          await tcpConnect('redis', 6379, 2000);
        }
      }, timeout);
      break;

    case 'tcp':
      result = await checkWithTimeout(
        () => tcpConnect(svc.host!, svc.port!, timeout),
        timeout,
      );
      break;

    case 'http':
      result = await checkWithTimeout(
        () => httpGet(svc.host!, svc.port!, svc.path || '/', timeout),
        timeout,
      );
      break;

    case 'dns':
      result = await checkWithTimeout(
        () => dnsLookup(svc.host!),
        2000,
      );
      break;

    default:
      result = { ok: false, latencyMs: 0, error: `Unknown check type: ${svc.check}` };
  }

  return {
    name: svc.name,
    description: svc.description,
    status: result.ok ? 'healthy' : 'down',
    latencyMs: result.latencyMs,
    error: result.error,
  };
}

// ── Expand replicated services via DNS ──────────────────────────────────────

async function expandReplicas(svc: ServiceDef): Promise<HealthResult[]> {
  try {
    const ips = await dnsResolveAll(svc.host!);
    if (ips.length === 0) {
      return [{ name: svc.name, description: svc.description, status: 'down', latencyMs: 0, error: 'No replicas found' }];
    }
    // Check each replica individually via DNS (all resolved = all alive)
    const results: HealthResult[] = ips.map((ip, idx) => ({
      name: `${svc.name} #${idx + 1}`,
      description: svc.description,
      status: 'healthy' as const,
      latencyMs: 0,
    }));
    return results;
  } catch (err: any) {
    return [{ name: svc.name, description: svc.description, status: 'down', latencyMs: 0, error: err.message }];
  }
}

// ── In-memory health history store ──────────────────────────────────────────

const HISTORY_SIZE = 20; // Last 20 checks = ~5 minutes at 15s interval
const healthHistory: Map<string, { status: string; latencyMs: number; checkedAt: string }[]> = new Map();

function pushHistory(name: string, status: string, latencyMs: number) {
  let history = healthHistory.get(name);
  if (!history) {
    history = [];
    healthHistory.set(name, history);
  }
  history.push({ status, latencyMs, checkedAt: new Date().toISOString() });
  if (history.length > HISTORY_SIZE) {
    history.shift();
  }
}

function computeTelemetry(name: string) {
  const history = healthHistory.get(name);
  if (!history || history.length === 0) {
    return { uptimePercent: 0, avgLatencyMs: 0, maxLatencyMs: 0, minLatencyMs: 0, checkCount: 0 };
  }
  const healthyCount = history.filter((h) => h.status === 'healthy').length;
  const uptimePercent = Math.round((healthyCount / history.length) * 100);
  const latencies = history.map((h) => h.latencyMs).filter((l) => l > 0);
  const avgLatencyMs = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const maxLatencyMs = latencies.length > 0 ? Math.max(...latencies) : 0;
  const minLatencyMs = latencies.length > 0 ? Math.min(...latencies) : 0;
  return { uptimePercent, avgLatencyMs, maxLatencyMs, minLatencyMs, checkCount: history.length };
}

// ── Route ───────────────────────────────────────────────────────────────────

// Build a lookup from service name → ServiceDef for enriching results
const serviceDefMap = new Map<string, ServiceDef>();
for (const svc of SERVICES) {
  serviceDefMap.set(svc.name, svc);
}

router.get('/', async (_req: any, res: any) => {
  try {
    const allResults: HealthResult[] = [];

    const checks = await Promise.allSettled(
      SERVICES.map(async (svc) => {
        if (svc.check === 'dns-replicas') {
          return expandReplicas(svc);
        }
        return [await checkService(svc)];
      }),
    );

    for (let i = 0; i < checks.length; i++) {
      const result = checks[i];
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
      } else {
        allResults.push({
          name: SERVICES[i].name,
          description: SERVICES[i].description,
          status: 'down',
          latencyMs: 0,
          error: String(result.reason),
        });
      }
    }

    // Record history for telemetry
    for (const r of allResults) {
      pushHistory(r.name, r.status, r.latencyMs);
    }

    const allHealthy = allResults.every((s) => s.status === 'healthy');

    // Enrich with checkType, category, and telemetry
    const sanitized = allResults.map(({ name, description, status, latencyMs }) => {
      const def = serviceDefMap.get(name);
      // For replicas like "Worker: Decimation #1", look up the base service
      const baseName = name.replace(/ #\d+$/, '');
      const baseDef = def || serviceDefMap.get(baseName);
      return {
        name,
        description,
        status,
        latencyMs,
        checkType: baseDef?.check || 'unknown',
        category: baseDef?.category || 'core',
        telemetry: computeTelemetry(name),
      };
    });

    res.json({
      services: sanitized,
      allHealthy,
      total: allResults.length,
      healthy: allResults.filter((s) => s.status === 'healthy').length,
      checkedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('Service health check failed:', err);
    res.status(500).json({ error: 'Health check failed' });
  }
});

module.exports = router;
