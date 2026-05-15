#!/usr/bin/env pwsh
# Build Docker image with automatic version tag injection
# Usage: ./build.ps1 [additional docker-compose build args]
# Example: ./build.ps1 --no-cache

$version = git describe --tags --abbrev=0 2>$null
if (-not $version) { $version = "dev" }

Write-Host "Building ops-dashboard image with version: $version" -ForegroundColor Cyan

$env:APP_VERSION = $version
docker compose build @args

if ($LASTEXITCODE -eq 0) {
  Write-Host "Build successful: ops-dashboard:latest ($version)" -ForegroundColor Green
} else {
  Write-Host "Build failed" -ForegroundColor Red
  exit 1
}
