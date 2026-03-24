#!/usr/bin/env node
// Seed dev-wiki article: Admin Console User Profile & Change Password
// Usage: node scripts/seed-wiki-admin-profile-password.js
//   or:  docker exec imdapps-admin-backend-1 node scripts/seed-wiki-admin-profile-password.js

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://mongodb:27017/mediastore';

const article = {
  section: 'guides',
  title: 'Admin Console — User Profile Page & Change Password (2026-03-24)',
  slug: 'admin-profile-change-password-2026-03-24',
  tags: ['admin-console', 'profile', 'change-password', 'avatar', 'keycloak', 'security', 'user-menu', 'primereact'],
  author: 'system',
  status: 'published',
  content: `# Admin Console — User Profile Page & Change Password

**Date:** 2026-03-24
**Commit:** 3a1c365
**Services affected:** admin-backend, admin-console
**Scope:** 6 files changed — 1 new backend endpoint, 2 new frontend components, 3 modified files

---

## Problem

After logging in with a temporary password, admin console users had **no way to change their password**. The top-right corner only showed a bare email address and a sign-out icon. There was no profile management UI at all, despite the backend having full profile CRUD endpoints (\`GET/PATCH /api/profile\`, avatar upload, 2FA, completeness scoring).

## Solution

### 1. Backend: \`POST /auth/change-password\` Endpoint

**File:** \`zenzers-admin-backend/src/routes/auth.ts\`

New authenticated endpoint that:
- Accepts \`{ currentPassword, newPassword, confirmPassword }\`
- Validates password complexity (8+ chars, upper, lower, number, special char)
- Verifies current password via \`getOIDCToken(email, currentPassword)\` — returns 401 if wrong
- Sets new password via \`setUserPassword(userId, newPassword)\` (Keycloak)
- Sends notification email via \`sendPasswordChanged(email)\`
- Logs \`password_changed\` event to audit trail via \`logLoginEvent()\`

**All functions already existed** — zero new backend services needed.

The endpoint is automatically authenticated because it's NOT in the \`apiAuthentication\` whitelist in \`services/auth.js\`.

### 2. Frontend: Avatar Dropdown Menu

**File:** \`zenzers-admin-console/src/layouts/AdminLayout.tsx\`

Replaced the bare email + sign-out button with a full avatar dropdown:

\`\`\`
[Avatar circle] [Name ▾]
┌─────────────────────┐
│  Daniel Shamir       │
│  daniel@blucap.ca    │
│  Admin               │
├─────────────────────┤
│  Change Password     │
│  My Profile          │
├─────────────────────┤
│  Sign Out            │
└─────────────────────┘
\`\`\`

- Avatar shows colored initials if no photo uploaded (like ToothFerry "AD" badge)
- Profile data fetched via \`GET /api/profile\` on layout mount
- Outside-click closes menu
- Breadcrumb support for \`/admin/profile\`

### 3. Frontend: Change Password Dialog

**File:** \`zenzers-admin-console/src/components/ChangePasswordDialog.tsx\`

PrimeReact Dialog with:
- Current password field
- New password field with **5 inline requirement checks** (length, upper, lower, number, special)
- Confirm password field with match validation
- Calls \`POST /auth/change-password\`
- Toast on success, error display for wrong current password

### 4. Frontend: Profile Page

**File:** \`zenzers-admin-console/src/pages/profile/AdminProfilePage.tsx\`

Full profile management page with sections:
- **Header card:** Avatar (click-to-upload), name, email, role badge, profile completeness progress bar
- **Personal info:** First/last name, phone, timezone — inline edit mode with save/cancel
- **Professional:** License number, specialty
- **Security:** Change Password button, 2FA status display
- **Account:** User ID, last login, account creation date

### 5. Frontend: API Client Methods

**File:** \`zenzers-admin-console/src/api/admin.ts\`

Added \`AdminProfile\` interface and 5 new API methods:
- \`getProfile()\` → \`GET /api/profile\`
- \`updateProfile(data)\` → \`PATCH /api/profile\`
- \`uploadAvatar(file)\` → \`POST /api/profile/avatar\` (FormData)
- \`getAvatarUrl(key)\` → URL builder for \`/api/profile/avatar/:key\`
- \`changePassword(data)\` → \`POST /auth/change-password\`

### 6. Frontend: Route Registration

**File:** \`zenzers-admin-console/src/App.tsx\`

Added lazy import and route: \`<Route path="profile" element={<AdminProfilePage />} />\`

---

## Existing Backend Endpoints Used (No Changes Needed)

| Endpoint | Purpose |
|----------|---------|
| \`GET /api/profile\` | Fetch profile + completeness score |
| \`PATCH /api/profile\` | Update profile fields |
| \`POST /api/profile/avatar\` | Upload avatar (2MB max, multer) |
| \`GET /api/profile/avatar/:key\` | Serve avatar image |
| \`POST /auth/change-password\` | **NEW** — Change password (authenticated) |

## Key Backend Functions Reused

| Function | File | Purpose |
|----------|------|---------|
| \`getOIDCToken(email, pw)\` | \`services/keycloak.ts\` | Verify current password |
| \`setUserPassword(id, pw)\` | \`services/keycloak.ts\` | Set new password in KC |
| \`getUser(email)\` | \`services/keycloak.ts\` | Look up KC user |
| \`sendPasswordChanged(email)\` | \`services/mailer.js\` | Email notification |
| \`logLoginEvent(entry)\` | \`services/login-audit.ts\` | Audit logging |

## Verification Steps

1. Log in to admin console
2. Top-right: avatar menu should appear with name and dropdown arrow
3. Click "My Profile" → profile page loads with data from \`GET /api/profile\`
4. Edit name/phone → save → verify \`PATCH /api/profile\` succeeds
5. Upload avatar → verify it displays in top-bar and profile page
6. Click "Change Password" → enter current + new → verify success toast
7. Check \`loginAuditLog\` collection for \`password_changed\` event

## Architecture Notes

- **Password verification flow:** The change-password endpoint verifies the current password by attempting a full OIDC token exchange with Keycloak (\`getOIDCToken\`). If the password is wrong, Keycloak returns \`invalid_grant\` which we catch and return as 401.
- **No new dependencies:** All backend functions (keycloak, mailer, audit) already existed. The only new code is the Express route handler and frontend components.
- **PrimeReact components used:** Dialog, Password, Button, Message, InputText, Toast, ProgressBar, Tag, Divider
`,
  createdAt: new Date(),
  updatedAt: new Date(),
};

(async () => {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const col = db.collection('devwikis');
    const existing = await col.findOne({ slug: article.slug });
    if (existing) {
      await col.updateOne({ slug: article.slug }, { $set: { ...article, updatedAt: new Date() } });
      console.log(`Updated wiki article: ${article.title}`);
    } else {
      await col.insertOne(article);
      console.log(`Inserted wiki article: ${article.title}`);
    }
  } finally {
    await client.close();
  }
})();
