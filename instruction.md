# Task: Firmware Release Publisher

## Overview

Implement `/app/publisher/release-publisher.mjs`, executable from `/app` with:

```bash
cd /app
npm run report
```

This runs:

```bash
node /app/publisher/release-publisher.mjs --report
```

The publisher must read `/app/fixtures/build_manifest.csv`, reconcile records with DuckDB and SQL, sign and publish valid firmware bundles, and persist receipts in `/app/releases.duckdb`.

## Reconciliation Rules

Use DuckDB and SQL to process the manifest.

* Deduplicate rows identical across every column before calculating metrics.
* A row with `record_type = 'WITHDRAWAL'` withdraws the build whose `entry_id` equals its `supersedes_id`.
* Exclude withdrawn builds.
* Publish a bundle only if at least one build survives.
* Do not publish bundles whose builds are all withdrawn.
* Derive every bundle dynamically from the manifest; never hardcode bundle IDs or metrics.
* For each publishable bundle:

  * `artifact_count` is the number of surviving builds.
  * `total_bytes` is the sum of their `size_bytes`.

## Signing

Fetch the active key ID from:

```text
GET http://127.0.0.1:7070/v1/signing-key/current
```

Use only:

```text
/app/keys/current/current.cert.pem
/app/keys/current/current.key.pem
```

Do not use any certificate or private key from `/app/keys/revoked/` for signing.

For each publishable bundle, create canonical UTF-8 JSON with lexicographically sorted keys, no whitespace, and exactly these fields:

```json
{"artifact_count":<int>,"bundle_id":"<string>","total_bytes":<int>}
```

Sign those exact bytes with detached, PEM-formatted OpenSSL CMS using binary input.

## Publishing

Publish through only:

```text
POST http://127.0.0.1:7070/v1/publications
```

Send:

```json
{
  "descriptor": "<canonical descriptor>",
  "signature": "<PEM signature>",
  "request_token": "token-<bundle_id>"
}
```

Use the deterministic token `token-<bundle_id>`. Do not access the gateway’s internal ledger.

## Persistence and Idempotency

Create or use `/app/releases.duckdb` with a `publications` table containing at least:

* `bundle_id`
* `request_token`
* `publication_id`
* `status`

After a successful publication, persist its gateway receipt. On later executions, look up the bundle in DuckDB and reuse the stored receipt instead of submitting it again. Repeated runs must not create duplicate local records or gateway publications.

## Output

Process bundles in ascending `bundle_id` order. On a successful run, emit exactly two lines per publishable bundle and no other publisher output:

```text
BUNDLE <bundle_id> SIGNED KEY=<key_id>
BUNDLE <bundle_id> PUBLISHED RECEIPT=<publication_id> TOKEN=<request_token> STATUS=PUBLISHED
```

Use the gateway’s returned publication ID, or the persisted ID when reusing an existing publication.

## Constraints

The implementation must:

* Exist at `/app/publisher/release-publisher.mjs`.
* Use `/app/fixtures/build_manifest.csv` as the only build-manifest input.
* Persist only publication state in `/app/releases.duckdb`.
* Use the gateway exclusively through its HTTP API.
* Use the current certificate and private key paths above.
* Exclude revoked keys, withdrawn builds, duplicate records, and empty bundles.
* Derive all bundle metrics from reconciled data.
* Use deterministic descriptors and request tokens.
* Reuse persisted receipts.
* Produce exactly two ordered output lines per publishable bundle.

## Success Condition

The task succeeds when:

```bash
cd /app
npm run report
```

reconciles the manifest correctly, signs every publishable bundle with the active key, publishes each through the gateway, stores receipts in `/app/releases.duckdb`, emits the exact required output, and remains idempotent on repeated execution.
