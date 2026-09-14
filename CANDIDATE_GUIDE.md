# Candidate Guide — Firmware Release Publisher

This document is a comprehensive guide to understanding the environment, requirements, and recommended engineering workflow for this challenge. It provides architectural context and debugging suggestions without prescribing exact implementation code. Always consult [instruction.md](instruction.md) for normative requirements.

---

## 1. Challenge Objectives

The release engineering team rotated the production firmware **code-signing key**. Following the rotation, the legacy publishing script failed because release payloads are still being signed with the revoked key, triggering `UNTRUSTED_SIGNATURE` rejections from the distribution gateway.

Your goal is to implement the replacement publisher to:

1. **Reconcile Data**: Ingest `/app/fixtures/build_manifest.csv` and filter cancelled builds and duplicate entries using DuckDB SQL.
2. **Sign Descriptors**: Fetch the active key ID and sign canonical JSON descriptors with the current OpenSSL CMS keypair (`/app/keys/current/`).
3. **Publish via HTTP**: Submit signed bundles to the Express gateway (`POST http://127.0.0.1:7070/v1/publications`).
4. **Persist State**: Store receipts and deterministic idempotency tokens in `/app/releases.duckdb` so repeated runs do not duplicate publications.
5. **Format Output**: Emit deterministic status lines to stdout matching `/app/reports/publications.expected.txt`.

### Deliverable Entry Point

```text
/app/publisher/release-publisher.mjs
```

Invoked via:

```bash
npm run report        # Executes: node /app/publisher/release-publisher.mjs --report
```

---

## 2. Environment & Assets Overview

All components are located within `/app` inside the container:

| Path | Description |
|---|---|
| `fixtures/build_manifest.csv` | Raw manifest containing build and withdrawal records. |
| `reports/publications.expected.txt` | Golden reference output format. |
| `package.json` | Root npm package configuration with `duckdb` dependencies. |
| `distribution-gateway/` | Provided Express distribution gateway (do not modify). |
| `keys/current/` | Active signing keypair (`current.cert.pem`, `current.key.pem`). |
| `keys/revoked/` | Revoked keypair (using these will cause verification failure). |
| `publisher/` | Target location for your `release-publisher.mjs` script. |

---

## 3. Reconciliation Logic

Derive valid bundles using DuckDB SQL:

1. **Eliminate Duplicates**: Multiple raw rows with identical values in every column must be collapsed to a single entry.
2. **Apply Withdrawals**: Any build entry whose `entry_id` appears as a `supersedes_id` in a `WITHDRAWAL` record must be removed.
3. **Filter Empty Bundles**: If all builds belonging to a `bundle_id` are withdrawn, omit that bundle entirely.
4. **Aggregate**: For each surviving bundle, calculate `artifact_count` (count of surviving builds) and `total_bytes` (sum of `size_bytes`).

---

## 4. Suggested Step-by-Step Implementation

### Step 1: Environment Exploration
Start the gateway in the background and verify connectivity:

```bash
cd /app/distribution-gateway && node server.js &
curl -s http://127.0.0.1:7070/healthz
curl -s http://127.0.0.1:7070/v1/signing-key/current
```

### Step 2: Ingestion & Reconciliation
Create a DuckDB database connection and write a SQL query against `/app/fixtures/build_manifest.csv` using Common Table Expressions (CTEs) to deduplicate and eliminate withdrawals. Verify your surviving row counts by inspection.

### Step 3: Canonical Descriptors & OpenSSL CMS Signing
Construct canonical JSON descriptors where keys are strictly sorted in lexicographical order:

```json
{"artifact_count":<count>,"bundle_id":"<id>","total_bytes":<bytes>}
```

Generate detached CMS signatures:

```bash
openssl cms -sign -in /tmp/descriptor.bin \
  -signer /app/keys/current/current.cert.pem \
  -inkey /app/keys/current/current.key.pem \
  -outform PEM -binary
```

### Step 4: HTTP Submission & Local Persistence
- Send POST requests with `{ descriptor, signature, request_token: "token-<bundle_id>" }`.
- Persist returned `publication_id` and `status` in the `publications` table of `/app/releases.duckdb`.
- Check DuckDB before issuing network requests to skip bundles that have already been published.

### Step 5: Deterministic Output
Format standard output lines:

```text
BUNDLE <bundle_id> SIGNED KEY=<key_id>
BUNDLE <bundle_id> PUBLISHED RECEIPT=<publication_id> TOKEN=<request_token> STATUS=PUBLISHED
```

---

## 5. Verification Techniques

### Compare Against Golden Output
Mask non-deterministic receipt IDs and compare against the expected report:

```bash
npm run report > /tmp/output.txt
diff <(sed -E 's/RECEIPT=[^ ]+/RECEIPT=<id>/' reports/publications.expected.txt) \
     <(sed -E 's/RECEIPT=[^ ]+/RECEIPT=<id>/' /tmp/output.txt)
```

### Check Idempotency
Ensure consecutive runs emit identical stdout and perform no duplicate insertions:

```bash
npm run report > /tmp/run1.txt
npm run report > /tmp/run2.txt
diff /tmp/run1.txt /tmp/run2.txt
```

---

## 6. Key Boundaries & Failure Modes

- **Network-only Gateway Interaction**: Do not attempt to inspect or write directly to gateway ledger files under `distribution-gateway/data/`.
- **No Revoked Keys**: Ensure you are signing exclusively with `/app/keys/current/`.
- **Dynamic Derivation**: Do not hardcode bundle metrics or golden output strings.
- **Ordered Output**: Always process and display bundles in ascending `bundle_id` order.

