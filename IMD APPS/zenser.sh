#!/usr/bin/env bash
set -euo pipefail

# ── Zenzers 4Life — Platform Orchestrator ────────────────────────────────────
# Full lifecycle management for the Zenzers 4Life medical platform.
# Replaces dev.sh with ngrok integration, .env bootstrap, version bumping.

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
NGROK_URL="https://zenzer.ngrok.dev"
APP_SERVICES=(admin-backend admin-console medical-api medical-web minio)

# ── Help ────────────────────────────────────────────────────────────────────
print_help() {
  cat <<'HELPEOF'
Zenzers 4Life — Platform Orchestrator

Usage: ./zenser.sh [command] [options]

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
  setup                      Interactive .env bootstrap from .env.example
  -h, --help                 Show this help

Services: admin-backend, medical-api, admin-console, medical-web, keycloak,
          postgres, mongodb, redis, rabbitmq, minio, nginx, ngrok

Examples:
  ./zenser.sh                            # Full build + start + health check
  ./zenser.sh setup                      # Bootstrap .env with random passwords
  ./zenser.sh rebuild medical-api        # Hot-rebuild medical-api only
  ./zenser.sh rebuild medical-api nginx  # Rebuild multiple services
  ./zenser.sh restart nginx              # Restart without rebuild
  ./zenser.sh logs medical-api           # Follow medical-api logs
  ./zenser.sh shell medical-api          # Shell into medical-api container
  ./zenser.sh health                     # Check all service endpoints
  ./zenser.sh bump                       # Bump patch version (1.0.0 → 1.0.1)
  ./zenser.sh bump minor                 # Bump minor version (1.0.1 → 1.1.0)
  ./zenser.sh tunnel                     # Show ngrok tunnel info
  ./zenser.sh down                       # Stop everything
HELPEOF
  exit 0
}

# ── Parse args ──────────────────────────────────────────────────────────────
MODE="default"
SERVICES=()

case "${1:-}" in
  rebuild|restart|logs|shell|down|health|bump|tunnel|setup)
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
        *) echo -e "${RED}Unknown argument: $arg${RESET}"; echo "Run ./zenser.sh --help for usage."; exit 1 ;;
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
  pad_line "  Zenzers 4Life — Platform Orchestrator"
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

  # Generate random passwords for all <CHANGE_ME> placeholders
  local generated=()
  while IFS= read -r line; do
    if echo "$line" | grep -q '<CHANGE_ME>'; then
      local key
      key=$(echo "$line" | cut -d= -f1)
      local value
      # Use alphanumeric passwords (no special chars that break shell/URLs)
      value=$(openssl rand -base64 16 | tr -d '/+=' | head -c 20)

      # For usernames, use simpler values
      case "$key" in
        *_USER|*_USERNAME)
          value="zenzers_$(echo "$key" | tr '[:upper:]' '[:lower:]' | sed 's/_user$//' | sed 's/_username$//' | sed 's/.*_//')"
          ;;
      esac

      sed -i "s|^${key}=<CHANGE_ME>|${key}=${value}|" .env
      generated+=("  ${key}=${value}")
    fi
  done < .env.example

  echo -e "${GREEN}✓ .env created with ${#generated[@]} generated values:${RESET}"
  echo ""
  for entry in "${generated[@]}"; do
    echo -e "  ${DIM}${entry}${RESET}"
  done
  echo ""
  echo -e "${YELLOW}  Review .env and adjust values as needed.${RESET}"
  echo -e "${YELLOW}  SMTP credentials must be set manually for email to work.${RESET}"
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
  local max_wait=120
  local elapsed=0

  # Stage 1: PostgreSQL
  echo -e "${YELLOW}▸ Waiting for PostgreSQL...${RESET}"
  while [ $elapsed -lt $max_wait ]; do
    if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" >/dev/null 2>&1; then
      echo -e "${GREEN}  ✓ PostgreSQL ready${RESET}"
      break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo -ne "\r${DIM}    ${elapsed}s / ${max_wait}s${RESET}  "
  done
  [ $elapsed -ge $max_wait ] && echo -e "\n${YELLOW}  ⚠ PostgreSQL timeout — continuing${RESET}"
  echo ""

  # Stage 2: Keycloak
  echo -e "${YELLOW}▸ Waiting for Keycloak...${RESET}"
  elapsed=0
  while [ $elapsed -lt $max_wait ]; do
    if curl -sf http://localhost:48080/realms/master >/dev/null 2>&1; then
      echo -e "${GREEN}  ✓ Keycloak ready${RESET}"
      break
    fi
    sleep 3
    elapsed=$((elapsed + 3))
    echo -ne "\r${DIM}    ${elapsed}s / ${max_wait}s${RESET}  "
  done
  [ $elapsed -ge $max_wait ] && echo -e "\n${YELLOW}  ⚠ Keycloak timeout — continuing${RESET}"
  echo ""

  # Stage 3: MinIO
  echo -e "${YELLOW}▸ Waiting for MinIO...${RESET}"
  elapsed=0
  while [ $elapsed -lt 30 ]; do
    if curl -sf http://localhost:49000/minio/health/live >/dev/null 2>&1; then
      echo -e "${GREEN}  ✓ MinIO ready${RESET}"
      break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo -ne "\r${DIM}    ${elapsed}s / 30s${RESET}  "
  done
  [ $elapsed -ge 30 ] && echo -e "\n${YELLOW}  ⚠ MinIO timeout — continuing${RESET}"
  echo ""

  # Stage 4: Medical API
  echo -e "${YELLOW}▸ Waiting for Medical API...${RESET}"
  elapsed=0
  while [ $elapsed -lt 90 ]; do
    if curl -sf http://localhost:43002/health >/dev/null 2>&1; then
      echo -e "${GREEN}  ✓ Medical API ready${RESET}"
      break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo -ne "\r${DIM}    ${elapsed}s / 90s${RESET}  "
  done
  [ $elapsed -ge 90 ] && echo -e "\n${YELLOW}  ⚠ Medical API timeout — continuing${RESET}"
  echo ""

  # Stage 4: Admin Backend
  echo -e "${YELLOW}▸ Waiting for Admin Backend...${RESET}"
  elapsed=0
  while [ $elapsed -lt 60 ]; do
    if curl -sf http://localhost:43001/health >/dev/null 2>&1; then
      echo -e "${GREEN}  ✓ Admin Backend ready${RESET}"
      break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo -ne "\r${DIM}    ${elapsed}s / 60s${RESET}  "
  done
  [ $elapsed -ge 60 ] && echo -e "\n${YELLOW}  ⚠ Admin Backend timeout — continuing${RESET}"
  echo ""
}

# ── Status table ────────────────────────────────────────────────────────────
print_status() {
  local bar
  bar=$(printf '═%.0s' $(seq 1 $BOX_W))

  echo -e "${BOLD}${CYAN}╔${bar}╗${RESET}"
  pad_line "  Zenzers 4Life — Platform Status (v${APP_VERSION} @ ${GIT_COMMIT})"
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
  ngrok_url=$(curl -sf http://localhost:44040/api/tunnels 2>/dev/null | grep -oP '"public_url"\s*:\s*"\K[^"]+' | head -1 || true)

  echo ""
  echo -e "  ${BOLD}URLs:${RESET}"
  echo -e "    Medical Web:   ${CYAN}http://localhost:40080/${RESET}"
  echo -e "    Admin Console: ${CYAN}http://localhost:40080/admin/${RESET}"
  echo -e "    Admin Backend: ${CYAN}http://localhost:43001${RESET}"
  echo -e "    Medical API:   ${CYAN}http://localhost:43002${RESET}"
  echo -e "    Keycloak:      ${CYAN}http://localhost:48080${RESET}"
  echo -e "    MinIO Console: ${CYAN}http://localhost:49001${RESET}"
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
    echo "Usage: ./zenser.sh rebuild <svc> [svc...]"
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
    echo "Usage: ./zenser.sh restart <svc> [svc...]"
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
    echo "Usage: ./zenser.sh shell <svc>"
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
  probe_http "admin-backend   → :3001/health"       "http://localhost:43001/health"
  probe_http "medical-api     → :3002/health"       "http://localhost:43002/health"
  probe_http "medical-web     → /"                  "http://localhost:40080/"
  probe_http "admin-console   → /admin/"            "http://localhost:40080/admin/"

  # ── Auth ──
  echo -e "  ${BOLD}Auth${RESET}"
  probe_http "keycloak        → :8080/realms/zenzers" "http://localhost:48080/realms/zenzers"

  # ── Storage ──
  echo -e "  ${BOLD}Storage${RESET}"
  probe_http "minio           → :9000/minio/health/live" "http://localhost:49000/minio/health/live"

  # ── Data ──
  echo -e "  ${BOLD}Data${RESET}"
  probe_container "postgres        → container alive"  "postgres"
  probe_container "mongodb         → container alive"  "mongodb"
  probe_container "redis           → container alive"  "redis"
  probe_container "rabbitmq        → container alive"  "rabbitmq"

  # ── Tunnel ──
  echo -e "  ${BOLD}Tunnel${RESET}"
  probe_http "ngrok           → zenzer.ngrok.dev"    "${NGROK_URL}"

  echo ""
  local total=$((pass + fail))
  if [ $fail -eq 0 ]; then
    echo -e "  ${GREEN}${BOLD}${pass}/${total} endpoints healthy${RESET}"
  else
    echo -e "  ${YELLOW}${BOLD}${pass}/${total} endpoints healthy${RESET} (${RED}${fail} failed${RESET})"
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

  # Sync to admin-backend if it exists
  local backend_version="zenzers-admin-backend/resources/version.txt"
  if [ -d "zenzers-admin-backend/resources" ]; then
    echo "$new_version" > "$backend_version"
    echo -e "${DIM}  Synced → ${backend_version}${RESET}"
  fi

  # Update in-memory version
  APP_VERSION="$new_version"

  # Auto-commit
  git add version.txt
  [ -f "$backend_version" ] && git add "$backend_version"
  git commit -m "bump: v${new_version} (${bump_type})"

  echo -e "${GREEN}✓ Version bumped to ${new_version} and committed${RESET}"
  echo ""
}

# ── Tunnel info ─────────────────────────────────────────────────────────────
do_tunnel() {
  echo -e "${BOLD}ngrok Tunnel Status${RESET}"
  echo ""

  local ngrok_url=""
  ngrok_url=$(curl -sf http://localhost:44040/api/tunnels 2>/dev/null | grep -oP '"public_url"\s*:\s*"\K[^"]+' | head -1 || true)

  if [ -n "$ngrok_url" ]; then
    echo -e "  ${GREEN}●${RESET} Tunnel active"
    echo -e "  ${BOLD}URL:${RESET} ${CYAN}${ngrok_url}${RESET}"
    echo ""
    echo -e "  Routes:"
    echo -e "    Medical Web:   ${CYAN}${ngrok_url}/${RESET}"
    echo -e "    Admin Console: ${CYAN}${ngrok_url}/admin/${RESET}"
    echo -e "    Keycloak:      ${CYAN}${ngrok_url}/auth/${RESET}"
    echo -e "    Admin API:     ${CYAN}${ngrok_url}/api/${RESET}"
  else
    echo -e "  ${RED}○${RESET} Tunnel not connected"
    echo ""
    echo -e "  ${DIM}ngrok is part of docker compose — run ./zenser.sh to start all services.${RESET}"
    echo -e "  ${DIM}Check NGROK_AUTHTOKEN in .env if tunnel fails to connect.${RESET}"
  fi
  echo ""
}

# ── Check .env exists ───────────────────────────────────────────────────────
check_env() {
  if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found.${RESET}"
    echo -e "${YELLOW}Run ${BOLD}./zenser.sh setup${RESET}${YELLOW} to create one from .env.example.${RESET}"
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
  default|all)
    check_env
    do_build
    do_up
    wait_for_services
    print_status
    ;;
esac
