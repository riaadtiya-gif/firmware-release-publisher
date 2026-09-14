# Task: Firmware Release Publisher

## Overview

Your objective is to implement `/app/publisher/release-publisher.mjs`, which is invoked from `/app` via:

```bash
cd /app
npm run report
```

This command runs:

```bash
node /app/publisher/release-publisher.mjs --report
```

The publisher must read raw manifest records from `/app/fixtures/build_manifest.csv`, perform SQL-based data reconciliation using DuckDB, cryptographically sign all publishable firmware bundles, submit them to the distribution gateway, and record publication receipts in `/app/releases.duckdb`.

---

## Reconciliation Rules

All manifest reconciliation logic must be executed using DuckDB SQL:

1. **Deduplication**: Remove duplicate rows that have identical values across all columns prior to computing bundle aggregates.
2. **Withdrawals**: A manifest entry with `record_type = 'WITHDRAWAL'` voids the earlier build whose `entry_id` matches the withdrawal's `supersedes_id`.
3. **Active Builds**: Exclude all withdrawn builds from publishing.
4. **Publishable Bundles**: A release bundle is publishable if and only if at least one active build survives. If all builds for a bundle are withdrawn, omit the bundle entirely.
5. **Dynamic Metrics**: Compute all bundle metrics directly from surviving rows (never hardcode values or bundle identifiers):
   - `artifact_count`: Total number of surviving builds in the bundle.
   - `total_bytes`: Sum of `size_bytes` for all surviving builds in the bundle.

---

## Cryptographic Signing

1. Query the active signing key metadata from the local gateway:
   ```text
   GET http://127.0.0.1:7070/v1/signing-key/current
   ```
2. Use exclusively the active keypair located at:
   ```text
   /app/keys/current/current.cert.pem
   /app/keys/current/current.key.pem
   ```
   > ⚠️ **Caution**: Never use certificates or keys from `/app/keys/revoked/`.

3. For every publishable bundle, generate a canonical UTF-8 JSON descriptor with lexicographically sorted keys and no insignificant whitespace:
   ```json
   {"artifact_count":<int>,"bundle_id":"<string>","total_bytes":<int>}
   ```

4. Generate a detached OpenSSL CMS signature in PEM format over the exact UTF-8 bytes of the canonical descriptor using binary mode.

---

## Publishing to the Gateway

1. Submit each signed release bundle via HTTP POST:
   ```text
   POST http://127.0.0.1:7070/v1/publications
   ```
2. Payload structure:
   ```json
   {
     "descriptor": "<canonical descriptor string>",
     "signature": "<PEM detached CMS signature>",
     "request_token": "token-<bundle_id>"
   }
   ```
3. Use the deterministic token format `token-<bundle_id>`. Do not interact with the gateway's private files or database ledger directly.

---

## Persistence and Idempotency

1. Create or connect to `/app/releases.duckdb`.
2. Ensure a `publications` table exists containing at least the following schema:
   - `bundle_id` (Primary Key / String)
   - `request_token` (String)
   - `publication_id` (String)
   - `status` (String)
3. Upon a successful HTTP publication, save the returned receipt in DuckDB.
4. On subsequent executions, query DuckDB first. If a bundle was already published, reuse the stored receipt rather than resubmitting to the gateway.
5. Re-running the publisher must never create duplicate database rows or redundant gateway publications.

---

## Output Format

Iterate over publishable bundles in ascending `bundle_id` order. For each bundle, output exactly two lines to stdout:

```text
BUNDLE <bundle_id> SIGNED KEY=<key_id>
BUNDLE <bundle_id> PUBLISHED RECEIPT=<publication_id> TOKEN=<request_token> STATUS=PUBLISHED
```

- `<key_id>` is the active key identifier returned by the gateway.
- `<publication_id>` is the gateway receipt ID (retrieved from the HTTP response or loaded from DuckDB).

---

## Constraints Summary

- Entry point must be located at `/app/publisher/release-publisher.mjs`.
- Manifest input is strictly read from `/app/fixtures/build_manifest.csv`.
- Persistent storage must use `/app/releases.duckdb`.
- Gateway interaction is strictly over HTTP (`http://127.0.0.1:7070`).
- Signatures must use the active certificate and private key under `/app/keys/current/`.
- Revoked keys, withdrawn builds, duplicate rows, and empty bundles must be properly filtered.
- Output must match the required two lines per bundle ordered by `bundle_id`.

---

## Success Criteria

The solution succeeds when:

```bash
cd /app && npm run report
```

successfully reconciles manifest records, signs all valid bundles with the active key, registers publications with the gateway, persists receipts in DuckDB, produces deterministic stdout matching expected golden outputs, and demonstrates idempotent behavior on repeated runs.

