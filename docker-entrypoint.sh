#!/bin/sh
set -e

DB_FILE="/app/data/ops-dashboard.db"
BACKUP_DIR="${BACKUP_DIR:-/app/backup}"
BACKUP_FILE="$BACKUP_DIR/ops-dashboard-backup.db"

# ============================================================================
# 启动前关键环境变量校验
# 提前在 shell 层失败，给出明确中文提示，避免迁移/seed 完成后再被 Nest 异常中断。
# 错误信息仅引用变量名，不会回显机密值本身。
# ============================================================================

# 必填项：缺失会直接 exit 1，并提示用户去仓库根目录 .env 配置（docker compose 模式）。
fail_missing() {
  echo "[ops-dashboard][致命] 必填环境变量 $1 未设置或为空。" >&2
  echo "[ops-dashboard]       Docker 部署请在仓库根目录 .env 中配置（与 docker-compose.yml 同级）；" >&2
  echo "[ops-dashboard]       配置示例见 .env.example。" >&2
  exit 1
}

# MASTER_KEY 必须为 64 位 hex（占位 / 长度 / 字符集 三重校验）
validate_master_key() {
  if [ -z "$MASTER_KEY" ]; then
    fail_missing MASTER_KEY
  fi
  case "$MASTER_KEY" in
    *CHANGE_ME*)
      echo "[ops-dashboard][致命] MASTER_KEY 仍为占位符（包含 CHANGE_ME），请替换为真实的 64 位 hex。" >&2
      echo "[ops-dashboard]       生成方法：openssl rand -hex 32" >&2
      exit 1
      ;;
  esac
  # 通过 wc -c 取长度（去掉末尾换行）
  len=$(printf %s "$MASTER_KEY" | wc -c | tr -d ' ')
  if [ "$len" -ne 64 ]; then
    echo "[ops-dashboard][致命] MASTER_KEY 长度应为 64 位 hex（当前长度 $len）。" >&2
    echo "[ops-dashboard]       生成方法：openssl rand -hex 32" >&2
    exit 1
  fi
  case "$MASTER_KEY" in
    *[!0-9a-fA-F]*)
      echo "[ops-dashboard][致命] MASTER_KEY 必须是 64 位 hex 字符串（仅允许 0-9 / a-f）。" >&2
      echo "[ops-dashboard]       生成方法：openssl rand -hex 32" >&2
      exit 1
      ;;
  esac
}

[ -n "$JWT_SECRET" ] || fail_missing JWT_SECRET
[ -n "$ADMIN_PASSWORD" ] || fail_missing ADMIN_PASSWORD
validate_master_key

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

# Run Prisma migrations, seed admin user, then start the application
npx prisma migrate deploy
node dist/prisma/seed.js
exec node dist/src/main
