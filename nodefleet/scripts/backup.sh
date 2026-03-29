#!/usr/bin/env bash
set -euo pipefail

# NodeFleet Backup & Restore Script
# Usage:
#   ./scripts/backup.sh            # Create a new backup
#   ./scripts/backup.sh --list     # List existing backups
#   ./scripts/backup.sh --restore <backup_dir>  # Restore from backup

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_ROOT="${PROJECT_DIR}/backups"

# Container names
PG_CONTAINER="nodefleet-postgres"
MINIO_CONTAINER="nodefleet-minio"
REDIS_CONTAINER="nodefleet-redis"

# ── List backups ─────────────────────────────────────────────────────────────
list_backups() {
    echo "=== NodeFleet Backups ==="
    if [ ! -d "$BACKUP_ROOT" ] || [ -z "$(ls -A "$BACKUP_ROOT" 2>/dev/null)" ]; then
        echo "No backups found in ${BACKUP_ROOT}"
        exit 0
    fi
    for dir in "${BACKUP_ROOT}"/*/; do
        if [ -d "$dir" ]; then
            name="$(basename "$dir")"
            size="$(du -sh "$dir" 2>/dev/null | cut -f1)"
            echo "  ${name}  (${size})"
        fi
    done
}

# ── Create backup ────────────────────────────────────────────────────────────
create_backup() {
    TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
    BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"
    mkdir -p "$BACKUP_DIR"

    echo "=== NodeFleet Backup: ${TIMESTAMP} ==="
    echo "Backup directory: ${BACKUP_DIR}"
    echo ""

    # PostgreSQL dump
    echo "[1/3] Dumping PostgreSQL..."
    docker exec "$PG_CONTAINER" pg_dump -U nodefleet -d nodefleet > "${BACKUP_DIR}/postgres.sql"
    gzip "${BACKUP_DIR}/postgres.sql"
    echo "      -> postgres.sql.gz"

    # MinIO data
    echo "[2/3] Copying MinIO data..."
    docker cp "${MINIO_CONTAINER}:/minio_data" "${BACKUP_DIR}/minio_data"
    tar -czf "${BACKUP_DIR}/minio_data.tar.gz" -C "${BACKUP_DIR}" minio_data
    rm -rf "${BACKUP_DIR}/minio_data"
    echo "      -> minio_data.tar.gz"

    # Redis RDB
    echo "[3/3] Copying Redis RDB..."
    # Trigger a background save first
    docker exec "$REDIS_CONTAINER" redis-cli BGSAVE >/dev/null 2>&1 || true
    sleep 2
    docker cp "${REDIS_CONTAINER}:/data/dump.rdb" "${BACKUP_DIR}/dump.rdb" 2>/dev/null || echo "      (no RDB file found, skipping)"
    if [ -f "${BACKUP_DIR}/dump.rdb" ]; then
        gzip "${BACKUP_DIR}/dump.rdb"
        echo "      -> dump.rdb.gz"
    fi

    echo ""
    echo "=== Backup Summary ==="
    for f in "${BACKUP_DIR}"/*; do
        if [ -f "$f" ]; then
            size="$(du -sh "$f" | cut -f1)"
            echo "  $(basename "$f")  ${size}"
        fi
    done
    total="$(du -sh "$BACKUP_DIR" | cut -f1)"
    echo "  ─────────────────────"
    echo "  Total: ${total}"
    echo ""
    echo "Backup complete: ${BACKUP_DIR}"
}

# ── Restore from backup ─────────────────────────────────────────────────────
restore_backup() {
    local RESTORE_DIR="$1"

    # Allow passing just the timestamp name
    if [ ! -d "$RESTORE_DIR" ] && [ -d "${BACKUP_ROOT}/${RESTORE_DIR}" ]; then
        RESTORE_DIR="${BACKUP_ROOT}/${RESTORE_DIR}"
    fi

    if [ ! -d "$RESTORE_DIR" ]; then
        echo "Error: Backup directory not found: ${RESTORE_DIR}"
        exit 1
    fi

    echo "=== NodeFleet Restore ==="
    echo "Restoring from: ${RESTORE_DIR}"
    echo ""
    echo "WARNING: This will overwrite current data. Press Ctrl+C to cancel."
    echo "Continuing in 5 seconds..."
    sleep 5

    # PostgreSQL restore
    if [ -f "${RESTORE_DIR}/postgres.sql.gz" ]; then
        echo "[1/3] Restoring PostgreSQL..."
        gunzip -c "${RESTORE_DIR}/postgres.sql.gz" | docker exec -i "$PG_CONTAINER" psql -U nodefleet -d nodefleet
        echo "      -> PostgreSQL restored"
    else
        echo "[1/3] No PostgreSQL backup found, skipping"
    fi

    # MinIO restore
    if [ -f "${RESTORE_DIR}/minio_data.tar.gz" ]; then
        echo "[2/3] Restoring MinIO data..."
        TMP_DIR="$(mktemp -d)"
        tar -xzf "${RESTORE_DIR}/minio_data.tar.gz" -C "$TMP_DIR"
        docker cp "${TMP_DIR}/minio_data/." "${MINIO_CONTAINER}:/minio_data/"
        rm -rf "$TMP_DIR"
        echo "      -> MinIO data restored"
    else
        echo "[2/3] No MinIO backup found, skipping"
    fi

    # Redis restore
    if [ -f "${RESTORE_DIR}/dump.rdb.gz" ]; then
        echo "[3/3] Restoring Redis RDB..."
        TMP_RDB="$(mktemp)"
        gunzip -c "${RESTORE_DIR}/dump.rdb.gz" > "$TMP_RDB"
        docker cp "$TMP_RDB" "${REDIS_CONTAINER}:/data/dump.rdb"
        rm -f "$TMP_RDB"
        docker restart "$REDIS_CONTAINER"
        echo "      -> Redis restored (container restarted)"
    else
        echo "[3/3] No Redis backup found, skipping"
    fi

    echo ""
    echo "Restore complete from: ${RESTORE_DIR}"
}

# ── Main ─────────────────────────────────────────────────────────────────────
case "${1:-}" in
    --list)
        list_backups
        ;;
    --restore)
        if [ -z "${2:-}" ]; then
            echo "Usage: $0 --restore <backup_dir_or_timestamp>"
            exit 1
        fi
        restore_backup "$2"
        ;;
    --help|-h)
        echo "NodeFleet Backup & Restore"
        echo ""
        echo "Usage:"
        echo "  $0              Create a new timestamped backup"
        echo "  $0 --list       List existing backups"
        echo "  $0 --restore <backup>  Restore from a backup (path or timestamp)"
        echo "  $0 --help       Show this help"
        ;;
    *)
        create_backup
        ;;
esac
