#!/usr/bin/env bash
set -euo pipefail

# NodeFleet scheduled-backup wrapper (invoked by cron).
# Runs scripts/backup.sh, then prunes old timestamped backups.
# Retention: keep the most recent $RETAIN *complete* backups (default 14).
# A backup is "complete" only if it contains postgres.sql.gz — partial dirs
# left behind by a failed run are deleted, never counted as a retained slot.
#
# Usage (cron): scripts/backup-cron.sh   # uses default retention
#               RETAIN=30 scripts/backup-cron.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_ROOT="${PROJECT_DIR}/backups"
RETAIN="${RETAIN:-14}"

# Validate RETAIN: must be a positive integer, else fall back to the default
# (an unvalidated 0/negative/non-numeric value could delete every backup or
# silently disable pruning).
if ! [[ "$RETAIN" =~ ^[0-9]+$ ]] || [ "$RETAIN" -lt 1 ]; then
    echo "WARN: invalid RETAIN='${RETAIN}', falling back to 14" >&2
    RETAIN=14
fi

echo "=== backup-cron run: $(date '+%Y-%m-%d %H:%M:%S %Z') ==="

# Create the backup. If backup.sh fails (e.g. a container is down), it may have
# already mkdir'd a partial timestamped dir — clean those up so the prune below
# never treats a broken backup as a valid retention slot, then surface failure.
if ! "${SCRIPT_DIR}/backup.sh"; then
    echo "ERROR: backup.sh failed — removing any incomplete backup dir(s)" >&2
    for d in "$BACKUP_ROOT"/[0-9]*_[0-9]*/; do
        [ -d "$d" ] || continue
        [ -f "${d}postgres.sql.gz" ] || { echo "  removing incomplete $(basename "$d")"; rm -rf "$d"; }
    done
    exit 1
fi

# Prune. Partition timestamped dirs into complete (has postgres.sql.gz) and
# incomplete. Glob expansion is lexically sorted, and YYYYmmdd_HHMMSS names sort
# chronologically, so complete[] is oldest-first. Incomplete dirs are deleted
# outright; complete dirs beyond the newest $RETAIN are pruned.
if [ -d "$BACKUP_ROOT" ]; then
    complete=()
    for d in "$BACKUP_ROOT"/[0-9]*_[0-9]*/; do
        [ -d "$d" ] || continue          # no match → literal glob, skip
        d="${d%/}"
        if [ -f "${d}/postgres.sql.gz" ]; then
            complete+=("$d")
        else
            echo "  removing incomplete backup $(basename "$d")"
            rm -rf "$d"
        fi
    done
    count=${#complete[@]}
    if [ "$count" -gt "$RETAIN" ]; then
        prune=$(( count - RETAIN ))
        echo "Pruning ${prune} old backup(s) (retain=${RETAIN}, complete=${count})..."
        for ((i=0; i<prune; i++)); do
            echo "  removing $(basename "${complete[$i]}")"
            rm -rf "${complete[$i]}"
        done
    fi
fi

echo "=== backup-cron done: $(date '+%Y-%m-%d %H:%M:%S %Z') ==="
