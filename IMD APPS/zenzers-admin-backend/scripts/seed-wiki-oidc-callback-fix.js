#!/usr/bin/env node
/**
 * Seed Dev Wiki: OIDC Callback "Page not found" — Root Cause & Fix
 * Run: node zenzers-admin-backend/scripts/seed-wiki-oidc-callback-fix.js
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://mongodb:27017/dental';

const article = {
  section: 'troubleshooting',
  title: 'OIDC Callback "Page not found" — Nginx Routing Conflict Fix',
  slug: 'oidc-callback-page-not-found',
  tags: ['auth', 'keycloak', 'nginx', 'oidc', 'troubleshooting', 'medical-web'],
  author: 'system',
  status: 'published',
  content: `# OIDC Callback "Page not found" — Nginx Routing Conflict Fix

After logging in via Keycloak, the medical-web frontend redirects to \`/auth/callback?state=...&code=...\` and gets a **"Page not found"** error. The admin console (\`/admin/\`) works fine. This blocks all patient/doctor access to the medical-web frontend.

**Date fixed:** 2026-03-20

---

## Root Cause 1: Nginx Routing Conflict (PRIMARY)

The nginx config at \`nginx/nginx.conf\` had:

\`\`\`nginx
location /auth/ {
    proxy_pass  http://keycloak:8080;
}
\`\`\`

This intercepted **ALL** \`/auth/*\` requests and proxied them to Keycloak. But \`/auth/callback\` is a **React Router route** in the medical-web SPA — it needs to reach the SPA's \`index.html\`, not Keycloak. Keycloak doesn't serve \`/auth/callback\`, so it returns "Page not found".

**Broken flow:**
\`\`\`
Browser → /auth/callback → nginx → keycloak:8080 → 404 "Page not found"
\`\`\`

**Fixed flow:**
\`\`\`
Browser → /auth/callback → nginx → medical-web:80 → index.html → React Router → AuthCallback
\`\`\`

### Fix

Added an **exact-match** location block for \`/auth/callback\` BEFORE the \`/auth/\` prefix block in \`nginx/nginx.conf\`. Nginx processes exact matches (\`=\`) before prefix matches:

\`\`\`nginx
# OIDC callback — must reach the React SPA, not Keycloak
location = /auth/callback {
    proxy_pass  http://$medical_web:80;
}

# Keycloak SSO (KC_HTTP_RELATIVE_PATH=/auth)
location /auth/ {
    proxy_pass  http://$keycloak:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
\`\`\`

The medical-web's internal nginx has \`try_files $uri $uri/ /index.html =404\` which serves \`index.html\` for unknown paths, allowing React Router to handle \`/auth/callback\` and invoke the \`AuthCallback\` component.

---

## Root Cause 2: Keycloak Redirect URI Mismatch (SECONDARY)

The Keycloak \`medical-app-client\` only had \`http://localhost/*\` as an allowed redirect URI. When accessed via \`https://zenzer.ngrok.dev\`, Keycloak would reject the redirect.

### Fix

Updated \`keycloak/setup-admin-console-client.sh\` to include both localhost and ngrok redirect URIs:

\`\`\`bash
MEDICAL_REDIRECT_URIS='["http://localhost/*","https://zenzer.ngrok.dev/*"]'
\`\`\`

Also patched the **live Keycloak** instance via admin API to add the ngrok URI immediately.

---

## Key Concept: Nginx Location Block Priority

Nginx processes location blocks in this priority order:

1. **Exact match** \`location = /path\` — highest priority
2. **Preferential prefix** \`location ^~ /path/\`
3. **Regex** \`location ~ regex\`
4. **Prefix** \`location /path/\` — lowest priority

By using \`location = /auth/callback\`, the SPA callback is matched before the \`location /auth/\` prefix block routes it to Keycloak.

---

## Verification Checklist

1. \`/auth/callback\` → HTTP 200 (medical-web SPA serves index.html)
2. \`/auth/realms/zenzers/...\` → HTTP 200 (Keycloak still handles auth paths)
3. \`/auth/admin/\` → Keycloak admin UI still accessible
4. \`/admin/\` → Admin console still works
5. Full login flow: \`/\` → Keycloak login → \`/auth/callback\` → authenticated home page

---

## Related Files

| File | Purpose |
|------|---------|
| \`nginx/nginx.conf:47-52\` | Nginx routing — exact match for callback + prefix for Keycloak |
| \`keycloak/setup-admin-console-client.sh\` | Client registration with redirect URIs |
| \`alevelsoft-med-web-*/src/services/keycloak-auth.service.ts\` | OIDC config with \`redirect_uri: \${origin}/auth/callback\` |
| \`alevelsoft-med-web-*/src/pages/Auth/AuthCallback.tsx\` | React callback handler component |
| \`alevelsoft-med-web-*/docker/nginx.conf\` | SPA nginx with \`try_files\` fallback to index.html |
`,
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const col = db.collection('devWikiPages');

    const { createdAt, ...updateFields } = article;
    const result = await col.updateOne(
      { slug: article.slug },
      { $set: updateFields, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    if (result.upsertedCount) {
      console.log(`Created wiki article: "${article.title}"`);
    } else {
      console.log(`Updated wiki article: "${article.title}"`);
    }
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
