# Author Notes — Firmware Release Publisher

## 1. Engineering Background & Challenge Context

This task simulates a mission-critical release engineering scenario: recovering from a cryptographic key rotation breakdown in an automated firmware deployment pipeline.

When security rotated the firmware code-signing keys, the legacy publisher script failed because release payloads were still signed with the expired/revoked private key, resulting in HTTP 400 (`UNTRUSTED_SIGNATURE`) errors from the Express distribution gateway.

The solver must implement a production-grade publisher script at `/app/publisher/release-publisher.mjs` that:
1. Reconciles raw manifest records from `/app/fixtures/build_manifest.csv` into an embedded DuckDB database (`/app/releases.duckdb`) using SQL.
2. Formats canonical release descriptors and signs each surviving bundle with the active OpenSSL CMS private key (`/app/keys/current/current.key.pem`).
3. Dispatches signed payloads to the distribution gateway (`POST /v1/publications`) and stores the returned receipt and idempotency token in DuckDB.
4. Produces deterministic status lines matching `/app/reports/publications.expected.txt` when invoked via `npm run report`.

---

## 2. Intentional Traps & Evaluation Rationale

The benchmark incorporates multiple intentional design traps that prevent naive scripting while validating robust software and security engineering practices:

### Trap 1: Key Rotation & Trust Anchor Verification
* **Trap**: Signing with static legacy key paths or the rotated key located in `/app/keys/revoked/`.
* **Mechanism**: The distribution gateway validates detached signatures via `openssl cms -verify` against `/app/keys/current/current.cert.pem`. Payloads signed with revoked credentials trigger `UNTRUSTED_SIGNATURE`.
* **Requirement**: The solver must query `GET /v1/signing-key/current` and sign exclusively with `/app/keys/current/`.

### Trap 2: Build Withdrawals & Inactive Bundles
* **Trap**: Aggregating all rows blindly or ignoring `WITHDRAWAL` entries.
* **Mechanism**: In `fixtures/build_manifest.csv`, records with `record_type = 'WITHDRAWAL'` invalidate prior `BUILD` records by matching `supersedes_id` against `entry_id`. For bundle `BND-104`, all builds (`MFR-0020` and `MFR-0021`) are withdrawn.
* **Requirement**: Withdrawn builds must be excluded, and bundles with zero surviving builds (`BND-104`) must not be published.

### Trap 3: Manifest Duplicate Ingestion
* **Trap**: Computing counts and byte totals without eliminating raw duplicate records.
* **Mechanism**: Exact duplicate rows exist in `build_manifest.csv` (e.g., duplicated entries for `MFR-0001`, `MFR-0007`, `MFR-0014`).
* **Requirement**: Deduplication across all columns must occur in SQL prior to computing aggregate metrics.

### Trap 4: Canonical JSON Descriptor Encoding
* **Trap**: Utilizing standard unformatted `JSON.stringify()` without deterministic key sorting.
* **Mechanism**: OpenSSL CMS detached signatures are computed over raw bytes. If JSON keys are not lexicographically ordered (`artifact_count`, `bundle_id`, `total_bytes`) or contain insignificant whitespace, gateway signature verification fails.
* **Requirement**: Descriptors must be encoded in strict canonical UTF-8 JSON.

---

## 3. Idempotency & Persistence Architecture

* Release submissions utilize a deterministic request token formatted as `token-<bundle_id>`.
* The publisher records `(bundle_id, request_token, publication_id, status)` within the `publications` table in `/app/releases.duckdb`.
* On repeat runs, the publisher queries local persistence first, preventing unnecessary network traffic and guaranteeing 100% deterministic output.

---

## 4. Verification & Proofs

Evaluated in a clean environment built from `environment/Dockerfile`.

### Proof A: Empty Baseline Run (Reward: 0)
With no publisher deployed, all verifier assertions fail, writing `0` to `/logs/verifier/reward.txt`:

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
======================== 4 failed, 2 warnings in 1.52s =========================
pytest exit code: 1
Reward: 0
```

---

### Proof B: Reference Solution Verification (Reward: 1)
After running `solution/publish.sh`, all tests pass and write `1` to `/logs/verifier/reward.txt`:

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
============================== 4 passed in 2.52s ===============================
pytest exit code: 0
Reward: 1
```

