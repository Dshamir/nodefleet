# Zenzers 4Life — Unified Medical Platform
**Last Updated:** 2026-03-25
**Status:** Development — Unified Docker Compose Stack

---

## Quick Start

```bash
cd ~/Software-DEV/IMD\ APPS

# Start all services
docker compose up -d

# Check health
docker compose ps

# Seed test data (first time only)
cd zenzers-admin-backend
MEDICAL_API_URL=http://localhost:43002 \
INTERNAL_SERVICES_PASSKEY=J5OhTsuXMnfeMSTwq6Bw \
DATABASE_URL='mongodb://zenzers_root:nZYQvt3ivjXLa8VoQ3e1@localhost:47017/mediastore?authSource=admin' \
node scripts/seed-medical-test-ecosystem.js

# Start mobile app (React Native)
cd ../alevelsoft-med-app-3cfb2823a1fe/alevelsoft-med-app-3cfb2823a1fe
npx react-native start --reset-cache
```

---

## Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Admin Console | http://localhost:43100 | React admin dashboard |
| Admin Backend | http://localhost:43001 | Express.js API + proxy |
| Medical API | http://localhost:43002 | NestJS REST API |
| Medical API Docs | http://localhost:43002/api | Swagger UI |
| Medical Web | http://localhost:43200 | Patient/Doctor web app |
| Keycloak | http://localhost:48080 | Identity provider |
| Keycloak (public) | https://zenzer.ngrok.dev/auth | Via ngrok tunnel |
| MongoDB | localhost:47017 | Document store |
| PostgreSQL | localhost:45432 | Relational DB (medical_db) |
| Redis | localhost:46379 | Cache |
| RabbitMQ | localhost:45672 (AMQP) / 45673 (UI) | Message queue |
| MinIO | http://localhost:49000 (API) / 49001 (UI) | Object storage |
| ngrok | http://localhost:44040 | Tunnel dashboard |
| Nginx | http://localhost:40080 | Reverse proxy |

---

## Test Users

All users authenticate via **Keycloak** (realm: `zenzers`) and exist in **PostgreSQL** (`medical_db`).
Mobile app passwords are also stored in **MongoDB** (`mobilePasswords` collection).

| Email | Password | Role | Notes |
|-------|----------|------|-------|
| `dshamir@blucap.ca` | `Test1234!` | Patient | Primary test patient — has vitals, diagnoses, medications |
| `sarah.chen@test.com` | `Test1234!` | Doctor | Cardiologist — has data access to Daniel |
| `sarah.shamir@test.com` | `Test1234!` | Caregiver (Family) | Daniel's wife — has data access |
| `jake.friend@test.com` | `Test1234!` | Caregiver (Friend) | Has data access to Daniel |
| `rachel.family@test.com` | `Test1234!` | Caregiver (Family) | Has data access to Daniel |
| `admin@zenzers4life.com` | *(Keycloak admin set)* | Admin | Admin console user |

### Seeded Data (for dshamir@blucap.ca)

- 210 vital readings (7 days, 30/day) — HR, SpO2, temp, RR, BP
- 2 diagnoses: Hypertension, Pre-diabetes
- 2 medications: Lisinopril 10mg QD, Metformin 500mg BID
- 4 data-access relationships (doctor + 3 caregivers)
- 2 emergency contacts (person + organization)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     ngrok tunnel                         │
│              zenzer.ngrok.dev → nginx:80                 │
├─────────────────────────────────────────────────────────┤
│                   nginx (reverse proxy)                  │
│   /         → admin-console:3000                         │
│   /api      → admin-backend:3001                         │
│   /med-api  → medical-api:3002                           │
│   /auth     → keycloak:8080                              │
├─────────────────────────────────────────────────────────┤
│  admin-console    admin-backend    medical-api           │
│  (React 19)       (Express.js)     (NestJS)              │
│   :43100           :43001           :43002               │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL   MongoDB   Redis   RabbitMQ   MinIO         │
│   :45432       :47017   :46379   :45672     :49000       │
└─────────────────────────────────────────────────────────┘

Mobile App (React Native) → admin-backend :43001/api/mobile/*
                           → proxied to medical-api :3002/*
```

### Internal Auth (Service-to-Service)

Admin-backend proxies mobile app requests to medical-api using:
```
X-Internal-Auth: $INTERNAL_SERVICES_PASSKEY
X-Internal-User-Id: <user-uuid>
X-Internal-User-Role: Patient|Doctor|Caregiver
```

This bypasses Keycloak JWT validation for internal service calls.

---

## Key Directories

| Directory | Description |
|-----------|-------------|
| `alevelsoft-med-api-7a105a6bf042/` | Medical API (NestJS) — vitals, users, diagnoses |
| `alevelsoft-med-web-0e99899af2eb/` | Medical Web (React 18 + Vite) — patient/doctor portal |
| `alevelsoft-med-app-3cfb2823a1fe/` | Mobile App (React Native) — patient vitals app |
| `zenzers-admin-backend/` | Admin Backend (Express.js) — proxy, admin API, MongoDB |
| `zenzers-admin-console/` | Admin Console (React 19 + Vite) — admin dashboard |
| `keycloak/` | Keycloak Dockerfile customizations |
| `nginx/` | Nginx reverse proxy config |
| `mongodb/` | MongoDB init scripts |
| `postgresql/` | PostgreSQL init scripts (creates medical_db) |

---

## Common Operations

### Rebuild a service after code changes
```bash
docker compose build <service> --no-cache
docker compose up -d <service>
docker compose logs <service> --tail 30
```

### Run seed script
```bash
cd zenzers-admin-backend
MEDICAL_API_URL=http://localhost:43002 \
INTERNAL_SERVICES_PASSKEY=J5OhTsuXMnfeMSTwq6Bw \
DATABASE_URL='mongodb://zenzers_root:nZYQvt3ivjXLa8VoQ3e1@localhost:47017/mediastore?authSource=admin' \
node scripts/seed-medical-test-ecosystem.js
```

### Create a Keycloak user
```bash
# Get admin token
KC_TOKEN=$(curl -s -X POST "http://localhost:48080/auth/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=admin-cli&username=admin&password=ifoDhzPBBIO1oi87b1PT" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Create user
curl -X POST "http://localhost:48080/auth/admin/realms/zenzers/users" \
  -H "Authorization: Bearer $KC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"user@example.com","email":"user@example.com","firstName":"First","lastName":"Last","enabled":true,"emailVerified":true}'
```

### Access PostgreSQL directly
```bash
docker compose exec postgres psql -U zenzers_postgres -d medical_db
```

### Access MongoDB directly
```bash
docker compose exec mongodb mongosh -u zenzers_root -p nZYQvt3ivjXLa8VoQ3e1 --authenticationDatabase admin mediastore
```

---

## Admin API Endpoints (Medical API)

All require `X-Internal-Auth` header.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/users` | Create user with role-specific metadata |
| GET | `/admin/patients` | List patients |
| GET | `/admin/patients/:id` | Patient detail + latest vitals |
| GET | `/admin/doctors` | List doctors |
| GET | `/admin/caregivers` | List caregivers |
| GET | `/admin/vitals/active` | Patients with vitals in last 24h |
| GET | `/admin/vitals/:patientId` | Vitals for a patient |
| POST | `/admin/vitals/bulk` | Bulk insert vitals (for seeding) |
| GET | `/admin/thresholds/:patientId` | Vital thresholds for a patient |
| GET | `/admin/medical-records` | Diagnoses and medications |
| GET | `/admin/emergency-contacts` | Emergency contacts |
| GET | `/admin/data-access` | Data access relationships |
| POST | `/admin/data-access` | Create data access relationship |
| GET | `/admin/gateways` | Gateway devices |
| GET | `/admin/stats` | Dashboard statistics |
| PUT | `/admin/users/:id` | Update user |
| DELETE | `/admin/users/:id` | Soft-delete user |

---

Last Updated: 2026-03-25
