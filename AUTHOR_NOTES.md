# Author Notes

## Task Overview

This task evaluates a firmware release publisher that:

* Reads and reconciles firmware build data.
* Groups valid builds into release bundles.
* Creates a deterministic release descriptor.
* Signs the descriptor using the current signing key.
* Publishes releases through the distribution gateway.
* Stores publication receipts in DuckDB.
* Prevents duplicate publications on repeated runs.

## Key Requirements

* Withdrawn builds must be excluded.
* Descriptor serialization must be deterministic.
* The descriptor must be cryptographically signed.
* Each bundle uses a deterministic request token.
* Existing publications must be reused.
* Repeated execution must produce the same result.

## Evaluation

The automated tests verify:

* Expected bundles and artifact totals.
* Correct signing key.
* Successful gateway publication.
* Database records and receipts.
* Idempotent repeated execution.

## 0 → 1 Proof

### Proof A — Empty Baseline

The publisher was left empty and the tests were executed before deploying the reference solution.

* Result: Tests failed as expected.
* Reward: `0`

### Proof B — Reference Solution

The reference solution was deployed and the same test suite was executed.

* Result: `10 passed`
* Reward: `1`

This confirms the task has a working 0 → 1 evaluation path.

## Final Environment

The final `environment/` does not contain the publisher implementation. The solver must implement `/app/publisher/release-publisher.mjs` according to `instruction.md`.