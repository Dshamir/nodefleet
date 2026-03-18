#!/usr/bin/env bash
# migrate-data.sh — Export MongoDB collections from Exp_dental, import into Zenzers,
# insert hardcoded credentials into vault, and seed dev-wiki with project docs.
# Exp_dental is READ-ONLY (export only, never modify).
#
# Usage: bash migrate-data.sh
# Idempotent: safe to run multiple times (upsert mode).
set -euo pipefail

# === Config ===
SRC_CONTAINER="exp_dental-mongodb-1"
DST_CONTAINER="imdapps-mongodb-1"
SRC_URI="mongodb://mongoadmin:R48kBvqJb3E5tvzWdcbbc5GkMen7sSVqEgd2Jpvc@localhost/mediastore?authSource=admin"
DST_URI="mongodb://zenzers_root:nZYQvt3ivjXLa8VoQ3e1@localhost/mediastore?authSource=admin"
TMP_DIR="/tmp/mongo-migrate-$$"
PROJECT_ROOT="/home/x570-aorus-elite/Software-DEV/IMD APPS"

# Collections to migrate from Exp_dental
COLLECTIONS=(
  aiProviders
  aiSettings
  credentials
  customAgents
  agentSkills
  emailTemplates
  messagingConfig
  notificationConfig
  otpSettings
  otpAuditLog
  knowledgeBaseArticles
  promptTemplates
)

echo "=== Phase 2: MongoDB Collection Migration ==="
echo "Source: ${SRC_CONTAINER} → Target: ${DST_CONTAINER}"
echo ""

mkdir -p "$TMP_DIR"

for col in "${COLLECTIONS[@]}"; do
  echo -n "  Exporting ${col}... "
  docker exec "$SRC_CONTAINER" mongoexport \
    --uri="$SRC_URI" \
    --collection="$col" \
    --out="/tmp/${col}.json" \
    --quiet 2>/dev/null

  docker cp "${SRC_CONTAINER}:/tmp/${col}.json" "${TMP_DIR}/${col}.json" 2>/dev/null
  count=$(wc -l < "${TMP_DIR}/${col}.json" 2>/dev/null || echo "0")
  echo "${count} docs"

  echo -n "  Importing ${col}... "
  docker cp "${TMP_DIR}/${col}.json" "${DST_CONTAINER}:/tmp/${col}.json"
  docker exec "$DST_CONTAINER" mongoimport \
    --uri="$DST_URI" \
    --collection="$col" \
    --file="/tmp/${col}.json" \
    --mode=upsert \
    --quiet 2>/dev/null
  echo "done"
done

echo ""
echo "=== Phase 3: Insert Hardcoded Credentials into Vault ==="

# Write vault-insert script to a file (avoids shell escaping issues with $ne)
cat > "$TMP_DIR/vault-insert.js" << 'EOF'
const now = new Date();
const creds = [
  { name: 'Redis Password', type: 'password', service: 'redis', description: 'Redis cache password', valueMasked: 'Wcvq****', valueHash: 'env-sourced', createdBy: 'migrate-script' },
  { name: 'RabbitMQ Password', type: 'password', service: 'rabbitmq', description: 'RabbitMQ message broker password', valueMasked: '6LjT****', valueHash: 'env-sourced', createdBy: 'migrate-script' },
  { name: 'PostgreSQL Password', type: 'password', service: 'postgresql', description: 'PostgreSQL database password', valueMasked: 'OWwS****', valueHash: 'env-sourced', createdBy: 'migrate-script' },
  { name: 'MongoDB Root Password', type: 'password', service: 'mongodb', description: 'MongoDB root password', valueMasked: 'nZYQ****', valueHash: 'env-sourced', createdBy: 'migrate-script' },
  { name: 'Keycloak Client Secret', type: 'client-secret', service: 'keycloak', description: 'Backend auth client secret', valueMasked: 'R1hR****', valueHash: 'env-sourced', createdBy: 'migrate-script' },
  { name: 'ngrok Auth Token', type: 'api-key', service: 'ngrok', description: 'ngrok tunnel authentication token', valueMasked: '2xp5****', valueHash: 'env-sourced', createdBy: 'migrate-script' },
  { name: 'Swagger Password', type: 'password', service: 'swagger', description: 'Swagger API docs password', valueMasked: 'WEzB****', valueHash: 'env-sourced', createdBy: 'migrate-script' },
  { name: 'Keycloak Admin Password', type: 'password', service: 'keycloak', description: 'Keycloak admin console password', valueMasked: 'ifoD****', valueHash: 'env-sourced', createdBy: 'migrate-script' }
];

let inserted = 0;
for (const c of creds) {
  const exists = db.credentials.findOne({ name: c.name, service: c.service, deleted: { $ne: true } });
  if (!exists) {
    db.credentials.insertOne({ ...c, lastRotatedAt: now, expiresAt: null, createdAt: now, updatedAt: now, deleted: false });
    inserted++;
    print('  Inserted: ' + c.name);
  } else {
    print('  Skipped (exists): ' + c.name);
  }
}
print('Vault credentials inserted: ' + inserted);
EOF

docker cp "$TMP_DIR/vault-insert.js" "${DST_CONTAINER}:/tmp/vault-insert.js"
docker exec "$DST_CONTAINER" mongosh \
  -u zenzers_root -p nZYQvt3ivjXLa8VoQ3e1 \
  --authenticationDatabase admin \
  mediastore --quiet --file /tmp/vault-insert.js

echo ""
echo "=== Phase 4: Seed Dev-Wiki with Project Documentation ==="

# Use Python to generate the mongosh seed script (handles markdown escaping properly)
python3 << 'PYEOF'
import json, os, re

PROJECT_ROOT = "/home/x570-aorus-elite/Software-DEV/IMD APPS"
TMP_DIR = os.environ.get("TMP_DIR", "/tmp")

WIKI_PAGES = [
    ("START_HERE.md", "Start Here", "getting-started", 0, ["onboarding","setup"]),
    ("QUICK_REFERENCE.md", "Quick Reference", "getting-started", 1, ["reference","commands"]),
    ("QUICK_START_FOR_DUMMIES.md", "Quick Start Guide", "getting-started", 2, ["onboarding","beginner"]),
    ("README.md", "Project Overview", "getting-started", 3, ["overview","readme"]),
    ("Zenzer/toronto_gui/PRD.md", "Product Requirements Document", "architecture", 0, ["prd","requirements"]),
    ("Zenzer/toronto_gui/IMPLEMENTATION_PLAN.md", "Implementation Plan", "architecture", 1, ["planning","architecture"]),
    ("alevelsoft-med-api-7a105a6bf042/alevelsoft-med-api-7a105a6bf042/CLAUDE.md", "Medical API Architecture", "architecture", 2, ["api","medical"]),
    ("alevelsoft-med-web-0e99899af2eb/alevelsoft-med-web-0e99899af2eb/CLAUDE.md", "Medical Web Architecture", "architecture", 3, ["web","medical"]),
    ("zenzers-admin-console/CONTRIBUTING.md", "Admin Console Contributing", "architecture", 4, ["contributing","admin"]),
    ("alevelsoft-med-api-7a105a6bf042/alevelsoft-med-api-7a105a6bf042/EMAIL_CONFIGURATION.md", "Email Configuration", "api-reference", 0, ["email","smtp"]),
    ("alevelsoft-med-web-0e99899af2eb/alevelsoft-med-web-0e99899af2eb/AWS_COGNITO_SETUP_GUIDE.md", "Auth Setup Guide", "api-reference", 1, ["auth","cognito"]),
    ("alevelsoft-med-api-7a105a6bf042/alevelsoft-med-api-7a105a6bf042/PROJECT_STATUS.md", "Medical API Status", "api-reference", 2, ["status","api"]),
    ("Zenzer/toronto_gui/pyqt5_app/QUICKSTART.md", "Zenzer Device Quickstart", "guides", 0, ["zenzer","device","quickstart"]),
    ("Zenzer/toronto_gui/docs/BLUETOOTH_SETUP.md", "Bluetooth Setup", "guides", 1, ["bluetooth","hardware"]),
    ("Zenzer/toronto_gui/docs/REMOTE_BRIDGE.md", "Remote Bridge Setup", "guides", 2, ["remote","bridge"]),
    ("WSL_NETWORKING_GUIDE.md", "WSL Networking", "guides", 3, ["wsl","networking"]),
    ("HOW_TO_SEND_REAL_EMAILS.md", "Sending Real Emails", "guides", 4, ["email","smtp"]),
    ("TROUBLESHOOTING.md", "Troubleshooting Guide", "troubleshooting", 0, ["troubleshooting","debug"]),
    ("DIAGNOSTICS_PLAN.md", "Diagnostics Plan", "troubleshooting", 1, ["diagnostics","planning"]),
    ("alevelsoft-med-web-0e99899af2eb/alevelsoft-med-web-0e99899af2eb/FIX_CLIENT_SECRET_ISSUE.md", "Fix Client Secret Issue", "troubleshooting", 2, ["keycloak","auth","fix"]),
    ("DELIVERY_SUMMARY.md", "Delivery Summary", "deployment", 0, ["delivery","release"]),
    ("alevelsoft-med-web-0e99899af2eb/alevelsoft-med-web-0e99899af2eb/READY_TO_TEST.md", "Ready to Test Checklist", "deployment", 1, ["testing","checklist"]),
    ("Zenzer/toronto_gui/pyqt5_app/PHASE1_SUMMARY.md", "Phase 1 Summary", "infrastructure", 0, ["phase1","zenzer"]),
    ("alevelsoft-med-web-0e99899af2eb/alevelsoft-med-web-0e99899af2eb/PROJECT_STATUS.md", "Medical Web Status", "infrastructure", 1, ["status","web"]),
]

def slugify(title):
    s = title.lower()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')

pages = []
for filepath, title, section, sortOrder, tags in WIKI_PAGES:
    fullpath = os.path.join(PROJECT_ROOT, filepath)
    if not os.path.isfile(fullpath):
        print(f"  SKIP (not found): {filepath}")
        continue
    with open(fullpath, 'r', encoding='utf-8', errors='replace') as f:
        body = f.read()
    pages.append({
        "title": title, "slug": slugify(title), "body": body,
        "section": section, "sortOrder": sortOrder, "tags": tags,
        "author": "migrate-script"
    })

script = "const now = new Date();\nconst pages = " + json.dumps(pages, ensure_ascii=False) + ";\n"
script += """
for (const p of pages) { p.createdAt = now; p.updatedAt = now; }
let inserted = 0, updated = 0;
for (const page of pages) {
    const exists = db.devWikiPages.findOne({ slug: page.slug });
    if (!exists) { db.devWikiPages.insertOne(page); inserted++; }
    else { db.devWikiPages.updateOne({ slug: page.slug }, { $set: { ...page, updatedAt: new Date() } }); updated++; }
}
print('Dev Wiki: ' + inserted + ' inserted, ' + updated + ' updated, ' + pages.length + ' total');
"""

out_path = os.path.join(TMP_DIR, "seed-wiki.js")
with open(out_path, 'w') as f:
    f.write(script)
print(f"  Generated seed script with {len(pages)} wiki pages")
PYEOF

docker cp "$TMP_DIR/seed-wiki.js" "${DST_CONTAINER}:/tmp/seed-wiki.js"
docker exec "$DST_CONTAINER" mongosh \
  -u zenzers_root -p nZYQvt3ivjXLa8VoQ3e1 \
  --authenticationDatabase admin \
  mediastore --quiet --file /tmp/seed-wiki.js

# Cleanup
rm -rf "$TMP_DIR"

echo ""
echo "=== Migration Complete ==="
echo "Verification:"
echo "  PostgreSQL: docker compose exec postgres psql -U zenzers_postgres -d zenzers -c '\\dt app.*'"
echo "  Medical DB: docker compose exec postgres psql -U zenzers_postgres -d medical_db -c '\\dt'"
echo "  MongoDB:    docker compose exec mongodb mongosh ... mediastore --eval 'db.getCollectionNames()'"
