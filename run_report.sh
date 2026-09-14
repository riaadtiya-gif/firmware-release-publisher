#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

docker run --rm \
  -v "$SCRIPT_DIR/solution:/solution:ro" \
  firmware-publisher bash -c '
    cd /app/distribution-gateway && node server.js >/dev/null 2>&1 &
    sleep 1
    bash /solution/publish.sh >/dev/null 2>&1
    npm run --silent report
  '

