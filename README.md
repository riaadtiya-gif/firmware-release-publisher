# Firmware Release Publisher

A Docker-based firmware release publishing utility that uses DuckDB for release data and OpenSSL CMS for detached signatures. The publisher is designed to safely handle repeated runs without creating duplicate publications.

## Getting Started

### Build the Environment

Build the Docker image from the provided environment:

```bash
docker build -t firmware-publisher environment/
```

### Run the Publisher

To generate the release report, run:

```bash
./run_report.sh
```

You can also execute it directly inside the Docker environment:

```bash
docker run --rm -v "$(pwd)/solution:/solution:ro" firmware-publisher bash -c '
  cd /app/distribution-gateway && node server.js >/dev/null 2>&1 &
  sleep 1
  bash /solution/publish.sh >/dev/null 2>&1
  npm run --silent report
'
```

The command starts the local distribution gateway, installs the reference publisher, and then runs the report command.

### Run the Evaluation Tests

The following command runs both the empty-environment check and the reference-solution verification:

```bash
docker run --rm \
  -v "$(pwd)/solution:/solution:ro" \
  -v "$(pwd)/tests:/tests:ro" \
  firmware-publisher bash -c '
    echo "=== Empty Environment Check ==="
    bash /tests/test.sh || true
    echo "Reward: $(cat /logs/verifier/reward.txt)"

    echo "=== Installing Reference Solution ==="
    bash /solution/publish.sh

    echo "=== Running Reference Verification ==="
    bash /tests/test.sh
    echo "Reward: $(cat /logs/verifier/reward.txt)"
  '
```

The first run is expected to produce a score of `0` because no publisher is installed. After the reference solution is deployed, the tests should complete successfully with a score of `1`.

## Project Layout

```text
instruction.md       Task requirements given to the solver
solution/            Reference implementation
tests/               Automated verification and grading
environment/         Docker image, fixtures, gateway, and runtime setup
```
