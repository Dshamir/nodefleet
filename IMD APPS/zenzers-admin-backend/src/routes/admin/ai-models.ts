import { Router, Request, Response } from 'express';

const { getDb, ObjectId } = require('./db');
const { getTags } = require('../../services/workerversions');
const { cacheSet, cacheDel } = require('../../services/redis');
const { escapeRegex } = require('../../utils/sanitize');
const logger = require('../../logging').getLogger('admin-ai-models');

const router = Router();

/**
 * GET /api/admin/ai-models
 * List all AI models with optional filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const database = await getDb();
    const { status, engineType, search } = req.query;

    const query: any = { deleted: { $ne: true } };
    if (status) query.status = status;
    if (engineType) query.engineType = engineType;
    if (search) {
      query.$or = [
        { name: { $regex: escapeRegex(search as string), $options: 'i' } },
        { description: { $regex: escapeRegex(search as string), $options: 'i' } },
        { engineType: { $regex: escapeRegex(search as string), $options: 'i' } },
      ];
    }

    const models = await database.collection('aiModels')
      .find(query)
      .sort({ updatedAt: -1 })
      .toArray();

    res.json({
      data: models.map(({ _id, ...rest }: any) => ({ id: _id.toString(), ...rest })),
      total: models.length,
    });
  } catch (err) {
    logger.error('List AI models error:', err);
    res.status(500).json({ error: 'Failed to fetch AI models' });
  }
});

/**
 * GET /api/admin/ai-models/docker-tags
 * Get available Docker image tags from the local Docker daemon
 */
router.get('/docker-tags', async (_req: Request, res: Response) => {
  try {
    const tags = await getTags();
    res.json({ data: tags });
  } catch (err) {
    // Docker socket not available in this deployment — return empty list gracefully
    res.json({ data: [] });
  }
});

/**
 * GET /api/admin/ai-models/:id
 * Get a single AI model by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const database = await getDb();
    const model = await database.collection('aiModels').findOne({
      _id: new ObjectId(req.params.id),
      deleted: { $ne: true },
    });

    if (!model) {
      return res.status(404).json({ error: 'AI model not found' });
    }

    const { _id, ...rest } = model;
    res.json({ id: _id.toString(), ...rest });
  } catch (err) {
    logger.error('Get AI model error:', err);
    res.status(500).json({ error: 'Failed to fetch AI model' });
  }
});

/**
 * POST /api/admin/ai-models
 * Create a new AI model
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const database = await getDb();
    const { name, engineType, description, dockerImage, config: modelConfig } = req.body;

    if (!name || !engineType) {
      return res.status(400).json({ error: 'name and engineType are required' });
    }

    // Check for duplicate name
    const existing = await database.collection('aiModels').findOne({
      name,
      deleted: { $ne: true },
    });
    if (existing) {
      return res.status(409).json({ error: 'An AI model with this name already exists' });
    }

    const now = new Date();
    const user = req.user as any;

    const model = {
      name,
      engineType,
      description: description || '',
      dockerImage: dockerImage || '',
      config: modelConfig || {},
      status: 'inactive' as const,
      versions: [],
      activeVersion: null,
      createdAt: now,
      updatedAt: now,
      createdBy: user?.sub || 'unknown',
    };

    const result = await database.collection('aiModels').insertOne(model);
    logger.info(`AI model created: ${name} (${engineType}) by ${user?.sub}`);

    res.status(201).json({ id: result.insertedId.toString(), ...model });
  } catch (err) {
    logger.error('Create AI model error:', err);
    res.status(500).json({ error: 'Failed to create AI model' });
  }
});

/**
 * PATCH /api/admin/ai-models/:id
 * Update an AI model
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const database = await getDb();
    const allowedFields = ['name', 'description', 'dockerImage', 'config', 'status', 'engineType', 'resourceLimits'];
    const patch: any = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        patch[field] = req.body[field];
      }
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    patch.updatedAt = new Date();

    const result = await database.collection('aiModels').updateOne(
      { _id: new ObjectId(req.params.id), deleted: { $ne: true } },
      { $set: patch },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'AI model not found' });
    }

    // Sync resourceLimits to Redis for worker consumption
    if (patch.resourceLimits) {
      try {
        const updated = await database.collection('aiModels').findOne({ _id: new ObjectId(req.params.id) });
        if (updated?.engineType) {
          await cacheSet(`model:limits:${updated.engineType}`, patch.resourceLimits, 86400);
        }
      } catch (syncErr) {
        logger.warn(`Failed to sync resourceLimits to Redis: ${syncErr}`);
      }
    }

    logger.info(`AI model updated: ${req.params.id} by ${(req.user as any)?.sub}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('Update AI model error:', err);
    res.status(500).json({ error: 'Failed to update AI model' });
  }
});

/**
 * DELETE /api/admin/ai-models/:id
 * Soft-delete an AI model
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const database = await getDb();
    const result = await database.collection('aiModels').updateOne(
      { _id: new ObjectId(req.params.id), deleted: { $ne: true } },
      { $set: { deleted: true, deletedAt: new Date(), status: 'inactive' } },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'AI model not found' });
    }

    logger.info(`AI model deleted: ${req.params.id} by ${(req.user as any)?.sub}`);
    res.status(204).send();
  } catch (err) {
    logger.error('Delete AI model error:', err);
    res.status(500).json({ error: 'Failed to delete AI model' });
  }
});

/**
 * POST /api/admin/ai-models/:id/versions
 * Add a version to an AI model
 */
router.post('/:id/versions', async (req: Request, res: Response) => {
  try {
    const database = await getDb();
    const { tag, config: versionConfig } = req.body;

    if (!tag) {
      return res.status(400).json({ error: 'tag is required' });
    }

    const model = await database.collection('aiModels').findOne({
      _id: new ObjectId(req.params.id),
      deleted: { $ne: true },
    });

    if (!model) {
      return res.status(404).json({ error: 'AI model not found' });
    }

    // Check for duplicate version tag
    if (model.versions?.some((v: any) => v.tag === tag)) {
      return res.status(409).json({ error: `Version ${tag} already exists` });
    }

    const now = new Date();
    const version = {
      tag,
      status: 'inactive' as const,
      config: versionConfig || {},
      createdAt: now,
    };

    await database.collection('aiModels').updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $push: { versions: version },
        $set: { updatedAt: now },
      },
    );

    logger.info(`Version ${tag} added to AI model ${req.params.id}`);
    res.status(201).json(version);
  } catch (err) {
    logger.error('Add version error:', err);
    res.status(500).json({ error: 'Failed to add version' });
  }
});

/**
 * POST /api/admin/ai-models/:id/activate-version
 * Activate a specific version of an AI model
 */
router.post('/:id/activate-version', async (req: Request, res: Response) => {
  try {
    const database = await getDb();
    const { tag } = req.body;

    if (!tag) {
      return res.status(400).json({ error: 'tag is required' });
    }

    const model = await database.collection('aiModels').findOne({
      _id: new ObjectId(req.params.id),
      deleted: { $ne: true },
    });

    if (!model) {
      return res.status(404).json({ error: 'AI model not found' });
    }

    const versionExists = model.versions?.some((v: any) => v.tag === tag);
    if (!versionExists) {
      return res.status(404).json({ error: `Version ${tag} not found` });
    }

    const now = new Date();

    // Deactivate all versions, then activate the target
    await database.collection('aiModels').updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          'versions.$[].status': 'inactive',
          activeVersion: tag,
          status: 'active',
          updatedAt: now,
        },
      },
    );

    await database.collection('aiModels').updateOne(
      { _id: new ObjectId(req.params.id), 'versions.tag': tag },
      {
        $set: {
          'versions.$.status': 'active',
          'versions.$.activatedAt': now,
        },
      },
    );

    // Also update the system settings for the corresponding worker version
    if (model.engineType) {
      await database.collection('systemSettings').updateOne(
        {},
        { $set: { [`defaultWorkerVersions.${model.engineType}`]: tag } },
        { upsert: true },
      );
    }

    logger.info(`Version ${tag} activated for AI model ${req.params.id}`);
    res.json({ success: true, activeVersion: tag });
  } catch (err) {
    logger.error('Activate version error:', err);
    res.status(500).json({ error: 'Failed to activate version' });
  }
});

module.exports = router;
