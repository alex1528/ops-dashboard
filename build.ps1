#!/usr/bin/env pwsh
# Build Docker image with automatic version tag injection
# Usage: ./build.ps1 [additional docker-compose build args]
# Example: ./build.ps1 --no-cache

# 取最新的语义化版本 tag（按版本号排序，而非字典序或 git describe 的可达性）。
# 优先使用 `git tag --sort=-version:refname`：在所有 tag 中按版本号倒序，取第一条。
# 这样可避免 `git describe` 在多分支/sibling tag 场景下选到非最新版本（例如 v0.0.34 vs v0.0.35）。
$tags = git tag -l 'v[0-9]*.[0-9]*.[0-9]*' --sort=-version:refname 2>$null
$version = if ($tags) { ($tags | Select-Object -First 1).Trim() } else { '' }

# 若没有任何语义化 tag，回退到 git describe 取最近可达 tag
if (-not $version) {
  $version = (git describe --tags --abbrev=0 2>$null)
  if (-not $version) { $version = 'dev' }
}

Write-Host "Building ops-dashboard image with version: $version" -ForegroundColor Cyan

# VITE_SSH_DEBUG 由 docker compose 从仓库根目录 .env 插值到 build.args，
# 这里仅回显以便确认调试日志是否会被编入前端 bundle。
$sshDebug = '0'
if (Test-Path .env) {
  $line = Select-String -Path .env -Pattern '^\s*VITE_SSH_DEBUG\s*=' | Select-Object -Last 1
  if ($line) { $sshDebug = ($line.Line -replace '^\s*VITE_SSH_DEBUG\s*=', '').Trim().Trim('"', "'") }
}
if ($sshDebug -eq '1') {
  Write-Host "  SSH 终端字节调试日志: 已开启 (VITE_SSH_DEBUG=1)" -ForegroundColor Yellow
} else {
  Write-Host "  SSH 终端字节调试日志: 关闭 (在 .env 中设置 VITE_SSH_DEBUG=1 可开启)" -ForegroundColor DarkGray
}

$env:APP_VERSION = $version
docker compose build @args

if ($LASTEXITCODE -eq 0) {
  Write-Host "Build successful: ops-dashboard:latest ($version)" -ForegroundColor Green
} else {
  Write-Host "Build failed" -ForegroundColor Red
  exit 1
}
