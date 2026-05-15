#!/bin/sh
set -e

DB_FILE="/app/data/ops-dashboard.db"
BACKUP_DIR="${BACKUP_DIR:-/app/backup}"
BACKUP_FILE="$BACKUP_DIR/ops-dashboard-backup.db"

# Auto-restore: if the database file is missing but a backup exists, restore it
if [ ! -f "$DB_FILE" ]; then
  if [ -f "$BACKUP_FILE" ]; then
    echo "[ops-dashboard] DB missing — auto-restoring from backup: $(basename "$BACKUP_FILE")"
    mkdir -p "$(dirname "$DB_FILE")"
    cp "$BACKUP_FILE" "$DB_FILE"
  else
    echo "[ops-dashboard] No backup found — starting with a fresh database"
  fi
fi

# Run Prisma migrations then start the application
npx prisma migrate deploy
exec node dist/src/main
