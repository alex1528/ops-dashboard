#!/usr/bin/env sh
# Build Docker image with automatic version tag injection
# Usage: ./build.sh [additional docker-compose build args]
# Example: ./build.sh --no-cache

set -e

# 取最新的语义化版本 tag（按版本号排序，而非字典序或 git describe 的可达性）。
# 优先使用 `git tag --sort=-version:refname`：在所有 tag 中按版本号倒序，取第一条。
# 这样可避免 `git describe` 在多分支/sibling tag 场景下选到非最新版本（例如 v0.0.34 vs v0.0.35）。
VERSION="$(git tag -l 'v[0-9]*.[0-9]*.[0-9]*' --sort=-version:refname 2>/dev/null | head -1)"
# 若没有任何语义化 tag，回退到 git describe 取最近可达 tag
if [ -z "$VERSION" ]; then
  VERSION="$(git describe --tags --abbrev=0 2>/dev/null || echo "")"
fi
if [ -z "$VERSION" ]; then
  VERSION="dev"
fi
echo "Building ops-dashboard image with version: $VERSION"

# VITE_SSH_DEBUG 由 docker compose 从仓库根目录 .env 插值到 build.args，
# 这里仅回显以便确认调试日志是否会被编入前端 bundle。
SSH_DEBUG_STATE="$(grep -E '^[[:space:]]*VITE_SSH_DEBUG[[:space:]]*=' .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'"'"' ' || true)"
if [ "$SSH_DEBUG_STATE" = "1" ]; then
  echo "  SSH 终端字节调试日志: 已开启 (VITE_SSH_DEBUG=1)"
else
  echo "  SSH 终端字节调试日志: 关闭 (在 .env 中设置 VITE_SSH_DEBUG=1 可开启)"
fi

APP_VERSION="$VERSION" docker-compose build "$@"

echo "Build successful: ops-dashboard:latest ($VERSION)"
