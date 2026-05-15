#!/usr/bin/env sh
# Build Docker image with automatic version tag injection
# Usage: ./build.sh [additional docker-compose build args]
# Example: ./build.sh --no-cache

set -e

VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "dev")
echo "Building ops-dashboard image with version: $VERSION"

APP_VERSION="$VERSION" docker compose build "$@"

echo "Build successful: ops-dashboard:latest ($VERSION)"
