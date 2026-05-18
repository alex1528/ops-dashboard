#!/bin/sh
# =============================================================================
# ops-dashboard 凭据字段清空脚本
# 用法:
#   chmod +x clear-credential.sh
#   ./clear-credential.sh -r Beszel -f password          # 清空密码（凭据从 .env 读取）
#   ./clear-credential.sh -r "聚合DNS" -f all            # 清空所有凭据字段
#   ./clear-credential.sh -r Certd -f username -u admin -p mypass
# =============================================================================
set -e

# ---------- 默认值 ----------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
BASE_URL="http://localhost:6000"
USERNAME=""
PASSWORD=""
RESOURCE=""
FIELD=""

# ---------- 读取 .env（如存在）----------
if [ -f "$ENV_FILE" ]; then
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
    -r|--resource) RESOURCE="$2"; shift 2 ;;
    -f|--field)    FIELD="$2"; shift 2 ;;
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
if [ -z "$RESOURCE" ]; then
  echo "[ERROR] 缺少 -r/--resource 参数（目标资源名称或 ID）"
  exit 1
fi

case "$FIELD" in
  username|password|extra|all) ;;
  *)
    echo "[ERROR] -f/--field 参数必须是 username | password | extra | all"
    exit 1
    ;;
esac

if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
  echo "[ERROR] 未找到凭据。请在 .env 中配置 ADMIN_USERNAME/ADMIN_PASSWORD，或使用 -u / -p 参数。"
  exit 1
fi

echo "[clear-credential] 服务地址: $BASE_URL"
echo "[clear-credential] 目标资源: $RESOURCE"
echo "[clear-credential] 清空字段: $FIELD"

# ---------- 检查依赖 ----------
if ! command -v curl > /dev/null 2>&1; then
  echo "[ERROR] 未找到 curl，请先安装。"
  exit 1
fi

# ---------- 第一步：登录获取 Token ----------
echo "[clear-credential] 正在登录..."

LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

HTTP_CODE=$(echo "$LOGIN_RESP" | tail -1)
BODY=$(echo "$LOGIN_RESP" | head -n -1)

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  echo "[ERROR] 登录失败 (HTTP $HTTP_CODE): $BODY"
  exit 1
fi

TOKEN=$(echo "$BODY" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "[ERROR] 无法从响应中提取 access_token: $BODY"
  exit 1
fi

echo "[clear-credential] 登录成功，Token 已获取。"

# ---------- 第二步：获取资源列表并匹配 ----------
echo "[clear-credential] 正在查找资源..."

RESOURCES_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/resources" \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$RESOURCES_RESP" | tail -1)
BODY=$(echo "$RESOURCES_RESP" | head -n -1)

if [ "$HTTP_CODE" != "200" ]; then
  echo "[ERROR] 获取资源列表失败 (HTTP $HTTP_CODE): $BODY"
  exit 1
fi

# 按 ID 或名称匹配（纯 shell，不依赖 python/jq）
# 尝试提取 "id":"xxx","name":"yyy" 配对
RESOURCE_ID=""
# 先尝试 ID 精确匹配
if echo "$BODY" | grep -q "\"id\":\"$RESOURCE\""; then
  RESOURCE_ID="$RESOURCE"
fi

# 再尝试按名称匹配
if [ -z "$RESOURCE_ID" ]; then
  # 提取格式: "id":"...","name":"TARGET"
  RESOURCE_ID=$(echo "$BODY" | grep -o "\"id\":\"[^\"]*\",\"name\":\"$RESOURCE\"" | head -1 | cut -d'"' -f4)
fi

# 兜底：尝试 name 在 id 前面的格式
if [ -z "$RESOURCE_ID" ]; then
  RESOURCE_ID=$(echo "$BODY" | grep -o "\"name\":\"$RESOURCE\"[^}]*\"id\":\"[^\"]*\"" | head -1 | grep -o "\"id\":\"[^\"]*\"" | cut -d'"' -f4)
fi

if [ -z "$RESOURCE_ID" ]; then
  echo "[ERROR] 未找到资源: $RESOURCE"
  exit 1
fi

echo "[clear-credential] 找到资源 ID: $RESOURCE_ID"

# ---------- 第三步：调用清空凭据接口 ----------
echo "[clear-credential] 正在清空凭据字段..."

CLEAR_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/resources/$RESOURCE_ID/credential/clear" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"field\":\"$FIELD\"}")

HTTP_CODE=$(echo "$CLEAR_RESP" | tail -1)
BODY=$(echo "$CLEAR_RESP" | head -n -1)

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "201" ]; then
  echo "[ERROR] 清空凭据失败 (HTTP $HTTP_CODE): $BODY"
  exit 1
fi

if [ "$FIELD" = "all" ]; then
  CLEARED="username, password, extra"
else
  CLEARED="$FIELD"
fi

echo "[clear-credential] ✓ 已清空资源 \"$RESOURCE\" 的凭据字段: $CLEARED"
echo "[clear-credential] 完成。"
