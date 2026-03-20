#!/bin/bash
# Seed test users for all roles in Keycloak AND PostgreSQL (medical_db)
#
# Creates:
#   patient@test.local   / Test1234!  → patient role
#   doctor@test.local    / Test1234!  → doctor role
#   caregiver@test.local / Test1234!  → caregiver role
#
# Usage: bash keycloak/seed-test-users.sh
#
# Prerequisites:
#   - Docker Compose stack running (keycloak + postgres)
#   - .env loaded (or env vars set)

set -euo pipefail

# Load .env if present
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a; source "$SCRIPT_DIR/.env"; set +a
fi

# KEYCLOAK_URL from .env is the Docker-internal URL; override for host access
KEYCLOAK_URL="${KEYCLOAK_HOST_URL:-http://localhost:48080}"
REALM="${KEYCLOAK_REALM:-zenzers}"
ADMIN_USER="${KEYCLOAK_ADMIN_USER:-admin}"
ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:?ERROR: KEYCLOAK_ADMIN_PASSWORD not set}"
PG_USER="${POSTGRES_USER:-zenzers_postgres}"
PG_PASSWORD="${POSTGRES_PASSWORD:?ERROR: POSTGRES_PASSWORD not set}"
PG_CONTAINER="imdapps-postgres-1"
PG_DB="medical_db"
PASSWORD="Test1234!"

echo "=== Seed Test Users ==="
echo "    Keycloak: $KEYCLOAK_URL"
echo "    Realm:    $REALM"
echo ""

# ── Step 1: Get Keycloak admin token ──────────────────────────────────
echo "==> Getting admin access token..."
TOKEN=$(curl -sf -X POST "$KEYCLOAK_URL/auth/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$ADMIN_USER" \
  -d "password=$ADMIN_PASSWORD" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to get admin token. Is Keycloak running?"
  exit 1
fi
echo "    Token acquired."

# ── Helper: create user in Keycloak ──────────────────────────────────
create_kc_user() {
  local EMAIL="$1"
  local FIRST="$2"
  local LAST="$3"
  local ROLE="$4"

  echo ""
  echo "==> Creating Keycloak user: $EMAIL (role: $ROLE)"

  # Check if user already exists
  EXISTING=$(curl -sf "$KEYCLOAK_URL/auth/admin/realms/$REALM/users?email=$EMAIL&exact=true" \
    -H "Authorization: Bearer $TOKEN" | python3 -c "import sys, json; users=json.load(sys.stdin); print(users[0]['id'] if users else '')" 2>/dev/null || echo "")

  if [ -n "$EXISTING" ]; then
    echo "    User already exists: $EXISTING"
    echo "$EXISTING"
    return
  fi

  # Create user
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$KEYCLOAK_URL/auth/admin/realms/$REALM/users" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "'"$EMAIL"'",
      "username": "'"$EMAIL"'",
      "firstName": "'"$FIRST"'",
      "lastName": "'"$LAST"'",
      "emailVerified": true,
      "enabled": true
    }')

  if [ "$HTTP_CODE" != "201" ] && [ "$HTTP_CODE" != "409" ]; then
    echo "    WARNING: Create user returned HTTP $HTTP_CODE"
  fi

  # Get the user ID
  USER_ID=$(curl -sf "$KEYCLOAK_URL/auth/admin/realms/$REALM/users?email=$EMAIL&exact=true" \
    -H "Authorization: Bearer $TOKEN" | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['id'])")

  echo "    Created: $USER_ID"

  # Set password
  curl -sf -X PUT "$KEYCLOAK_URL/auth/admin/realms/$REALM/users/$USER_ID/reset-password" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "type": "password",
      "value": "'"$PASSWORD"'",
      "temporary": false
    }'
  echo "    Password set."

  # Assign realm role
  ROLE_JSON=$(curl -sf "$KEYCLOAK_URL/auth/admin/realms/$REALM/roles/$ROLE" \
    -H "Authorization: Bearer $TOKEN")

  curl -sf -X POST "$KEYCLOAK_URL/auth/admin/realms/$REALM/users/$USER_ID/role-mappings/realm" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "[$ROLE_JSON]"
  echo "    Role '$ROLE' assigned."

  echo "$USER_ID"
}

# ── Step 2: Create all 3 users in Keycloak ───────────────────────────
PATIENT_ID=$(create_kc_user "patient@test.local" "Test" "Patient" "patient")
DOCTOR_ID=$(create_kc_user "doctor@test.local" "Test" "Doctor" "doctor")
CAREGIVER_ID=$(create_kc_user "caregiver@test.local" "Test" "Caregiver" "caregiver")

# Extract just the UUID (last line of output)
PATIENT_ID=$(echo "$PATIENT_ID" | tail -1)
DOCTOR_ID=$(echo "$DOCTOR_ID" | tail -1)
CAREGIVER_ID=$(echo "$CAREGIVER_ID" | tail -1)

echo ""
echo "==> Keycloak user IDs:"
echo "    Patient:   $PATIENT_ID"
echo "    Doctor:    $DOCTOR_ID"
echo "    Caregiver: $CAREGIVER_ID"

# ── Step 3: Seed PostgreSQL medical_db ────────────────────────────────
echo ""
echo "==> Seeding PostgreSQL (medical_db)..."

NOW_UNIX=$(date +%s)

PSQL="docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DB -v ON_ERROR_STOP=1"

# Upsert users one at a time for reliability
for ROW in \
  "$PATIENT_ID|patient@test.local|Test|Patient|+15551110001|Patient|Patient" \
  "$DOCTOR_ID|doctor@test.local|Test|Doctor|+15551110002|Doctor|Doctor" \
  "$CAREGIVER_ID|caregiver@test.local|Test|Caregiver|+15551110003|Caregiver|CaregiverProfessional"; do
  IFS='|' read -r USERID UEMAIL UFIRST ULAST UPHONE UROLE ULABEL <<< "$ROW"
  $PSQL -c "INSERT INTO \"user\" (id, email, first_name, last_name, phone, role, role_label, password_updated_at, measurement_system) VALUES ('$USERID', '$UEMAIL', '$UFIRST', '$ULAST', '$UPHONE', '$UROLE', '$ULABEL', $NOW_UNIX, 'Metric') ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name;"
  echo "    Upserted $UEMAIL ($UROLE)"
done

# Role-specific metadata
$PSQL -c "INSERT INTO patient_metadata (user_id, dob, gender, height_cm, weight_kg, height_in, weight_lb) VALUES ('$PATIENT_ID', '1990-01-15', 'Male', 175, 80, 69, 176) ON CONFLICT (user_id) DO NOTHING;"
$PSQL -c "INSERT INTO doctor_metadata (user_id, institution, specialty) VALUES ('$DOCTOR_ID', 'Test Hospital', 'General Medicine') ON CONFLICT (user_id) DO NOTHING;"
$PSQL -c "INSERT INTO caregiver_metadata (user_id, institution) VALUES ('$CAREGIVER_ID', 'Test Care Facility') ON CONFLICT (user_id) DO NOTHING;"

# Emergency contact for patient
$PSQL -c "INSERT INTO person_emergency_contact (user_id, first_name, last_name, email, phone, relationship, rank) SELECT '$PATIENT_ID', 'Emergency', 'Contact', 'emergency@test.local', '+15559990001', 'Friends&Family', 1 WHERE NOT EXISTS (SELECT 1 FROM person_emergency_contact WHERE user_id = '$PATIENT_ID');"

# Default vital thresholds for patient
$PSQL -c "INSERT INTO patient_vital_thresholds (patient_user_id, min_hr, max_hr, min_temp, max_temp, min_spo2, min_rr, max_rr, min_dbp, max_dbp, min_sbp, max_sbp, min_map, max_map) SELECT '$PATIENT_ID', 60, 100, 96.0, 99.5, 95, 12, 20, 60, 80, 90, 120, 70, 100 WHERE NOT EXISTS (SELECT 1 FROM patient_vital_thresholds WHERE patient_user_id = '$PATIENT_ID');"

echo "    PostgreSQL seeding complete."

# ── Step 4: Summary ──────────────────────────────────────────────────
echo ""
echo "=== Seed Complete ==="
echo ""
echo "  ┌──────────────────────────┬──────────────┬───────────┐"
echo "  │ Email                    │ Password     │ Role      │"
echo "  ├──────────────────────────┼──────────────┼───────────┤"
echo "  │ patient@test.local       │ Test1234!    │ Patient   │"
echo "  │ doctor@test.local        │ Test1234!    │ Doctor    │"
echo "  │ caregiver@test.local     │ Test1234!    │ Caregiver │"
echo "  └──────────────────────────┴──────────────┴───────────┘"
echo ""
echo "  Sign in at: https://zenzer.ngrok.dev/sign-in"
echo ""
