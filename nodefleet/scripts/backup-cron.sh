#!/usr/bin/env bash
set -euo pipefail

# NodeFleet scheduled-backup wrapper (invoked by cron).
# Runs scripts/backup.sh, then prunes old timestamped backups.
# Retention: keep the most recent $RETAIN backups (default 14 daily = ~2 weeks).
#
# Usage (cron): scripts/backup-cron.sh   # uses default retention
#               RETAIN=30 scripts/backup-cron.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_ROOT="${PROJECT_DIR}/backups"
RETAIN="${RETAIN:-14}"

echo "=== backup-cron run: $(date '+%Y-%m-%d %H:%M:%S %Z') ==="

# Create the backup (pg_dump + MinIO + Redis).
"${SCRIPT_DIR}/backup.sh"

# Prune: keep only the newest $RETAIN timestamped backup dirs (named YYYYmmdd_HHMMSS).
if [ -d "$BACKUP_ROOT" ]; then
    mapfile -t all_backups < <(find "$BACKUP_ROOT" -maxdepth 1 -mindepth 1 -type d \
        -regextype posix-extended -regex '.*/[0-9]{8}_[0-9]{6}$' | sort)
    count=${#all_backups[@]}
    if [ "$count" -gt "$RETAIN" ]; then
        prune=$(( count - RETAIN ))
        echo "Pruning ${prune} old backup(s) (retain=${RETAIN}, total=${count})..."
        for ((i=0; i<prune; i++)); do
            echo "  removing $(basename "${all_backups[$i]}")"
            rm -rf "${all_backups[$i]}"
        done
    fi
fi

echo "=== backup-cron done: $(date '+%Y-%m-%d %H:%M:%S %Z') ==="
