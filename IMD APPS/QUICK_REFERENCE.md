# Quick Reference — Zenzers 4Life Medical Platform

## Health Checks

```bash
cd ~/Software-DEV/IMD\ APPS

# All containers
docker compose ps

# Medical API (Swagger)
curl -s http://localhost:43002/api | head -1

# Admin Backend
curl -s http://localhost:43001/api/health

# Admin stats (users, vitals, records)
curl -s -H 'X-Internal-Auth: J5OhTsuXMnfeMSTwq6Bw' http://localhost:43002/admin/stats | python3 -m json.tool
```

## Test Credentials

| Email | Password | Role |
|-------|----------|------|
| `dshamir@blucap.ca` | `Test1234!` | Patient |
| `sarah.chen@test.com` | `Test1234!` | Doctor |
| `sarah.shamir@test.com` | `Test1234!` | Caregiver |
| `jake.friend@test.com` | `Test1234!` | Caregiver |
| `rachel.family@test.com` | `Test1234!` | Caregiver |

**Keycloak Admin:** `admin` / `ifoDhzPBBIO1oi87b1PT` (master realm)
**Keycloak Realm:** `zenzers` (all test users here)

## Port Map

| Port | Service |
|------|---------|
| 40080 | Nginx (reverse proxy) |
| 43001 | Admin Backend |
| 43002 | Medical API |
| 43100 | Admin Console |
| 43200 | Medical Web |
| 45432 | PostgreSQL |
| 45672 | RabbitMQ (AMQP) |
| 45673 | RabbitMQ (Management UI) |
| 46379 | Redis |
| 47017 | MongoDB |
| 48080 | Keycloak |
| 49000 | MinIO (API) |
| 49001 | MinIO (Console) |
| 44040 | ngrok dashboard |

## Rebuild After Code Changes

```bash
# Single service
docker compose build medical-api --no-cache && docker compose up -d medical-api

# Admin backend
docker compose build admin-backend --no-cache && docker compose up -d admin-backend

# Check logs
docker compose logs medical-api --tail 30
docker compose logs admin-backend --tail 30
```

## Seed Test Data

```bash
cd zenzers-admin-backend
MEDICAL_API_URL=http://localhost:43002 \
INTERNAL_SERVICES_PASSKEY=J5OhTsuXMnfeMSTwq6Bw \
DATABASE_URL='mongodb://zenzers_root:nZYQvt3ivjXLa8VoQ3e1@localhost:47017/mediastore?authSource=admin' \
node scripts/seed-medical-test-ecosystem.js
```

Creates: 5 users, 210 vitals, 4 data-access relationships, 2 diagnoses, 2 medications, 2 emergency contacts.

## Mobile App

```bash
cd alevelsoft-med-app-3cfb2823a1fe/alevelsoft-med-app-3cfb2823a1fe

# Start Metro
npx react-native start --reset-cache

# Force-stop and relaunch on emulator
adb shell am force-stop com.zenzers.medical
adb shell pm clear com.zenzers.medical
adb shell monkey -p com.zenzers.medical -c android.intent.category.LAUNCHER 1
```

## Database Access

```bash
# PostgreSQL
docker compose exec postgres psql -U zenzers_postgres -d medical_db
# Useful queries:
#   SELECT id, email, role FROM "user";
#   SELECT count(*) FROM vital;
#   SELECT * FROM patient_relationship;

# MongoDB
docker compose exec mongodb mongosh -u zenzers_root -p nZYQvt3ivjXLa8VoQ3e1 --authenticationDatabase admin mediastore
# Useful queries:
#   db.mobilePasswords.find()
#   db.administrators.find()
```

## Keycloak Admin

```bash
# Get admin token
KC_TOKEN=$(curl -s -X POST "http://localhost:48080/auth/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=admin-cli&username=admin&password=ifoDhzPBBIO1oi87b1PT" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# List users
curl -s -H "Authorization: Bearer $KC_TOKEN" \
  "http://localhost:48080/auth/admin/realms/zenzers/users?max=50" \
  | python3 -c "import sys,json; [print(u['email']) for u in json.load(sys.stdin)]"

# Reset password
KC_UID=<user-id>
curl -X PUT "http://localhost:48080/auth/admin/realms/zenzers/users/$KC_UID/reset-password" \
  -H "Authorization: Bearer $KC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"password","value":"Test1234!","temporary":false}'
```

## Internal Auth Headers

For service-to-service calls (admin-backend → medical-api):

```bash
curl -H 'X-Internal-Auth: J5OhTsuXMnfeMSTwq6Bw' http://localhost:43002/admin/patients
```

For patient-scoped calls:
```bash
curl -H 'X-Internal-Auth: J5OhTsuXMnfeMSTwq6Bw' \
     -H 'X-Internal-User-Id: <uuid>' \
     -H 'X-Internal-User-Role: Patient' \
     http://localhost:43002/patient/vitals
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Container "unhealthy" | Check logs: `docker compose logs <svc> --tail 30` — often Keycloak/SMTP non-critical |
| Medical API 500 on user create | Check `avatar` unique constraint — must be `null` not `''` |
| Mobile app spinner-of-death | Kill Metro, `--reset-cache`, force-stop app, relaunch |
| Keycloak login fails | Verify user exists in realm + `emailVerified=true` |
| "secret or public key" error | Admin-backend socket.io auth — non-blocking, ignore |
| Vitals not showing | Check thresholdsId exists: `GET /admin/thresholds/:patientId` |

---

Last Updated: 2026-03-25
