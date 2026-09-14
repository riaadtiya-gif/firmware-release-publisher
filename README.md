# Firmware Release Publisher

An automated, cryptographically secure firmware release publishing utility. It leverages embedded DuckDB SQL for manifest data reconciliation and OpenSSL CMS for generating detached digital signatures against an active distribution gateway.

---

## Architecture Overview

```
+---------------------------------------------------------------------------------+
|                                Docker Container                                 |
|                                                                                 |
|  +--------------------+        +-------------------+       +-----------------+  |
|  | Build Manifest CSV | =====> |  Embedded DuckDB  | ====> | Reconciled Data |  |
|  | (Raw build log)    |        | (releases.duckdb) |       | (surviving bnds)|  |
|  +--------------------+        +-------------------+       +-----------------+  |
|                                                                     ||          |
|                                                                     \/          |
|  +--------------------+        +-------------------+       +-----------------+  |
|  | Express Gateway    | <===== | Detached OpenSSL  | <==== | Canonical JSON  |  |
|  | (POST/v1/publish)  |        | CMS Signature     |       | Descriptor      |  |
|  +--------------------+        +-------------------+       +-----------------+  |
+---------------------------------------------------------------------------------+
```

---

## Quick Start

> **Important**: Always ensure commands are executed from the `firmware-release-publisher` project root directory so volume mounts resolve to the intended paths.

### 1. Build Container Image

Build the evaluation container image from the environment definition:

```bash
docker build -t firmware-publisher environment/
```

### 2. Generate Release Publication Report

Execute the automated report runner:

```bash
./run_report.sh
```

Or run interactively inside the container:

```bash
docker run --rm \
  -v "$(pwd)/solution:/solution:ro" \
  firmware-publisher bash -c '
    cd /app/distribution-gateway && node server.js >/dev/null 2>&1 &
    sleep 1
    bash /solution/publish.sh >/dev/null 2>&1
    npm run --silent report
  '
```

### 3. Run Grader Evaluation

Run the automated baseline and reference verification suite:

```bash
docker run --rm \
  -v "$(pwd)/solution:/solution:ro" \
  -v "$(pwd)/tests:/tests:ro" \
  firmware-publisher bash -c '
    echo "=== 1. Testing Empty Baseline (Must Score 0) ==="
    bash /tests/test.sh || true
    echo "Reward: $(cat /logs/verifier/reward.txt)"

    echo "=== 2. Deploying Solution ==="
    bash /solution/publish.sh

    echo "=== 3. Testing Solution (Must Score 1) ==="
    bash /tests/test.sh
    echo "Reward: $(cat /logs/verifier/reward.txt)"
  '
```

- **Empty Baseline**: Fails with `Reward: 0` because no publisher is installed.
- **Reference Solution**: Passes all assertions with `Reward: 1`.

---

## Directory Structure

| Path | Purpose |
|---|---|
| `instruction.md` | Core specification and engineering constraints for the solver |
| `CANDIDATE_GUIDE.md` | Practical step-by-step implementation guide |
| `AUTHOR_NOTES.md` | Architectural background, trap mechanisms, and verification proofs |
| `solution/` | Reference publisher implementation and deployment script |
| `tests/` | Pytest verification suite and CTRF reward recorder |
| `environment/` | Dockerfile, Express distribution gateway, fixtures, and golden reports |
| `task.toml` | Task configuration metadata and runtime resource limits |

