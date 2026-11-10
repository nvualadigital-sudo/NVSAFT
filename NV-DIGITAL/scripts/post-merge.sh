#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Migrações são versionadas e executadas explicitamente; nunca no merge/build.
