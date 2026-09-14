#!/bin/bash
docker run --rm \
  -v "$(pwd)/solution:/solution:ro" \
  firmware-publisher bash -c '
    cd /app/distribution-gateway && node server.js >/dev/null 2>&1 &
    sleep 1
    bash /solution/publish.sh >/dev/null 2>&1
    npm run --silent report
  '
