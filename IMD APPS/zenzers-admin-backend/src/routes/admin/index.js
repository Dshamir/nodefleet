const { Router } = require('express');
const { requirePlatformOperator } = require('../../middleware/admin-auth');
const { auditTrail } = require('../../middleware/audit-trail');
const { securityHeaders } = require('../../middleware/security-headers');
const logger = require('../../logging').getLogger('admin-routes');
const { getDb, ObjectId } = require('./db');

// Handle both CJS (module.exports = router) and ESM (export default router)
const load = (mod) => mod && mod.default ? mod.default : mod;

const router = Router();

// Apply security headers, admin authentication, and audit trail to all admin routes
router.use(securityHeaders);
router.use(requirePlatformOperator);
router.use(auditTrail);

logger.info('Admin routes initialized');

// --- Admin-level list routes for Users, Organizations, Administrators ---
// These bypass legacy RBAC and use requirePlatformOperator instead

router.get('/users-list', async (req, res) => {
  try {
    const database = await getDb();
    const users = await database.collection('users')
      .aggregate([
        {
          $lookup: {
            from: 'organizationMembers',
            localField: 'sub',
            foreignField: 'sub',
            as: 'memberships',
            pipeline: [
              { $lookup: { from: 'organizations', localField: 'organization', foreignField: '_id', as: 'org' } },
              { $unwind: { path: '$org', preserveNullAndEmptyArrays: true } },
              { $project: { orgId: { $toString: '$organization' }, orgName: '$org.name', role: 1, _id: 0 } },
            ],
          },
        },
        { $sort: { email: 1 } },
      ])
      .toArray();
    res.json(users.map(({ _id, ...rest }) => ({ id: _id.toString(), ...rest })));
  } catch (err) {
    logger.error('Admin users-list error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/organizations-list', async (req, res) => {
  try {
    const database = await getDb();
    const orgs = await database.collection('organizations')
      .aggregate([
        {
          $lookup: {
            from: 'organizationMembers',
            localField: '_id',
            foreignField: 'organization',
            as: 'membersList',
          },
        },
        { $addFields: { members: { $size: '$membersList' } } },
        { $unset: ['membersList'] },
        { $sort: { name: 1 } },
      ])
      .toArray();
    res.json(orgs.map(({ _id, ...rest }) => ({ id: _id.toString(), ...rest })));
  } catch (err) {
    logger.error('Admin organizations-list error:', err);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

router.get('/administrators-list', async (req, res) => {
  try {
    const database = await getDb();
    const admins = await database.collection('administrators')
      .aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'sub',
            foreignField: 'sub',
            as: 'userInfo',
          },
        },
        {
          $addFields: {
            email: {
              $ifNull: [
                '$email',
                { $arrayElemAt: ['$userInfo.email', 0] },
              ],
            },
            name: {
              $ifNull: [
                '$name',
                { $arrayElemAt: ['$userInfo.name', 0] },
              ],
            },
          },
        },
        { $unset: ['userInfo'] },
      ])
      .toArray();
    res.json(admins.map(({ _id, ...rest }) => ({ id: _id.toString(), ...rest })));
  } catch (err) {
    logger.error('Admin administrators-list error:', err);
    res.status(500).json({ error: 'Failed to fetch administrators' });
  }
});

// --- Administrator CRUD ---

router.post('/administrators', async (req, res) => {
  try {
    const { email, sub } = req.body;
    if (!email && !sub) {
      return res.status(400).json({ error: 'email or sub is required' });
    }
    const database = await getDb();

    // Resolve sub from email if only email provided
    let resolvedSub = sub;
    if (!resolvedSub && email) {
      const user = await database.collection('users').findOne({ email });
      if (!user) return res.status(404).json({ error: 'User not found with that email' });
      resolvedSub = user.sub;
    }

    // Check for duplicate
    const existing = await database.collection('administrators').findOne({ sub: resolvedSub });
    if (existing) return res.status(409).json({ error: 'Administrator already exists' });

    const doc = { sub: resolvedSub, email: email || null, addedAt: new Date() };
    const result = await database.collection('administrators').insertOne(doc);
    res.status(201).json({ id: result.insertedId.toString(), ...doc });
  } catch (err) {
    logger.error('Admin POST /administrators error:', err);
    res.status(500).json({ error: 'Failed to add administrator' });
  }
});

router.delete('/administrators/:id', async (req, res) => {
  try {
    const database = await getDb();
    const result = await database.collection('administrators').deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Administrator not found' });
    res.json({ success: true });
  } catch (err) {
    logger.error('Admin DELETE /administrators/:id error:', err);
    res.status(500).json({ error: 'Failed to remove administrator' });
  }
});

// Mount admin sub-routes
// Phase A
router.use('/dashboard', load(require('./dashboard')));
router.use('/settings', load(require('./settings')));
router.use('/audit-log', load(require('./audit-log')));
// Phase B
router.use('/ai-models', load(require('./ai-models')));
router.use('/workflows', load(require('./workflows')));
router.use('/jobs', load(require('./jobs')));
router.use('/workers', load(require('./workers')));
router.use('/feature-flags', load(require('./feature-flags')));
// Phase C
router.use('/org-types', load(require('./org-types')));
router.use('/tenants', load(require('./tenants')));
// Tenant sub-resources (org-roles and courses) are mounted under /tenants/:orgId
router.use('/tenants/:orgId/roles', load(require('./org-roles')));
router.use('/tenants/:orgId/courses', load(require('./courses')));
router.use('/cms-pages', load(require('./cms-pages')));
router.use('/auth-settings', load(require('./auth-settings')));
// router.use('/drydock', load(require('./drydock'))); // Removed: dental-specific
router.use('/rate-limits', load(require('./rate-limits')));
router.use('/content-policies', load(require('./content-policies')));
router.use('/messaging', load(require('./messaging')));
router.use('/email-templates', load(require('./email-templates')));
router.use('/credits', load(require('./credits')));
router.use('/analytics', load(require('./analytics')));
// Phase D (dental/commerce routes removed — kept only platform-applicable ones)
router.use('/pricing', load(require('./pricing')));
router.use('/refund-requests', load(require('./refund-requests')));
router.use('/support', load(require('./support')));
// Medical API proxy routes (Zenzers 4Life)
// Mount at /medical/* AND at top level for frontend compatibility
const medicalRouter = load(require('./medical'));
router.use('/medical', medicalRouter);
// Frontend expects these at /admin/medical-records, /admin/caregivers, etc.
router.use('/', medicalRouter);
// Phase E
router.use('/knowledge-base', load(require('./knowledge-base')));
router.use('/custom-agents', load(require('./custom-agents')));
router.use('/chat', load(require('./chat')));
router.use('/marketplace', load(require('./marketplace')));
router.use('/ai-settings', load(require('./ai-settings')));
router.use('/ai-providers', load(require('./ai-providers')));
router.use('/agent-skills', load(require('./agent-skills')));
// Phase C+ (Security)
router.use('/fraud-detection', load(require('./fraud-detection')));
router.use('/notifications', load(require('./notifications')));
// Phase F
router.use('/network', load(require('./network')));
router.use('/version-control', load(require('./version-control')));
router.use('/dev-wiki', load(require('./dev-wiki')));
router.use('/database', load(require('./database')));
router.use('/access-control', load(require('./access-control')));
router.use('/credentials', load(require('./credentials')));
router.use('/service-health', load(require('./service-health')));
// Phase 2: Workflow Engine
router.use('/step-registry', load(require('./step-registry')));
router.use('/workflow-templates', load(require('./workflow-templates')));
// Phase D+: Promo Codes / Discounts (removed: dental/commerce)
// router.use('/promo-codes', load(require('./promo-codes')));
// Phase 2: FDA/MDR Compliance
router.use('/device-history-records', load(require('./device-history-records')));
// Phase D+: Cart Abandonment Recovery (removed: dental/commerce)
// router.use('/cart-abandonment', load(require('./cart-abandonment')));
// Phase 3: HIPAA Data Access Audit
router.use('/data-access-log', load(require('./data-access-log')));
// i18n: Internationalization management
router.use('/i18n', load(require('./i18n')));
// SEO: Settings, sitemap config, robots preview
router.use('/seo-settings', load(require('./seo-settings')));
// Marketing Engine: Leads, Forms, Campaigns, Scoring
router.use('/lead-forms', load(require('./lead-forms')));
router.use('/leads', load(require('./leads')));
router.use('/lead-campaigns', load(require('./lead-campaigns')));
router.use('/lead-scoring', load(require('./lead-scoring')));
// Multi-Domain / White-Label
router.use('/domains', load(require('./domains')));
// Prompt Templates
router.use('/prompt-templates', load(require('./prompt-templates')));
// Repair Plans (removed: dental-specific)
// router.use('/repair-plans', load(require('./repair-plans')));
// Login Audit Log
router.use('/login-audit', load(require('./login-audit')));
// Shared Markdown Images
router.use('/markdown-images', load(require('./markdown-images')));

module.exports = router;
