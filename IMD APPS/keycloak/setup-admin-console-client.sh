#!/bin/bash
# Setup script for Zenzers 4Life Keycloak clients and roles
# Run this once after Keycloak is up
#
# Usage: bash keycloak/setup-admin-console-client.sh
#
# Prerequisites:
#   - Keycloak running at $KEYCLOAK_URL
#   - Admin credentials available

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
REALM="${REALM:-zenzers}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?ERROR: ADMIN_PASSWORD env var is required}"
ADMIN_CLIENT_ID="admin-console-client"
MEDICAL_CLIENT_ID="medical-app-client"
ADMIN_REDIRECT_URI="${ADMIN_REDIRECT_URI:-http://localhost/admin/*}"
MEDICAL_REDIRECT_URI="${MEDICAL_REDIRECT_URI:-http://localhost/*}"
MEDICAL_REDIRECT_URIS='["http://localhost/*","https://zenzer.ngrok.dev/*"]'

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

echo "==> Creating realm '$REALM'..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "realm": "'$REALM'",
    "enabled": true,
    "registrationAllowed": true,
    "registrationEmailAsUsername": true,
    "verifyEmail": true,
    "loginWithEmailAllowed": true,
    "duplicateEmailsAllowed": false,
    "resetPasswordAllowed": true,
    "editUsernameAllowed": false,
    "bruteForceProtected": true
  }'

echo ""
echo "==> Creating admin-console-client..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "'$ADMIN_CLIENT_ID'",
    "name": "Zenzers 4Life Admin Console",
    "description": "Admin console for platform operators",
    "enabled": true,
    "publicClient": true,
    "directAccessGrantsEnabled": false,
    "standardFlowEnabled": true,
    "implicitFlowEnabled": false,
    "rootUrl": "'"${ADMIN_REDIRECT_URI%/*}"'",
    "redirectUris": ["'$ADMIN_REDIRECT_URI'"],
    "webOrigins": ["+"],
    "protocol": "openid-connect",
    "attributes": {
      "pkce.code.challenge.method": "S256",
      "post.logout.redirect.uris": "+"
    }
  }'

echo ""
echo "==> Creating medical-app-client..."
curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "'$MEDICAL_CLIENT_ID'",
    "name": "Zenzers 4Life Medical App",
    "description": "Public SPA client for patient/doctor web and mobile apps",
    "enabled": true,
    "publicClient": true,
    "directAccessGrantsEnabled": true,
    "standardFlowEnabled": true,
    "implicitFlowEnabled": false,
    "rootUrl": "'"${MEDICAL_REDIRECT_URI%/*}"'",
    "redirectUris": '$MEDICAL_REDIRECT_URIS',
    "webOrigins": ["+"],
    "protocol": "openid-connect",
    "attributes": {
      "pkce.code.challenge.method": "S256",
      "post.logout.redirect.uris": "+"
    }
  }'

echo ""
echo "==> Creating realm roles..."
for ROLE in platform-operator patient doctor caregiver gateway; do
  echo "    Creating role: $ROLE"
  curl -s -X POST "$KEYCLOAK_URL/admin/realms/$REALM/roles" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "'$ROLE'",
      "description": "'$ROLE' role for Zenzers 4Life platform",
      "composite": false
    }'
done

echo ""
echo "==> Done!"
echo "    Realm: $REALM"
echo "    Admin client: $ADMIN_CLIENT_ID (redirect: $ADMIN_REDIRECT_URI)"
echo "    Medical client: $MEDICAL_CLIENT_ID (redirect: $MEDICAL_REDIRECT_URI)"
echo "    Roles: platform-operator, patient, doctor, caregiver, gateway"
echo ""
echo "    Assign 'platform-operator' to admin users via Keycloak admin UI."
