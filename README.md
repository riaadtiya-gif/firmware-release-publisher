# Firmware Release Publishing Assessment

A Docker-based assessment for building a secure and idempotent firmware release publishing workflow with DuckDB, OpenSSL CMS signing, and an HTTP distribution gateway.

## Getting Started

### Build the Assessment Image

```bash
docker build -t firmware-assessment environment/
```

### Execute the Publisher

```bash
docker run --rm \
  -v "$(pwd)/solution:/solution:ro" \
  firmware-assessment bash -c 'cd /app/distribution-gateway && node server.js >/dev/null 2>&1 & sleep 1; bash /solution/publish.sh'
```

### Generate the Release Report

```bash
docker run --rm \
  -v "$(pwd)/solution:/solution:ro" \
  firmware-assessment bash -c 'cd /app/distribution-gateway && node server.js >/dev/null 2>&1 & sleep 1; bash /solution/publish.sh; cd /app; npm run --silent report'
```

### Run Automated Tests

```bash
docker run --rm \
  -v "$(pwd)/solution:/solution:ro" \
  -v "$(pwd)/tests:/tests:ro" \
  firmware-assessment bash -c '
    cd /app/distribution-gateway
    node server.js >/dev/null 2>&1 &
    sleep 1
    bash /solution/publish.sh
    bash /tests/test.sh
    echo "Reward: $(cat /logs/verifier/reward.txt)"
  '
```

Expected result:

```text
10 passed
Reward: 1
```

## Repository Layout

* `instruction.md` — Assessment task and requirements.
* `environment/` — Docker image, gateway, fixtures, and runtime dependencies.
* `solution/` — Reference implementation.
* `tests/` — Automated verification suite.
* `AUTHOR_NOTES.md` — Assessment design and verification notes.
