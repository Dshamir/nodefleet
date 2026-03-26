#!/usr/bin/env node
/**
 * Seed Dev Wiki: Metro Bundler + Error Boundary — Fix White-Screen Crash
 * Run: docker compose exec admin-backend node scripts/seed-wiki-metro-error-boundary.js
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://mongodb:27017/dental';

const articles = [
  {
    section: 'troubleshooting',
    title: 'Fix White-Screen Crash — Metro Bundler + Error Boundary (2026-03-26)',
    slug: 'metro-error-boundary-2026-03-26',
    tags: ['metro', 'react-native', 'error-boundary', 'white-screen', 'crash', 'dev.sh', 'mobile-app'],
    author: 'system',
    status: 'published',
    content: `# Fix White-Screen Crash — Metro Bundler + Error Boundary

**Date:** 2026-03-26
**Files modified:** \`dev.sh\`, \`Wrapper.tsx\`, new \`ErrorBoundary.tsx\`
**Root cause:** Metro bundler (port 8081) not running — RN app can't load JS bundle

---

## Problem

After the provenance commit, the mobile app crashes to a **white screen with grey header** on the Android emulator. The React Native app was built in debug mode but Metro bundler was killed, so the JS bundle couldn't load.

## Fix 1: \`./dev.sh metro\` command

Added a \`metro\` subcommand to the dev orchestrator so Metro bundler can be started with a single command:

\`\`\`bash
./dev.sh metro    # Starts Metro bundler for React Native mobile app
\`\`\`

Implementation in \`dev.sh\`:
- Resolves app dir: \`alevelsoft-med-app-3cfb2823a1fe/alevelsoft-med-app-3cfb2823a1fe\`
- Runs \`npx react-native start\` from the app root
- Shows port info (default: 8081)

## Fix 2: ErrorBoundary component

Created \`src/screens/wrapper/ErrorBoundary.tsx\` — a React class component error boundary that catches render errors and shows a user-friendly "Something went wrong — Retry" screen instead of blank white death.

**How it works:**
- \`Wrapper.tsx\` renamed inner component to \`WrapperInner\`
- \`Wrapper\` now wraps \`WrapperInner\` in \`<ErrorBoundary>\`
- On error: shows error message + retry button
- On retry: clears error state and re-renders children

## Verification

| Test | Expected |
|------|----------|
| Kill Metro → open app | Error screen with Retry button (not white screen) |
| Start Metro → tap Retry | App reloads normally |
| \`./dev.sh metro\` | Metro bundler starts on port 8081 |
| \`./dev.sh --help\` | Shows metro in command list |
`,
  },
];

async function seed() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const col = db.collection('devWikiPages');

    for (const article of articles) {
      const now = new Date();
      await col.updateOne(
        { slug: article.slug },
        {
          $set: {
            ...article,
            body: article.content,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
            createdBy: 'system',
            editHistory: [],
            deleted: false,
            sortOrder: 0,
          },
        },
        { upsert: true },
      );
      console.log(`  + ${article.title}`);
    }

    console.log('Done. Wiki article seeded.');
  } finally {
    await client.close();
  }
}

seed().catch(console.error);
