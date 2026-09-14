import subprocess
import re
import os
import time
import requests
import duckdb
from pathlib import Path

def ensure_gateway_running():
    gateway_url = "http://127.0.0.1:7070"
    try:
        r = requests.get(f"{gateway_url}/healthz", timeout=1)
        if r.status_code == 200:
            return None
    except Exception:
        pass

    proc = subprocess.Popen(
        ["node", "/app/distribution-gateway/server.js"],
        cwd="/app/distribution-gateway",
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(50):
        try:
            r = requests.get(f"{gateway_url}/healthz", timeout=1)
            if r.status_code == 200:
                return proc
        except Exception:
            time.sleep(0.1)
    return proc

def test_publisher_script_exists():
    publisher_file = Path("/app/publisher/release-publisher.mjs")
    assert publisher_file.exists(), "publisher/release-publisher.mjs does not exist"

def test_report_matches_golden_output():
    proc = ensure_gateway_running()
    try:
        run_res = subprocess.run(
            ["npm", "run", "--silent", "report"],
            cwd="/app",
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert run_res.returncode == 0, f"npm run report failed: {run_res.stderr}"

        actual_lines = [l for l in run_res.stdout.splitlines() if l.startswith("BUNDLE ")]
        actual_output = "\n".join(actual_lines)

        expected_file = Path("/app/reports/publications.expected.txt")
        assert expected_file.exists(), "reports/publications.expected.txt not found"
        expected_lines = [l for l in expected_file.read_text(encoding="utf-8").splitlines() if l.startswith("BUNDLE ")]
        expected_output = "\n".join(expected_lines)

        actual_masked = re.sub(r"RECEIPT=[^ ]+", "RECEIPT=<id>", actual_output)
        expected_masked = re.sub(r"RECEIPT=[^ ]+", "RECEIPT=<id>", expected_output)

        assert actual_masked == expected_masked, f"Output mismatch.\nExpected:\n{expected_masked}\nActual:\n{actual_masked}"
    finally:
        if proc:
            proc.terminate()

def test_duckdb_reconciliation_and_receipts():
    db_path = Path("/app/releases.duckdb")
    assert db_path.exists(), "releases.duckdb does not exist"

    conn = duckdb.connect(str(db_path))
    rows = conn.execute("SELECT bundle_id, request_token, publication_id, status FROM publications ORDER BY bundle_id ASC").fetchall()
    conn.close()

    bundle_ids = [r[0] for r in rows]
    assert bundle_ids == ["BND-101", "BND-102", "BND-103"], f"Unexpected bundles in DB: {bundle_ids}"

    for r in rows:
        b_id, token, receipt_id, status = r
        assert token == f"token-{b_id}"
        assert receipt_id.startswith("pub_") or receipt_id.startswith("pub-")
        assert status == "PUBLISHED"

def test_idempotency_on_rerun():
    proc = ensure_gateway_running()
    try:
        run1 = subprocess.run(["npm", "run", "--silent", "report"], cwd="/app", capture_output=True, text=True, timeout=30)
        assert run1.returncode == 0
        run2 = subprocess.run(["npm", "run", "--silent", "report"], cwd="/app", capture_output=True, text=True, timeout=30)
        assert run2.returncode == 0
        assert run1.stdout.strip() == run2.stdout.strip(), "Second run output differed from first run output"
    finally:
        if proc:
            proc.terminate()
