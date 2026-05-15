#!/bin/sh
# =============================================================================
# ops-dashboard 手动备份触发脚本
# 用法:
#   chmod +x backup-trigger.sh
#   ./backup-trigger.sh                     # 使用 .env 中的凭据
#   ./backup-trigger.sh -u admin -p mypass  # 显式指定凭据
#   ./backup-trigger.sh -H http://host:6000 # 指定服务地址
# =============================================================================
set -e

# ---------- 默认值 ----------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
BASE_URL="http://localhost:6000"
USERNAME=""
PASSWORD=""

# ---------- 读取 .env（如存在）----------
if [ -f "$ENV_FILE" ]; then
  # 仅提取 ADMIN_USERNAME / ADMIN_PASSWORD / PORT，跳过注释和空行
  _parse_env() {
    grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'"
  }
  USERNAME="$(_parse_env ADMIN_USERNAME)"
  PASSWORD="$(_parse_env ADMIN_PASSWORD)"
  PORT="$(_parse_env PORT)"
  if [ -n "$PORT" ]; then
    BASE_URL="http://localhost:$PORT"
  fi
fi

# ---------- 解析命令行参数 ----------
while [ $# -gt 0 ]; do
  case "$1" in
    -u|--username) USERNAME="$2"; shift 2 ;;
    -p|--password) PASSWORD="$2"; shift 2 ;;
    -H|--host)     BASE_URL="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,8p' "$0" | sed 's/^# //'
      exit 0
      ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

# ---------- 参数校验 ----------
if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
  echo "[ERROR] 未找到凭据。请在 .env 中配置 ADMIN_USERNAME/ADMIN_PASSWORD，或使用 -u / -p 参数。"
  exit 1
fi

echo "[backup-trigger] 服务地址: $BASE_URL"
echo "[backup-trigger] 登录用户: $USERNAME"

# ---------- 检查依赖 ----------
if ! command -v curl > /dev/null 2>&1; then
  echo "[ERROR] 未找到 curl，请先安装。"
  exit 1
fi

# ---------- 第一步：登录获取 Token ----------
echo "[backup-trigger] 正在登录..."

LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

HTTP_CODE=$(echo "$LOGIN_RESP" | tail -1)
BODY=$(echo "$LOGIN_RESP" | head -n -1)

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  echo "[ERROR] 登录失败 (HTTP $HTTP_CODE): $BODY"
  exit 1
fi

# 提取 access_token（兼容无 jq 环境）
TOKEN=$(echo "$BODY" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "[ERROR] 无法从响应中提取 access_token: $BODY"
  exit 1
fi

echo "[backup-trigger] 登录成功，Token 已获取。"

# ---------- 第二步：触发备份 ----------
echo "[backup-trigger] 正在触发备份..."

BACKUP_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/backup" \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$BACKUP_RESP" | tail -1)
BODY=$(echo "$BACKUP_RESP" | head -n -1)

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  echo "[ERROR] 备份请求失败 (HTTP $HTTP_CODE): $BODY"
  exit 1
fi

# 解析响应
SKIPPED=$(echo "$BODY" | grep -o '"skipped":[^,}]*' | cut -d':' -f2 | tr -d ' ')
BACKUP_PATH=$(echo "$BODY" | grep -o '"path":"[^"]*"' | cut -d'"' -f4)

if [ "$SKIPPED" = "true" ]; then
  echo "[backup-trigger] 备份已跳过（数据库内容与上次备份相同，无需重写）。"
else
  echo "[backup-trigger] 备份成功！文件路径: $BACKUP_PATH"
fi

echo "[backup-trigger] 完成。"
