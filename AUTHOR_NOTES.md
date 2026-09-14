# Author Notes — Firmware Release Publisher

## 1. Task Overview & Engineering Context
This benchmark evaluates an AI coding agent's ability to handle a real-world infrastructure failure: a cryptographic key rotation breakdown. 

Release engineering rotated the firmware code-signing key. The publisher pipeline broke because release bundles were still being signed with the now-revoked private key, causing the Express distribution gateway to reject every submission with `UNTRUSTED_SIGNATURE`.

The solver must implement a production-grade publisher (`/app/publisher/release-publisher.mjs`) that:
1. Reconciles raw manifest records from `fixtures/build_manifest.csv` into an embedded DuckDB database (`releases.duckdb`) using SQL.
2. Formats canonical release descriptors and signs each surviving bundle with the active OpenSSL CMS private key (`/app/keys/current/current.key.pem`).
3. Submits signed payloads to the distribution gateway (`POST /v1/publications`) and saves the receipt and token in DuckDB for idempotency.
4. Prints deterministic status lines matching `reports/publications.expected.txt` when invoked via `npm run report`.

---

## 2. Intentional Traps & Evaluation Rationale

This task is designed to be cheat-resistant, punishing naive or incomplete solutions while rewarding correct systems engineering:

### Trap 1: Key Rotation & Trust Anchor Verification
* **Trap:** A naive script might use hardcoded key paths or the deprecated key under `/app/keys/revoked/`.
* **Mechanism:** The distribution gateway executes `openssl cms -verify` against `/app/keys/current/current.cert.pem`. Descriptors signed with the revoked key are rejected with HTTP 400 (`UNTRUSTED_SIGNATURE`).
* **Requirement:** The solver must query `GET /v1/signing-key/current` and sign exclusively with `/app/keys/current/`.

### Trap 2: Build Withdrawals & Empty Bundles
* **Trap:** Summing all rows or ignoring `WITHDRAWAL` records.
* **Mechanism:** In `fixtures/build_manifest.csv`, records with `record_type = 'WITHDRAWAL'` cancel previous `BUILD` records via `supersedes_id`. For bundle `BND-104`, all associated builds (`MFR-0020` and `MFR-0021`) are withdrawn.
* **Requirement:** The solver must exclude cancelled builds and omit bundles with zero surviving builds (`BND-104`) entirely.

### Trap 3: Manifest Duplicate Ingestion
* **Trap:** Calculating artifact count and byte size without deduplicating raw rows.
* **Mechanism:** Multiple identical rows exist in `build_manifest.csv` (e.g. identical `MFR-0001`, `MFR-0007`, `MFR-0014` entries).
* **Requirement:** Deduplication across all columns must be performed in SQL before aggregating artifact count and total bytes.

### Trap 4: Canonical JSON Descriptor Encoding
* **Trap:** Using standard `JSON.stringify()` without key ordering.
* **Mechanism:** The gateway verifies detached signatures over the exact byte sequence received. If JSON keys are not lexicographically sorted (`artifact_count`, `bundle_id`, `total_bytes`) or contain insignificant whitespace, verification fails.
* **Requirement:** The solver must produce canonical UTF-8 JSON representations.

---

## 3. Idempotency & Persistence Design
* Each release submission uses a deterministic request token formatted as `token-<bundle_id>`.
* The publisher records `(bundle_id, request_token, publication_id, status)` in a `publications` table in `releases.duckdb`.
* On successive runs, the publisher verifies local persistence first, preventing redundant HTTP requests and ensuring 100% deterministic output across re-runs.

---

## 4. Verification & The Two Proofs

The task was verified inside a clean container built from `environment/Dockerfile`.

### Proof A: Empty Baseline Run (Reward: 0)
With no solution installed, all verifier tests fail, writing `0` to `/logs/verifier/reward.txt`:

```text
=== 1. Testing Empty Baseline (Must Score 0) ===
============================= test session starts ==============================
platform linux -- Python 3.11.2, pytest-8.4.1, pluggy-1.6.0
rootdir: /tests
plugins: json-ctrf-0.3.5
collected 4 items

../tests/test_outputs.py FFFF                                            [100%]

=================================== FAILURES ===================================
FAILED ../tests/test_outputs.py::test_publisher_script_exists
FAILED ../tests/test_outputs.py::test_report_matches_golden_output
FAILED ../tests/test_outputs.py::test_duckdb_reconciliation_and_receipts
FAILED ../tests/test_outputs.py::test_idempotency_on_rerun
======================== 4 failed, 2 warnings in 1.79s =========================
pytest exit code: 1
Reward: 0
```

---

### Proof B: Reference Solution Verification (Reward: 1)
After deploying `solution/publish.sh`, all tests pass, producing the deterministic output and writing `1` to `/logs/verifier/reward.txt`:

```text
=== 2. Deploying Solution ===
=== 3. Testing Solution (Must Score 1) ===
============================= test session starts ==============================
platform linux -- Python 3.11.2, pytest-8.4.1, pluggy-1.6.0
rootdir: /
plugins: json-ctrf-0.3.5
collected 4 items

../tests/test_outputs.py ....                                            [100%]

==================================== PASSES ====================================
PASSED ../tests/test_outputs.py::test_publisher_script_exists
PASSED ../tests/test_outputs.py::test_report_matches_golden_output
PASSED ../tests/test_outputs.py::test_duckdb_reconciliation_and_receipts
PASSED ../tests/test_outputs.py::test_idempotency_on_rerun
============================== 4 passed in 2.58s ===============================
pytest exit code: 0
Reward: 1
```
