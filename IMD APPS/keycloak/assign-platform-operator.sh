#!/bin/bash
# Assign the platform-operator role to a Keycloak user by email
#
# Usage: bash keycloak/assign-platform-operator.sh <email>
#
# Prerequisites:
#   - Keycloak running at $KEYCLOAK_URL
#   - Admin credentials available

set -euo pipefail

EMAIL="${1:?ERROR: email argument required. Usage: $0 <email>}"
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:48080}"
REALM="${REALM:-zenzers}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?ERROR: ADMIN_PASSWORD env var is required}"
ROLE_NAME="platform-operator"

echo "==> Getting admin access token..."
TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$ADMIN_USER" \
  -d "password=$ADMIN_PASSWORD" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to get admin token"
  exit 1
fi

echo "==> Looking up user: $EMAIL"
USER_JSON=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/users?email=$EMAIL&exact=true" \
  -H "Authorization: Bearer $TOKEN")

USER_ID=$(echo "$USER_JSON" | python3 -c "import sys, json; users=json.load(sys.stdin); print(users[0]['id'] if users else '')")

if [ -z "$USER_ID" ]; then
  echo "ERROR: No user found with email '$EMAIL' in realm '$REALM'"
  exit 1
fi
echo "    Found user ID: $USER_ID"

echo "==> Looking up role: $ROLE_NAME"
ROLE_JSON=$(curl -s "$KEYCLOAK_URL/admin/realms/$REALM/roles/$ROLE_NAME" \
  -H "Authorization: Bearer $TOKEN")

ROLE_ID=$(echo "$ROLE_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))")

if [ -z "$ROLE_ID" ]; then
  echo "ERROR: Role '$ROLE_NAME' not found in realm '$REALM'"
  exit 1
fi
echo "    Found role ID: $ROLE_ID"

echo "==> Assigning $ROLE_NAME to $EMAIL..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/role-mappings/realm" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"id": "'"$ROLE_ID"'", "name": "'"$ROLE_NAME"'"}]')

if [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "==> Success! User '$EMAIL' now has role '$ROLE_NAME'"
else
  echo "ERROR: Failed to assign role (HTTP $HTTP_CODE)"
  exit 1
fi
