#!/usr/bin/env node
/**
 * Seed Architecture DevWiki Articles + Update System Agents KB Bindings
 *
 * 1. Creates "Platform File Structure" article in DevWiki (architecture section)
 * 2. Updates live AI Repair Planner and AI Overwatch agents with architecture KB bindings
 *
 * Usage: node backend/scripts/seed-architecture-wiki.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://mongodb:27017/dental';

const PLATFORM_FILE_STRUCTURE = `# IntelliDent AI — Platform File Structure

## Backend (Node.js + Express + TypeScript)

\`\`\`
backend/
├── src/
│   ├── routes/
│   │   ├── admin/           # 65+ admin API route files
│   │   │   ├── db.ts        # Shared MongoDB connection
│   │   │   ├── index.js     # Route mounting
│   │   │   ├── support.ts   # Support tickets + AI overwatch/repair
│   │   │   ├── custom-agents.ts
│   │   │   ├── knowledge-base.ts
│   │   │   ├── dev-wiki.ts
│   │   │   ├── chat.ts
│   │   │   ├── workflows.ts
│   │   │   ├── jobs.ts
│   │   │   ├── credentials.ts
│   │   │   ├── shop.ts
│   │   │   ├── orders.ts
│   │   │   ├── pricing.ts
│   │   │   ├── tenants.ts
│   │   │   ├── drydock.ts
│   │   │   └── ... (65 total)
│   │   └── api/             # Public API routes
│   ├── services/            # Business logic (80+ files)
│   │   ├── database.js      # MongoDB connection (NOT model files)
│   │   ├── agent-executor.ts # Custom agent execution + RAG
│   │   ├── skill-executor.ts # Agent skill resolution
│   │   ├── llm-client.ts    # Multi-vendor LLM client
│   │   ├── abac.ts          # Attribute-based access control
│   │   ├── mailer.js        # SMTP email delivery
│   │   ├── mediastore.js    # MinIO/S3 file storage
│   │   ├── messagequeue.js  # RabbitMQ client
│   │   ├── redis.js         # Redis cache client
│   │   └── ...
│   ├── logging/
│   └── utils/
├── scripts/                 # One-off migration/seed scripts
└── package.json
\`\`\`

**IMPORTANT:** There are NO model files. All MongoDB access is through \`services/database.js\` using the native driver.

## Admin Console (React 19 SPA)

\`\`\`
admin-console/
├── src/
│   ├── pages/               # 56+ page modules
│   │   ├── dashboard/DashboardPage.tsx
│   │   ├── support/SupportPage.tsx
│   │   ├── custom-agents/CustomAgentsPage.tsx
│   │   ├── knowledge-base/KnowledgeBasePage.tsx
│   │   ├── dev-wiki/DevWikiPage.tsx
│   │   ├── chat/ChatPage.tsx
│   │   ├── workflows/WorkflowsPage.tsx
│   │   ├── credentials/CredentialsPage.tsx
│   │   ├── shop/ShopPage.tsx
│   │   ├── orders/OrdersPage.tsx
│   │   ├── tenants/TenantsPage.tsx
│   │   ├── drydock/DrydockPage.tsx
│   │   └── ... (56 total)
│   ├── api/
│   │   ├── admin.ts         # Admin API client (2000+ LOC)
│   │   └── client.ts        # Axios instance
│   ├── store/               # Zustand stores
│   ├── components/          # Shared UI components
│   └── App.tsx              # Route definitions
└── package.json
\`\`\`

**Pattern:** Each page lives at \`pages/<name>/<NamePage>.tsx\`. Never at \`pages/<NamePage>.tsx\`.

## Frontend (React 19 SPA — Patient/User Facing)

\`\`\`
front-end/
├── src/
│   ├── components/          # 40+ React components
│   ├── pages/
│   ├── stores/
│   └── App.tsx
└── package.json
\`\`\`

## Workers (Python + Celery)

\`\`\`
worker/
├── app/
│   ├── tasks.py             # Celery task definitions (ALL task types)
│   ├── worker.py            # Worker entry point
│   ├── celery_app.py        # Celery configuration
│   ├── decimation.py / decimation_logic.py
│   ├── segmentation.py / segmentation_logic.py
│   ├── crowngeneration.py / crowngeneration_logic.py
│   ├── marginline.py / marginline_logic.py
│   └── utils.py / meshutils.py
└── requirements.txt
\`\`\`

**IMPORTANT:** Task file is \`worker/app/tasks.py\`, NOT \`workers/tasks/\` or \`worker/tasks.py\`.

## AI Engines (Docker containers)

\`\`\`
engines/
├── decimation-engine/       # Mesh decimation
├── segmentation-engine/     # Tooth segmentation (GPU)
├── crown-generation-engine/ # Crown generation (GPU)
├── marginline-engine/       # Margin line detection (GPU)
├── undercut-detection/      # Preparation undercut analysis
├── thickness-interactive/   # Crown thickness evaluation
├── mock-decimation-engine/  # Mock for testing
├── mock-segmentation-engine/
└── mock-crown-engine/
\`\`\`

## Device & Gateway Emulators

\`\`\`
packages/
├── zenzer-device-emulator/    # Simulates N virtual BLE wristbands over WebSocket
│   └── src/
│       ├── index.ts           # WS server entry point
│       ├── device-manager.ts  # Creates N devices with patient profiles
│       ├── vitals-generator.ts# Circadian rhythm + Gaussian noise + abnormal episodes
│       ├── ws-server.ts       # /scan, /device/:id, /health endpoints
│       ├── ble-protocol.ts    # Real BLE characteristic UUIDs + byte encoding
│       └── patient-profiles.ts# 5 profiles (healthy, elderly, COPD, etc.)
├── rpi-gateway-emulator/      # Emulates RPi gateway: auth, collect, submit
│   └── src/
│       ├── index.ts           # Orchestration: seed → auth → connect → submit loop
│       ├── seed.ts            # Creates gateway + patient users (Keycloak + DB + Mongo)
│       ├── auth.ts            # JWT authentication as Gateway role
│       ├── device-connector.ts# WS client to device emulator
│       ├── vitals-submitter.ts# Batches POSTs to /gateway/vitals every 10s
│       └── websocket-publisher.ts # socket.io to /ws/current-vitals
└── shared-ui/                 # Shared React components
\`\`\`

## Infrastructure

\`\`\`
docker-compose.yml           # 25+ services (production + emulators)
docker-compose.override.yml  # Local/ngrok overrides (NOT committed)
nginx/
├── nginx.conf               # Production Nginx
└── nginx.local.conf         # Local/ngrok Nginx
dev.sh                       # CLI: build, rebuild, restart, logs, shell, down, health, status
.env                         # All credentials (NOT committed)
\`\`\`

## Key Collections (MongoDB)

| Collection | Purpose |
|-----------|---------|
| users | User accounts (patients, dentists, labs) |
| projects | 3D scan projects |
| supportTickets | Support tickets with AI analysis |
| customAgents | AI agent configurations |
| knowledgeBaseArticles | KB articles for RAG |
| devWikiPages | Developer wiki (72+ articles) |
| agentSkills | Agent skill definitions |
| aiProviders | LLM provider configs |
| credentials | Credential vault entries |
| featureFlags | Feature toggles |
| orders | Product orders |
| organizations | Multi-tenant orgs |
`;

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  const now = new Date();

  // ── 1. Seed "Platform File Structure" DevWiki article ──────────────
  const existingArticle = await db.collection('devWikiPages').findOne({
    slug: 'platform-file-structure',
    deleted: { $ne: true },
  });

  if (!existingArticle) {
    await db.collection('devWikiPages').insertOne({
      title: 'Platform File Structure',
      slug: 'platform-file-structure',
      body: PLATFORM_FILE_STRUCTURE,
      section: 'architecture',
      sortOrder: 1,
      author: 'System',
      tags: ['architecture', 'file-structure', 'reference'],
      deleted: false,
      createdAt: now,
      updatedAt: now,
      createdBy: 'seed-script',
    });
    console.log('Created "Platform File Structure" DevWiki article');
  } else {
    // Update body if it already exists
    await db.collection('devWikiPages').updateOne(
      { _id: existingArticle._id },
      { $set: { body: PLATFORM_FILE_STRUCTURE, updatedAt: now } },
    );
    console.log('Updated "Platform File Structure" DevWiki article');
  }

  // ── 2. Update AI Repair Planner agent KB bindings ──────────────────
  const repairAgent = await db.collection('customAgents').findOne({
    tags: 'repair-plan',
    deleted: { $ne: true },
  });

  if (repairAgent) {
    const updates = {
      knowledgeBaseCategories: ['architecture', 'infrastructure'],
      updatedAt: now,
    };
    // Also update system prompt if it lacks grounding instructions
    if (!repairAgent.systemPrompt?.includes('Never guess file paths')) {
      updates.systemPrompt = repairAgent.systemPrompt + `

IMPORTANT: Always reference Knowledge Base and DevWiki articles for actual file paths.
Never guess file paths. The codebase does NOT follow standard MVC patterns:
- Routes: backend/src/routes/admin/*.ts (not controllers/)
- No model files — MongoDB via services/database.js
- Admin pages: admin-console/src/pages/<name>/<NamePage>.tsx
- Workers: worker/app/tasks.py (not workers/tasks/)
- Frontend: front-end/src/ (not client/ or src/)
- Config: docker-compose.yml, nginx/nginx.conf
- Scripts: backend/scripts/*.js`;
    }
    await db.collection('customAgents').updateOne(
      { _id: repairAgent._id },
      { $set: updates },
    );
    console.log(`Updated AI Repair Planner: knowledgeBaseCategories → ['architecture', 'infrastructure']`);
  } else {
    console.log('AI Repair Planner agent not found — run seed-system-agents.js first');
  }

  // ── 3. Update AI Overwatch agent KB bindings ───────────────────────
  const overwatchAgent = await db.collection('customAgents').findOne({
    tags: 'ai-overwatch',
    deleted: { $ne: true },
  });

  if (overwatchAgent) {
    const updates = {
      knowledgeBaseCategories: ['architecture'],
      updatedAt: now,
    };
    if (!overwatchAgent.systemPrompt?.includes('Reference actual file paths')) {
      updates.systemPrompt = overwatchAgent.systemPrompt + `

IMPORTANT: Reference actual file paths from DevWiki architecture articles.
The codebase uses non-standard paths:
- Routes: backend/src/routes/admin/*.ts
- Admin pages: admin-console/src/pages/<name>/<NamePage>.tsx
- Workers: worker/app/tasks.py
- Frontend: front-end/src/`;
    }
    await db.collection('customAgents').updateOne(
      { _id: overwatchAgent._id },
      { $set: updates },
    );
    console.log(`Updated AI Overwatch: knowledgeBaseCategories → ['architecture']`);
  } else {
    console.log('AI Overwatch agent not found — run seed-system-agents.js first');
  }

  await client.close();
  console.log('Architecture wiki seed complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
