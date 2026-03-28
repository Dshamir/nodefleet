#!/usr/bin/env bash
set -euo pipefail

# ── NodeFleet — Platform Orchestrator ─────────────────────────────────────────
# Full lifecycle management for the NodeFleet Device Fleet Management Platform.
# Usage: ./nodefleet.sh [command] [options]

# ── Colors ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ── Resolve project root ────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Read version + git info ─────────────────────────────────────────────────
APP_VERSION="$(cat version.txt 2>/dev/null || echo 'unknown')"
GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
GIT_MESSAGE="$(git log -1 --format=%s 2>/dev/null || echo '')"
DEPLOY_USER="$(git config user.email 2>/dev/null || echo 'system')"

export APP_VERSION GIT_COMMIT GIT_BRANCH GIT_MESSAGE DEPLOY_USER

# ── Constants ───────────────────────────────────────────────────────────────
BOX_W=66
NGROK_URL="https://nodefleet.ngrok.dev"
APP_SERVICES=(web ws-server nginx)

# ── Help ────────────────────────────────────────────────────────────────────
print_help() {
  cat <<'HELPEOF'
NodeFleet — Platform Orchestrator

Usage: ./nodefleet.sh [command] [options]

Commands:
  (no args)                  Build, start all, wait for health, show status
  --all                      Rebuild ALL services (including infra)
  --status                   Show container status table only
  rebuild <svc> [svc...]     Hot-rebuild + recreate specific service(s)
  restart <svc> [svc...]     Restart service(s) without rebuild
  logs [svc...]              Tail service logs
  shell <svc>                Open shell in container
  down                       Stop all containers (volumes preserved)
  health                     Probe all service health endpoints
  bump [patch|minor|major]   Bump version, sync, auto-commit
  tunnel                     Show ngrok tunnel status & URL
  setup                      Bootstrap .env from .env.example
  simulate [--pair CODE]     Run device simulator (no hardware needed)
  compile                    Compile ESP32 firmware only (no flash)
  flash                      Compile + flash ESP32 firmware via PlatformIO
  mqtt                       Show MQTT broker status + test publish
  db [sql]                   Run SQL query against PostgreSQL
  migrate                    Create/verify all database tables
  -h, --help                 Show this help

Services: web, ws-server, nginx, postgres, redis, minio, mqtt, ngrok

Examples:
  ./nodefleet.sh                            # Full build + start + health check
  ./nodefleet.sh setup                      # Bootstrap .env
  ./nodefleet.sh rebuild web                # Hot-rebuild web only
  ./nodefleet.sh rebuild web nginx          # Rebuild multiple services
  ./nodefleet.sh restart ws-server          # Restart without rebuild
  ./nodefleet.sh logs ws-server             # Follow ws-server logs
  ./nodefleet.sh shell web                  # Shell into web container
  ./nodefleet.sh health                     # Check all service endpoints
  ./nodefleet.sh bump                       # Bump patch version (0.1.0 → 0.1.1)
  ./nodefleet.sh bump minor                 # Bump minor version (0.1.1 → 0.2.0)
  ./nodefleet.sh tunnel                     # Show ngrok tunnel info
  ./nodefleet.sh simulate --pair ABC123     # Run device simulator
  ./nodefleet.sh flash                      # Compile + flash ESP32
  ./nodefleet.sh mqtt                       # MQTT broker status
  ./nodefleet.sh db "SELECT count(*) FROM devices"  # Run SQL
  ./nodefleet.sh down                       # Stop everything
HELPEOF
  exit 0
}

# ── Parse args ──────────────────────────────────────────────────────────────
MODE="default"
SERVICES=()

case "${1:-}" in
  rebuild|restart|logs|shell|down|health|bump|tunnel|setup|simulate|compile|flash|mqtt|db|migrate)
    MODE="$1"; shift; SERVICES=("$@") ;;
  -h|--help)
    print_help ;;
  "")
    MODE="default" ;;
  *)
    for arg in "$@"; do
      case "$arg" in
        --all)    MODE="all" ;;
        --status) MODE="status" ;;
        -h|--help) print_help ;;
        *) echo -e "${RED}Unknown argument: $arg${RESET}"; echo "Run ./nodefleet.sh --help for usage."; exit 1 ;;
      esac
    done
    ;;
esac

# ── Validate service names ─────────────────────────────────────────────────
validate_services() {
  local valid_services
  valid_services=$(docker compose config --services 2>/dev/null)
  for svc in "$@"; do
    if ! echo "$valid_services" | grep -qx "$svc"; then
      echo -e "${RED}Error: '$svc' is not a valid service.${RESET}"
      echo ""
      echo "Available services:"
      echo "$valid_services" | sort | sed 's/^/  /'
      exit 1
    fi
  done
}

# ── Header ──────────────────────────────────────────────────────────────────
pad_line() {
  local text="$1"
  local len=${#text}
  local pad=$((BOX_W - len))
  [ $pad -lt 0 ] && pad=0
  printf "${BOLD}${CYAN}║${RESET}%s%*s${BOLD}${CYAN}║${RESET}\n" "$text" "$pad" ""
}

print_header() {
  echo ""
  echo -e "${BOLD}${CYAN}╔$(printf '═%.0s' $(seq 1 $BOX_W))╗${RESET}"
  pad_line "  NodeFleet — Device Fleet Management Platform"
  pad_line "  v${APP_VERSION} @ ${GIT_COMMIT} (${GIT_BRANCH})"
  echo -e "${BOLD}${CYAN}╚$(printf '═%.0s' $(seq 1 $BOX_W))╝${RESET}"
  echo ""
}

# ── .env Bootstrap (setup command) ──────────────────────────────────────────
do_setup() {
  if [ -f .env ]; then
    echo -e "${YELLOW}⚠ .env already exists.${RESET}"
    read -rp "Overwrite with fresh values? [y/N] " confirm
    if [[ ! "$confirm" =~ ^[yY]$ ]]; then
      echo -e "${DIM}  Keeping existing .env${RESET}"
      return
    fi
  fi

  if [ ! -f .env.example ]; then
    echo -e "${RED}Error: .env.example not found.${RESET}"
    exit 1
  fi

  echo -e "${BLUE}▸ Bootstrapping .env from .env.example...${RESET}"
  cp .env.example .env

  # Generate a random NEXTAUTH_SECRET and sync DEVICE_TOKEN_SECRET
  local secret
  secret=$(openssl rand -base64 32 | tr -d '/+=' | head -c 40)
  sed -i "s|NEXTAUTH_SECRET=change-me-in-production|NEXTAUTH_SECRET=${secret}|" .env
  sed -i "s|DEVICE_TOKEN_SECRET=change-me-in-production|DEVICE_TOKEN_SECRET=${secret}|" .env

  echo -e "${GREEN}✓ .env created${RESET}"
  echo ""
  echo -e "  ${DIM}NEXTAUTH_SECRET generated automatically${RESET}"
  echo ""
  echo -e "${YELLOW}  Review .env and update these for production:${RESET}"
  echo -e "${YELLOW}    - NEXTAUTH_SECRET (auto-generated, but rotate for prod)${RESET}"
  echo -e "${YELLOW}    - STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET${RESET}"
  echo -e "${YELLOW}    - NGROK_AUTHTOKEN (pre-configured for nodefleet.ngrok.dev)${RESET}"
  echo -e "${YELLOW}    - MinIO credentials (minioadmin/minioadmin)${RESET}"
  echo -e "${YELLOW}    - PostgreSQL credentials${RESET}"
  echo ""
}

# ── Build phase ─────────────────────────────────────────────────────────────
do_build() {
  if [ "$MODE" = "all" ]; then
    echo -e "${BLUE}▸ Rebuilding ALL services...${RESET}"
    docker compose build \
      --build-arg GIT_COMMIT="$GIT_COMMIT" \
      --build-arg GIT_BRANCH="$GIT_BRANCH" \
      --build-arg APP_VERSION="$APP_VERSION" \
      --build-arg GIT_MESSAGE="$GIT_MESSAGE"
  else
    echo -e "${BLUE}▸ Building app services: ${APP_SERVICES[*]}...${RESET}"
    docker compose build \
      --build-arg GIT_COMMIT="$GIT_COMMIT" \
      --build-arg GIT_BRANCH="$GIT_BRANCH" \
      --build-arg APP_VERSION="$APP_VERSION" \
      --build-arg GIT_MESSAGE="$GIT_MESSAGE" \
      "${APP_SERVICES[@]}"
  fi
  echo -e "${GREEN}✓ Build complete${RESET}"
  echo ""
}

# ── Bring up ────────────────────────────────────────────────────────────────
do_up() {
  echo -e "${BLUE}▸ Starting all services...${RESET}"
  docker compose up -d
  echo -e "${GREEN}✓ Services started${RESET}"
  echo ""
}

# ── Wait for services health ────────────────────────────────────────────────
wait_for_services() {
  local max_wait elapsed

  # Stage 1: PostgreSQL
  echo -e "${YELLOW}▸ Waiting for PostgreSQL...${RESET}"
  max_wait=60; elapsed=0
  while [ $elapsed -lt $max_wait ]; do
    if docker compose exec -T postgres pg_isready -U nodefleet >/dev/null 2>&1; then
      echo -e "${GREEN}  ✓ PostgreSQL ready${RESET}"
      break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo -ne "\r${DIM}    ${elapsed}s / ${max_wait}s${RESET}  "
  done
  [ $elapsed -ge $max_wait ] && echo -e "\n${YELLOW}  ⚠ PostgreSQL timeout — continuing${RESET}"
  echo ""

  # Stage 2: Redis
  echo -e "${YELLOW}▸ Waiting for Redis...${RESET}"
  max_wait=30; elapsed=0
  while [ $elapsed -lt $max_wait ]; do
    if docker compose exec -T redis redis-cli ping >/dev/null 2>&1; then
      echo -e "${GREEN}  ✓ Redis ready${RESET}"
      break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo -ne "\r${DIM}    ${elapsed}s / ${max_wait}s${RESET}  "
  done
  [ $elapsed -ge $max_wait ] && echo -e "\n${YELLOW}  ⚠ Redis timeout — continuing${RESET}"
  echo ""

  # Stage 3: MinIO
  echo -e "${YELLOW}▸ Waiting for MinIO...${RESET}"
  max_wait=30; elapsed=0
  while [ $elapsed -lt $max_wait ]; do
    if curl -sf http://localhost:50900/minio/health/live >/dev/null 2>&1; then
      echo -e "${GREEN}  ✓ MinIO ready${RESET}"
      break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo -ne "\r${DIM}    ${elapsed}s / ${max_wait}s${RESET}  "
  done
  [ $elapsed -ge $max_wait ] && echo -e "\n${YELLOW}  ⚠ MinIO timeout — continuing${RESET}"
  echo ""

  # Stage 4: WebSocket Server
  echo -e "${YELLOW}▸ Waiting for WebSocket Server...${RESET}"
  max_wait=60; elapsed=0
  while [ $elapsed -lt $max_wait ]; do
    if curl -sf http://localhost:50081/health >/dev/null 2>&1; then
      echo -e "${GREEN}  ✓ WebSocket Server ready${RESET}"
      break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo -ne "\r${DIM}    ${elapsed}s / ${max_wait}s${RESET}  "
  done
  [ $elapsed -ge $max_wait ] && echo -e "\n${YELLOW}  ⚠ WebSocket Server timeout — continuing${RESET}"
  echo ""

  # Stage 5: Web (Next.js)
  echo -e "${YELLOW}▸ Waiting for Web (Next.js)...${RESET}"
  max_wait=90; elapsed=0
  while [ $elapsed -lt $max_wait ]; do
    if curl -sf http://localhost:50300/api/health >/dev/null 2>&1; then
      echo -e "${GREEN}  ✓ Web ready${RESET}"
      break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo -ne "\r${DIM}    ${elapsed}s / ${max_wait}s${RESET}  "
  done
  [ $elapsed -ge $max_wait ] && echo -e "\n${YELLOW}  ⚠ Web timeout — continuing${RESET}"
  echo ""

  # Stage 6: MQTT Broker
  echo -e "${YELLOW}▸ Waiting for MQTT Broker...${RESET}"
  max_wait=30; elapsed=0
  while [ $elapsed -lt $max_wait ]; do
    if docker compose exec -T mqtt mosquitto_sub -t '$SYS/#' -C 1 -W 2 >/dev/null 2>&1; then
      echo -e "${GREEN}  ✓ MQTT Broker ready${RESET}"
      break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo -ne "\r${DIM}    ${elapsed}s / ${max_wait}s${RESET}  "
  done
  [ $elapsed -ge $max_wait ] && echo -e "\n${YELLOW}  ⚠ MQTT Broker timeout — continuing${RESET}"
  echo ""

  # Stage 7: Nginx
  echo -e "${YELLOW}▸ Waiting for Nginx...${RESET}"
  max_wait=30; elapsed=0
  while [ $elapsed -lt $max_wait ]; do
    if curl -sf http://localhost:50080/health >/dev/null 2>&1; then
      echo -e "${GREEN}  ✓ Nginx ready${RESET}"
      break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo -ne "\r${DIM}    ${elapsed}s / ${max_wait}s${RESET}  "
  done
  [ $elapsed -ge $max_wait ] && echo -e "\n${YELLOW}  ⚠ Nginx timeout — continuing${RESET}"
  echo ""

  # Stage 8: Verify MinIO bucket exists
  echo -e "${YELLOW}▸ Verifying MinIO bucket...${RESET}"
  docker compose exec -T minio sh -c "
    mc alias set local http://localhost:9000 minioadmin minioadmin 2>/dev/null;
    mc mb local/nodefleet-media --ignore-existing 2>/dev/null
  " >/dev/null 2>&1
  echo -e "${GREEN}  ✓ MinIO bucket 'nodefleet-media' ready${RESET}"
  echo ""

  # Stage 9: Verify database tables
  echo -e "${YELLOW}▸ Verifying database schema...${RESET}"
  local missing_tables=0
  for tbl in devices telemetry_records gps_records device_commands media_files audit_logs device_settings alert_rules webhooks; do
    if ! docker compose exec -T postgres psql -U nodefleet -d nodefleet -tAc "SELECT 1 FROM information_schema.tables WHERE table_name='$tbl'" 2>/dev/null | grep -q 1; then
      echo -e "  ${YELLOW}⚠ Missing table: $tbl${RESET}"
      missing_tables=$((missing_tables + 1))
    fi
  done
  if [ $missing_tables -eq 0 ]; then
    echo -e "${GREEN}  ✓ All 9 required tables present${RESET}"
  else
    echo -e "${YELLOW}  ⚠ $missing_tables table(s) missing — run database migrations${RESET}"
  fi
  echo ""
}

# ── Status table ────────────────────────────────────────────────────────────
print_status() {
  local bar
  bar=$(printf '═%.0s' $(seq 1 $BOX_W))

  echo -e "${BOLD}${CYAN}╔${bar}╗${RESET}"
  pad_line "  NodeFleet — Platform Status (v${APP_VERSION} @ ${GIT_COMMIT})"
  echo -e "${BOLD}${CYAN}╠${bar}╣${RESET}"
  printf "${BOLD}${CYAN}║${RESET}  ${BOLD}%-24s %-12s %-26s${RESET}${BOLD}${CYAN}║${RESET}\n" "SERVICE" "STATUS" "UPTIME"
  pad_line "  $(printf '─%.0s' $(seq 1 $((BOX_W - 4))))"

  local running=0
  local total=0

  while IFS=$'\t' read -r svc_name status_text; do
    [ -z "$svc_name" ] && continue

    local state uptime health_info
    state=$(echo "$status_text" | grep -oP '(Up|Exited|Restarting|Created)' | head -1 || true)
    uptime=$(echo "$status_text" | grep -oP '(?:Up )\K[^(]+' | head -1 | sed 's/[[:space:]]*$//' || true)
    health_info=""
    if echo "$status_text" | grep -q "(healthy)"; then
      health_info=" (healthy)"
    elif echo "$status_text" | grep -q "(unhealthy)"; then
      health_info=" (unhealthy)"
    fi

    total=$((total + 1))

    local icon color
    if [ "$state" = "Up" ]; then
      icon="●"
      color="${GREEN}"
      running=$((running + 1))
    elif [ "$state" = "Restarting" ]; then
      icon="◐"
      color="${YELLOW}"
    else
      icon="○"
      color="${RED}"
      uptime="—"
    fi

    local row_text
    row_text=$(printf "  %s %-22s %-12s %s" "X" "$svc_name" "$state" "${uptime}${health_info}")
    local row_len=${#row_text}
    local row_pad=$((BOX_W - row_len))
    [ $row_pad -lt 0 ] && row_pad=0

    printf "${BOLD}${CYAN}║${RESET}  ${color}%s${RESET} ${color}%-22s${RESET} %-12s %s%*s${BOLD}${CYAN}║${RESET}\n" \
      "$icon" "$svc_name" "$state" "${uptime}${health_info}" "$row_pad" ""
  done < <(docker compose ps --format "{{.Service}}\t{{.Status}}" 2>/dev/null)

  echo -e "${BOLD}${CYAN}╚${bar}╝${RESET}"

  # Summary
  if [ $running -eq $total ] && [ $total -gt 0 ]; then
    echo -e "  ${GREEN}${BOLD}${running}/${total} services running${RESET}"
  else
    echo -e "  ${YELLOW}${BOLD}${running}/${total} services running${RESET}"
  fi

  # ngrok URL
  local ngrok_url=""
  ngrok_url=$(curl -sf http://localhost:50040/api/tunnels 2>/dev/null | grep -oP '"public_url"\s*:\s*"\K[^"]+' | head -1 || true)

  echo ""
  echo -e "  ${BOLD}URLs:${RESET}"
  echo -e "    Dashboard:      ${CYAN}http://localhost:50080${RESET}"
  echo -e "    Direct Next.js: ${CYAN}http://localhost:50300${RESET}"
  echo -e "    WebSocket:      ${CYAN}ws://localhost:50081/device${RESET}"
  echo -e "    MQTT Broker:    ${CYAN}mqtt://localhost:51883${RESET}"
  echo -e "    MQTT WebSocket: ${CYAN}ws://localhost:59001${RESET}"
  echo -e "    MinIO Console:  ${CYAN}http://localhost:50901${RESET}"
  echo -e "    PostgreSQL:     ${CYAN}localhost:50432${RESET}"
  echo -e "    Redis:          ${CYAN}localhost:50379${RESET}"
  if [ -n "$ngrok_url" ]; then
    echo ""
    echo -e "    ${BOLD}${GREEN}ngrok Tunnel:  ${ngrok_url}${RESET}"
  else
    echo -e "    ngrok Tunnel:  ${DIM}(not connected)${RESET}"
  fi
  echo ""
}

# ── Rebuild command ─────────────────────────────────────────────────────────
do_rebuild() {
  if [ ${#SERVICES[@]} -eq 0 ]; then
    echo -e "${RED}Error: 'rebuild' requires at least one service name.${RESET}"
    echo "Usage: ./nodefleet.sh rebuild <svc> [svc...]"
    exit 1
  fi
  validate_services "${SERVICES[@]}"

  echo -e "${BLUE}▸ Rebuilding: ${SERVICES[*]}...${RESET}"
  docker compose build "${SERVICES[@]}"
  echo -e "${GREEN}✓ Build complete${RESET}"
  echo ""

  echo -e "${BLUE}▸ Recreating: ${SERVICES[*]}...${RESET}"
  docker compose up -d --no-deps "${SERVICES[@]}"
  echo -e "${GREEN}✓ Services recreated${RESET}"
  echo ""

  print_status
}

# ── Restart command ─────────────────────────────────────────────────────────
do_restart() {
  if [ ${#SERVICES[@]} -eq 0 ]; then
    echo -e "${RED}Error: 'restart' requires at least one service name.${RESET}"
    echo "Usage: ./nodefleet.sh restart <svc> [svc...]"
    exit 1
  fi
  validate_services "${SERVICES[@]}"

  echo -e "${BLUE}▸ Restarting: ${SERVICES[*]}...${RESET}"
  docker compose restart "${SERVICES[@]}"
  echo -e "${GREEN}✓ Services restarted${RESET}"
  echo ""

  print_status
}

# ── Logs command ────────────────────────────────────────────────────────────
do_logs() {
  if [ ${#SERVICES[@]} -gt 0 ]; then
    validate_services "${SERVICES[@]}"
    echo -e "${BLUE}▸ Tailing logs for: ${SERVICES[*]}${RESET}"
    docker compose logs -f --tail 100 "${SERVICES[@]}"
  else
    echo -e "${BLUE}▸ Tailing logs for all services${RESET}"
    docker compose logs -f --tail 100
  fi
}

# ── Shell command ───────────────────────────────────────────────────────────
do_shell() {
  if [ ${#SERVICES[@]} -ne 1 ]; then
    echo -e "${RED}Error: 'shell' requires exactly one service name.${RESET}"
    echo "Usage: ./nodefleet.sh shell <svc>"
    exit 1
  fi
  validate_services "${SERVICES[@]}"
  local svc="${SERVICES[0]}"

  echo -e "${BLUE}▸ Opening shell in ${svc}...${RESET}"
  docker compose exec "$svc" bash 2>/dev/null || docker compose exec "$svc" sh
}

# ── Down command ────────────────────────────────────────────────────────────
do_down() {
  echo -e "${BLUE}▸ Stopping and removing all containers (volumes preserved)...${RESET}"
  docker compose down
  echo -e "${GREEN}✓ All containers removed${RESET}"
}

# ── Health probe ────────────────────────────────────────────────────────────
do_health() {
  echo -e "${BOLD}Service Health Probe${RESET}"
  echo -e "${DIM}  Probes via nginx + host-mapped ports${RESET}"
  echo ""

  local pass=0
  local fail=0

  probe_http() {
    local name="$1"
    local url="$2"
    local http_code
    http_code=$(curl -so /dev/null --max-time 5 -w '%{http_code}' "$url" 2>/dev/null || echo "000")
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 500 ] 2>/dev/null; then
      echo -e "  ${GREEN}●${RESET} ${name}  ${DIM}(${http_code})${RESET}"
      pass=$((pass + 1))
    else
      echo -e "  ${RED}○${RESET} ${name}  ${DIM}(${http_code})${RESET}"
      fail=$((fail + 1))
    fi
  }

  probe_container() {
    local name="$1"
    local svc="$2"
    if docker compose exec -T "$svc" sh -c "true" >/dev/null 2>&1; then
      echo -e "  ${GREEN}●${RESET} ${name}"
      pass=$((pass + 1))
    else
      echo -e "  ${RED}○${RESET} ${name}"
      fail=$((fail + 1))
    fi
  }

  # ── Core ──
  echo -e "  ${BOLD}Core${RESET}"
  probe_http "web             → :50300/api/health"      "http://localhost:50300/api/health"
  probe_http "ws-server       → :50081/health"           "http://localhost:50081/health"
  probe_http "nginx           → :50080/health"            "http://localhost:50080/health"

  # ── Storage ──
  echo -e "  ${BOLD}Storage${RESET}"
  probe_http "minio           → :50900/minio/health/live" "http://localhost:50900/minio/health/live"

  # ── Data ──
  echo -e "  ${BOLD}Data${RESET}"
  probe_container "postgres        → container alive"  "postgres"
  probe_container "redis           → container alive"  "redis"

  # ── Messaging ──
  echo -e "  ${BOLD}Messaging${RESET}"
  probe_container "mqtt            → container alive"  "mqtt"

  # ── Tunnel ──
  echo -e "  ${BOLD}Tunnel${RESET}"
  probe_http "ngrok           → nodefleet.ngrok.dev"    "${NGROK_URL}"

  echo ""
  local total=$((pass + fail))
  if [ $fail -eq 0 ]; then
    echo -e "  ${GREEN}${BOLD}${pass}/${total} endpoints healthy${RESET}"
  else
    echo -e "  ${YELLOW}${BOLD}${pass}/${total} endpoints healthy${RESET} (${RED}${fail} failed${RESET})"
  fi
  echo ""
}

# ── Tunnel info ─────────────────────────────────────────────────────────────
do_tunnel() {
  echo -e "${BOLD}ngrok Tunnel Status${RESET}"
  echo ""

  local ngrok_url=""
  ngrok_url=$(curl -sf http://localhost:50040/api/tunnels 2>/dev/null | grep -oP '"public_url"\s*:\s*"\K[^"]+' | head -1 || true)

  if [ -n "$ngrok_url" ]; then
    echo -e "  ${GREEN}●${RESET} Tunnel active"
    echo -e "  ${BOLD}URL:${RESET} ${CYAN}${ngrok_url}${RESET}"
    echo ""
    echo -e "  Routes:"
    echo -e "    Dashboard:     ${CYAN}${ngrok_url}/${RESET}"
    echo -e "    WebSocket:     ${CYAN}${ngrok_url}/ws${RESET}"
    echo -e "    API:           ${CYAN}${ngrok_url}/api/${RESET}"
  else
    echo -e "  ${RED}○${RESET} Tunnel not connected"
    echo ""
    echo -e "  ${DIM}ngrok is part of docker compose — run ./nodefleet.sh to start all services.${RESET}"
    echo -e "  ${DIM}Check NGROK_AUTHTOKEN in .env if tunnel fails to connect.${RESET}"
  fi
  echo ""
}

# ── Version bump ────────────────────────────────────────────────────────────
do_bump() {
  local bump_type="${SERVICES[0]:-patch}"

  if [[ ! "$bump_type" =~ ^(patch|minor|major)$ ]]; then
    echo -e "${RED}Error: bump type must be patch, minor, or major.${RESET}"
    exit 1
  fi

  local current
  current="$(cat version.txt 2>/dev/null || echo '0.0.0')"
  current="${current%%[[:space:]]}"

  # Parse semver
  IFS='.' read -r major minor patch <<< "$current"
  major="${major:-0}"; minor="${minor:-0}"; patch="${patch:-0}"

  case "$bump_type" in
    major) major=$((major + 1)); minor=0; patch=0 ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    patch) patch=$((patch + 1)) ;;
  esac

  local new_version="${major}.${minor}.${patch}"

  echo -e "${BLUE}▸ Bumping version: ${current} → ${new_version} (${bump_type})${RESET}"

  # Write to root version.txt
  echo "$new_version" > version.txt

  # Update in-memory version
  APP_VERSION="$new_version"

  # Auto-commit
  git add version.txt
  git commit -m "bump: v${new_version} (${bump_type})"

  echo -e "${GREEN}✓ Version bumped to ${new_version} and committed${RESET}"
  echo ""
}

# ── Device Simulator ──────────────────────────────────────────────────────
do_simulate() {
  echo -e "${BLUE}▸ Starting device simulator...${RESET}"
  echo ""
  if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}Error: Node.js required.${RESET}"; exit 1
  fi
  local sim_args=(--host "localhost" --port "50081" --api-port "50300")
  for arg in "${SERVICES[@]}"; do sim_args+=("$arg"); done
  node tools/device-simulator.js "${sim_args[@]}"
}

# ── Firmware Compile Only ──────────────────────────────────────────────────
do_compile() {
  local pio_bin="${HOME}/.local/bin/pio"
  echo -e "${BLUE}▸ Compiling ESP32 firmware...${RESET}"
  if [ ! -x "$pio_bin" ]; then
    echo -e "${RED}Error: PlatformIO not found at $pio_bin${RESET}"
    echo -e "${DIM}  Install: pip3 install platformio${RESET}"; exit 1
  fi
  (cd firmware/esp32_agent && "$pio_bin" run) || { echo -e "${RED}  Build failed!${RESET}"; exit 1; }
  echo -e "${GREEN}✓ Firmware compiled successfully${RESET}"
  echo ""
}

# ── Firmware Flash ────────────────────────────────────────────────────────
do_flash() {
  local pio_bin="${HOME}/.local/bin/pio"
  echo -e "${BLUE}▸ Compiling + flashing ESP32 firmware...${RESET}"
  if [ ! -x "$pio_bin" ]; then
    echo -e "${RED}Error: PlatformIO not found at $pio_bin${RESET}"
    echo -e "${DIM}  Install: pip3 install platformio${RESET}"; exit 1
  fi
  echo -e "${YELLOW}  Compiling...${RESET}"
  (cd firmware/esp32_agent && "$pio_bin" run) || { echo -e "${RED}  Build failed!${RESET}"; exit 1; }
  echo -e "${YELLOW}  Flashing...${RESET}"
  (cd firmware/esp32_agent && "$pio_bin" run --target upload) || { echo -e "${RED}  Flash failed!${RESET}"; exit 1; }
  echo -e "${GREEN}✓ Firmware flashed${RESET}"
  echo ""
}

# ── MQTT Status ───────────────────────────────────────────────────────────
do_mqtt() {
  echo -e "${BOLD}MQTT Broker Status${RESET}"
  echo ""
  local mqtt_up
  mqtt_up=$(docker compose ps mqtt --format "{{.Status}}" 2>/dev/null || echo "")
  if echo "$mqtt_up" | grep -q "Up"; then
    echo -e "  ${GREEN}●${RESET} Mosquitto broker running"
    echo -e "  ${BOLD}MQTT:${RESET}      ${CYAN}mqtt://localhost:51883${RESET}"
    echo -e "  ${BOLD}WS-MQTT:${RESET}   ${CYAN}ws://localhost:59001${RESET}"
    echo ""
    docker compose exec -T mqtt mosquitto_pub -t "nodefleet/test" -m "ping" 2>/dev/null \
      && echo -e "  ${GREEN}✓${RESET} Publish test OK" \
      || echo -e "  ${RED}○${RESET} Publish test failed"
  else
    echo -e "  ${RED}○${RESET} MQTT not running. Start with: ./nodefleet.sh"
  fi
  echo ""
}

# ── Database Migration ─────────────────────────────────────────────────────
do_migrate() {
  echo -e "${BLUE}▸ Running database migrations...${RESET}"
  echo ""

  docker compose exec -T postgres psql -U nodefleet -d nodefleet <<'SQLEOF'
-- Enums (idempotent)
DO $$ BEGIN CREATE TYPE audit_action AS ENUM (
  'device_created','device_updated','device_deleted','device_paired',
  'device_connected','device_disconnected','command_sent','command_completed',
  'command_failed','command_timeout','settings_changed','user_login',
  'user_logout','firmware_updated','config_changed','alert_triggered',
  'media_uploaded','device_rebooted','factory_reset'
); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE alert_operator AS ENUM ('lt','gt','eq');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE alert_action_type AS ENUM ('log','webhook','command');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE webhook_event AS ENUM ('device_online','device_offline','command_completed','alert_triggered','low_battery');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tables (idempotent)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  action audit_action NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(255),
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL UNIQUE REFERENCES devices(id) ON DELETE CASCADE,
  camera_enabled BOOLEAN NOT NULL DEFAULT true,
  audio_enabled BOOLEAN NOT NULL DEFAULT false,
  gps_enabled BOOLEAN NOT NULL DEFAULT true,
  lte_enabled BOOLEAN NOT NULL DEFAULT true,
  mqtt_enabled BOOLEAN NOT NULL DEFAULT false,
  heartbeat_interval INTEGER NOT NULL DEFAULT 30000,
  gps_interval INTEGER NOT NULL DEFAULT 60000,
  camera_resolution VARCHAR(20) NOT NULL DEFAULT 'QVGA',
  audio_sample_rate INTEGER NOT NULL DEFAULT 16000,
  power_mode VARCHAR(20) NOT NULL DEFAULT 'active',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  metric VARCHAR(50) NOT NULL,
  operator alert_operator NOT NULL,
  threshold REAL NOT NULL,
  action alert_action_type NOT NULL DEFAULT 'log',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  events JSONB NOT NULL,
  secret VARCHAR(255) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS audit_logs_org_id_idx ON audit_logs(org_id);
CREATE INDEX IF NOT EXISTS audit_logs_device_id_idx ON audit_logs(device_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS device_settings_device_id_idx ON device_settings(device_id);
CREATE INDEX IF NOT EXISTS alert_rules_org_id_idx ON alert_rules(org_id);
CREATE INDEX IF NOT EXISTS alert_rules_device_id_idx ON alert_rules(device_id);
CREATE INDEX IF NOT EXISTS webhooks_org_id_idx ON webhooks(org_id);
SQLEOF

  echo -e "${GREEN}✓ Database migration complete${RESET}"
  echo ""
}

# ── Database Query ────────────────────────────────────────────────────────
do_db() {
  if [ ${#SERVICES[@]} -eq 0 ]; then
    docker compose exec postgres psql -U nodefleet -d nodefleet
  else
    docker compose exec -T postgres psql -U nodefleet -d nodefleet -c "${SERVICES[*]}"
  fi
}

# ── Check .env exists ───────────────────────────────────────────────────────
check_env() {
  if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found.${RESET}"
    echo -e "${YELLOW}Run ${BOLD}./nodefleet.sh setup${RESET}${YELLOW} to create one from .env.example.${RESET}"
    echo ""
    exit 1
  fi
}

# ── Main ────────────────────────────────────────────────────────────────────
print_header

case "$MODE" in
  setup)
    do_setup
    ;;
  status)
    print_status
    ;;
  rebuild)
    check_env
    do_rebuild
    ;;
  restart)
    do_restart
    ;;
  logs)
    do_logs
    ;;
  shell)
    do_shell
    ;;
  down)
    do_down
    ;;
  health)
    do_health
    ;;
  bump)
    do_bump
    ;;
  tunnel)
    do_tunnel
    ;;
  simulate)
    do_simulate
    ;;
  compile)
    do_compile
    ;;
  flash)
    do_flash
    ;;
  migrate)
    check_env
    do_migrate
    ;;
  mqtt)
    do_mqtt
    ;;
  db)
    do_db
    ;;
  default|all)
    check_env
    do_build
    do_up
    wait_for_services
    print_status
    ;;
esac
