#!/usr/bin/env bash
set -euo pipefail

# ── Zenzers 4Life — Dev Orchestrator ──────────────────────────────────────

# ── Colors ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ── Resolve project root (where this script lives) ────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Read version info ─────────────────────────────────────────────────────
APP_VERSION="$(cat version.txt 2>/dev/null || echo 'unknown')"
GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
GIT_MESSAGE="$(git log -1 --format=%s 2>/dev/null || echo '')"
DEPLOY_USER="$(git config user.email 2>/dev/null || echo 'system')"

export APP_VERSION GIT_COMMIT GIT_BRANCH GIT_MESSAGE DEPLOY_USER

# ── Help ──────────────────────────────────────────────────────────────────
print_help() {
  cat <<'HELPEOF'
Zenzers 4Life — Dev Orchestrator

Usage: ./dev.sh [command] [options]

Commands:
  (no args)                  Rebuild medical-api + admin-console, start all, show status
  --all                      Rebuild ALL services, start all, show status
  --status                   Show container status table (no build/restart)
  rebuild <svc> [svc...]     Hot-rebuild + recreate specific service(s)
  restart <svc> [svc...]     Restart service(s) without rebuilding
  logs [svc...]              Tail service logs (all if none specified)
  shell <svc>                Open shell in a running container
  down                       Stop and remove all containers (volumes preserved)
  health                     Probe all service health endpoints
  metro                      Start Metro bundler for React Native mobile app dev
  -h, --help                 Show this help

Services: admin-backend, medical-api, admin-console, medical-web, keycloak,
          postgres, mongodb, redis, rabbitmq, nginx

Examples:
  ./dev.sh                            # Daily: rebuild medical-api + admin-console, start all
  ./dev.sh rebuild medical-api        # Hot-rebuild medical-api only
  ./dev.sh rebuild medical-api nginx  # Rebuild multiple services
  ./dev.sh restart nginx              # Restart without rebuild
  ./dev.sh logs medical-api           # Follow medical-api logs
  ./dev.sh shell medical-api          # Shell into medical-api container
  ./dev.sh health                     # Check all service endpoints
  ./dev.sh metro                      # Start Metro for mobile app development
HELPEOF
  exit 0
}

# ── Parse args (command-first dispatch, backward-compatible flags) ────────
MODE="default"
SERVICES=()

case "${1:-}" in
  rebuild|restart|logs|shell|down|health|metro)
    MODE="$1"; shift; SERVICES=("$@") ;;
  -h|--help)
    print_help ;;
  "")
    MODE="default" ;;
  *)
    # Legacy --flag parsing (backward-compatible)
    for arg in "$@"; do
      case "$arg" in
        --all)    MODE="all" ;;
        --status) MODE="status" ;;
        -h|--help) print_help ;;
        *) echo -e "${RED}Unknown argument: $arg${RESET}"; echo "Run ./dev.sh --help for usage."; exit 1 ;;
      esac
    done
    ;;
esac

# ── Validate service names ───────────────────────────────────────────────
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

# ── Header ─────────────────────────────────────────────────────────────────
BOX_W=62  # inner width between and

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
  pad_line "  Zenzers 4Life — Dev Orchestrator"
  pad_line "  v${APP_VERSION} @ ${GIT_COMMIT} (${GIT_BRANCH})"
  echo -e "${BOLD}${CYAN}╚$(printf '═%.0s' $(seq 1 $BOX_W))╝${RESET}"
  echo ""
}

# ── Build phase ────────────────────────────────────────────────────────────
do_build() {
  if [ "$MODE" = "all" ]; then
    echo -e "${BLUE}▸ Rebuilding ALL services...${RESET}"
    docker compose build
  else
    echo -e "${BLUE}▸ Rebuilding medical-api + admin-console...${RESET}"
    docker compose build medical-api admin-console 2>/dev/null || \
      docker compose build medical-api
  fi
  echo -e "${GREEN}✓ Build complete${RESET}"
  echo ""
}

# ── Bring up ───────────────────────────────────────────────────────────────
do_up() {
  echo -e "${BLUE}▸ Starting all services...${RESET}"
  docker compose up -d
  echo -e "${GREEN}✓ Services started${RESET}"
  echo ""
}

# ── Wait for medical-api health ───────────────────────────────────────────
wait_for_medical_api() {
  echo -e "${YELLOW}▸ Waiting for medical-api health check...${RESET}"
  local max_wait=60
  local elapsed=0
  while [ $elapsed -lt $max_wait ]; do
    if curl -sf http://localhost:3002/health >/dev/null 2>&1; then
      echo -e "${GREEN}✓ Medical API is healthy${RESET}"
      echo ""
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo -ne "\r${DIM}  Waiting... ${elapsed}s / ${max_wait}s${RESET}"
  done
  echo ""
  echo -e "${YELLOW}⚠ Medical API health check timed out (${max_wait}s) — continuing anyway${RESET}"
  echo ""
}

# ── Status table ───────────────────────────────────────────────────────────
print_status() {
  local bar
  bar=$(printf '═%.0s' $(seq 1 $BOX_W))

  echo -e "${BOLD}${CYAN}╔${bar}╗${RESET}"
  pad_line "  Zenzers 4Life — Platform Status (v${APP_VERSION} @ ${GIT_COMMIT})"
  echo -e "${BOLD}${CYAN}╠${bar}╣${RESET}"
  printf "${BOLD}${CYAN}║${RESET}  ${BOLD}%-24s %-12s %-22s${RESET}${BOLD}${CYAN}║${RESET}\n" "SERVICE" "STATUS" "UPTIME"
  pad_line "  ─────────────────────────────────────────────────────────"

  local running=0
  local total=0

  # Parse docker compose ps output (use {{.Service}} for correct names)
  while IFS=$'\t' read -r svc_name status_text; do
    # Skip empty
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
      icon="+"
      color="${GREEN}"
      running=$((running + 1))
    elif [ "$state" = "Restarting" ]; then
      icon="~"
      color="${YELLOW}"
    else
      icon="x"
      color="${RED}"
      uptime="—"
    fi

    # Build the row text without ANSI codes to measure true length
    local row_text
    row_text=$(printf "  %s %-22s %-12s %s" "$icon" "$svc_name" "$state" "${uptime}${health_info}")
    local row_len=${#row_text}
    local row_pad=$((BOX_W - row_len))
    [ $row_pad -lt 0 ] && row_pad=0

    printf "${BOLD}${CYAN}║${RESET}  ${color}%s${RESET} ${color}%-22s${RESET} %-12s %s%*s${BOLD}${CYAN}║${RESET}\n" \
      "$icon" "$svc_name" "$state" "${uptime}${health_info}" "$row_pad" ""
  done < <(docker compose ps --format "{{.Service}}\t{{.Status}}" 2>/dev/null)

  echo -e "${BOLD}${CYAN}╚${bar}╝${RESET}"

  # Summary line
  if [ $running -eq $total ] && [ $total -gt 0 ]; then
    echo -e "  ${GREEN}${BOLD}${running}/${total} services running${RESET}"
  else
    echo -e "  ${YELLOW}${BOLD}${running}/${total} services running${RESET}"
  fi

  # URLs
  echo ""
  echo -e "  ${BOLD}URLs:${RESET}"
  echo -e "    Medical Web:   ${CYAN}http://localhost/${RESET}"
  echo -e "    Admin Console: ${CYAN}http://localhost/admin/${RESET}"
  echo -e "    Admin Backend: ${CYAN}http://localhost:3001${RESET}"
  echo -e "    Medical API:   ${CYAN}http://localhost:3002${RESET}"
  echo -e "    Keycloak:      ${CYAN}http://localhost:8080${RESET}"
  echo ""
}

# ── New command: rebuild ──────────────────────────────────────────────────
do_rebuild() {
  if [ ${#SERVICES[@]} -eq 0 ]; then
    echo -e "${RED}Error: 'rebuild' requires at least one service name.${RESET}"
    echo "Usage: ./dev.sh rebuild <svc> [svc...]"
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

  # Health-check medical-api if it was among the rebuilt services
  for svc in "${SERVICES[@]}"; do
    if [ "$svc" = "medical-api" ]; then
      wait_for_medical_api
      break
    fi
  done

  print_status
}

# ── New command: restart ──────────────────────────────────────────────────
do_restart() {
  if [ ${#SERVICES[@]} -eq 0 ]; then
    echo -e "${RED}Error: 'restart' requires at least one service name.${RESET}"
    echo "Usage: ./dev.sh restart <svc> [svc...]"
    exit 1
  fi
  validate_services "${SERVICES[@]}"

  echo -e "${BLUE}▸ Restarting: ${SERVICES[*]}...${RESET}"
  docker compose restart "${SERVICES[@]}"
  echo -e "${GREEN}✓ Services restarted${RESET}"
  echo ""

  # Health-check medical-api if it was among the restarted services
  for svc in "${SERVICES[@]}"; do
    if [ "$svc" = "medical-api" ]; then
      wait_for_medical_api
      break
    fi
  done

  print_status
}

# ── New command: logs ─────────────────────────────────────────────────────
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

# ── New command: shell ────────────────────────────────────────────────────
do_shell() {
  if [ ${#SERVICES[@]} -ne 1 ]; then
    echo -e "${RED}Error: 'shell' requires exactly one service name.${RESET}"
    echo "Usage: ./dev.sh shell <svc>"
    exit 1
  fi
  validate_services "${SERVICES[@]}"
  local svc="${SERVICES[0]}"

  echo -e "${BLUE}▸ Opening shell in ${svc}...${RESET}"
  docker compose exec "$svc" bash 2>/dev/null || docker compose exec "$svc" sh
}

# ── New command: down ─────────────────────────────────────────────────────
do_down() {
  echo -e "${BLUE}▸ Stopping and removing all containers (volumes preserved)...${RESET}"
  docker compose down
  echo -e "${GREEN}✓ All containers removed${RESET}"
}

# ── New command: health ───────────────────────────────────────────────────
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
      echo -e "  ${GREEN}+${RESET} ${name}"
      pass=$((pass + 1))
    else
      echo -e "  ${RED}x${RESET} ${name}"
      fail=$((fail + 1))
    fi
  }

  probe_tcp() {
    local name="$1"
    local svc="$2"
    local port="$3"
    if docker compose exec -T "$svc" sh -c "true" >/dev/null 2>&1; then
      echo -e "  ${GREEN}+${RESET} ${name}"
      pass=$((pass + 1))
    else
      echo -e "  ${RED}x${RESET} ${name}"
      fail=$((fail + 1))
    fi
  }

  # ── Core ──
  echo -e "  ${DIM}Core${RESET}"
  probe_http "admin-backend   → :3001/health"             "http://localhost:3001/health"
  probe_http "medical-api     → :3002/health"             "http://localhost:3002/health"
  probe_http "medical-web     → /"                        "http://localhost/"
  probe_http "admin-console   → /admin/"                  "http://localhost/admin/"

  # ── Auth & Messaging ──
  echo -e "  ${DIM}Auth & Messaging${RESET}"
  probe_http "keycloak        → :8080"                    "http://localhost:8080"
  probe_tcp  "rabbitmq        → container alive"           "rabbitmq" 5672

  # ── Data ──
  echo -e "  ${DIM}Data${RESET}"
  probe_tcp  "postgres        → container alive"           "postgres" 5432
  probe_tcp  "mongodb         → container alive"           "mongodb" 27017
  probe_tcp  "redis           → container alive"           "redis" 6379

  echo ""
  local total=$((pass + fail))
  if [ $fail -eq 0 ]; then
    echo -e "  ${GREEN}${BOLD}${pass}/${total} endpoints healthy${RESET}"
  else
    echo -e "  ${YELLOW}${BOLD}${pass}/${total} endpoints healthy${RESET} (${RED}${fail} failed${RESET})"
  fi
  echo ""
}


# ── New command: metro ────────────────────────────────────────────────────
do_metro() {
  local app_dir="$SCRIPT_DIR/alevelsoft-med-app-3cfb2823a1fe/alevelsoft-med-app-3cfb2823a1fe"
  if [ ! -d "$app_dir" ]; then
    echo -e "${RED}Error: Mobile app directory not found at $app_dir${RESET}"
    exit 1
  fi
  echo -e "${BLUE}▸ Starting Metro bundler for React Native...${RESET}"
  echo -e "${DIM}  App dir: $app_dir${RESET}"
  echo -e "${DIM}  Port: 8081 (default)${RESET}"
  echo ""
  cd "$app_dir"
  npx react-native start
}

# ── Main ───────────────────────────────────────────────────────────────────
print_header

case "$MODE" in
  status)
    print_status
    ;;
  rebuild)
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
  metro)
    do_metro
    ;;
  default|all)
    do_build
    do_up
    wait_for_medical_api
    print_status
    ;;
esac
