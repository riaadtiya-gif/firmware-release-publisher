import duckdb from 'duckdb';
import { DB_PATH, MANIFEST_PATH } from './config.mjs';

/**
 * Wraps DuckDB query execution in a Promise returning all result rows.
 *
 * @param {duckdb.Database} db
 * @param {string} sql
 * @returns {Promise<any[]>}
 */
export function query(db, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

/**
 * Wraps DuckDB statement execution in a Promise.
 *
 * @param {duckdb.Database} db
 * @param {string} sql
 * @returns {Promise<void>}
 */
export function exec(db, sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * Initializes the DuckDB database connection and creates required schema tables.
 *
 * @param {string} [dbPath=DB_PATH]
 * @returns {Promise<duckdb.Database>}
 */
export async function initDatabase(dbPath = DB_PATH) {
  const db = new duckdb.Database(dbPath);
  await exec(
    db,
    `CREATE TABLE IF NOT EXISTS publications (
      bundle_id VARCHAR PRIMARY KEY,
      request_token VARCHAR,
      publication_id VARCHAR,
      status VARCHAR,
      published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  );
  return db;
}

/**
 * Reconciles raw manifest CSV entries in DuckDB:
 * - Deduplicates exact duplicate records
 * - Applies withdrawals to cancel matching builds
 * - Aggregates artifact counts and total byte sizes for surviving bundles
 *
 * @param {duckdb.Database} db
 * @param {string} [manifestPath=MANIFEST_PATH]
 * @returns {Promise<Array<{bundle_id: string, artifact_count: number, total_bytes: number}>>}
 */
export async function reconcileManifest(db, manifestPath = MANIFEST_PATH) {
  const rows = await query(
    db,
    `WITH raw AS (
      SELECT * FROM read_csv_auto('${manifestPath}')
    ),
    deduped AS (
      SELECT DISTINCT * FROM raw
    ),
    withdrawals AS (
      SELECT supersedes_id
      FROM deduped
      WHERE record_type = 'WITHDRAWAL' AND supersedes_id IS NOT NULL
    ),
    surviving_builds AS (
      SELECT *
      FROM deduped
      WHERE record_type = 'BUILD'
        AND entry_id NOT IN (SELECT supersedes_id FROM withdrawals)
    )
    SELECT
      bundle_id,
      COUNT(*)::INTEGER AS artifact_count,
      SUM(size_bytes)::BIGINT AS total_bytes
    FROM surviving_builds
    GROUP BY bundle_id
    ORDER BY bundle_id ASC;`
  );
  return rows;
}

/**
 * Retrieves an existing publication receipt from DuckDB for idempotency check.
 *
 * @param {duckdb.Database} db
 * @param {string} bundleId
 * @returns {Promise<{publication_id: string, request_token: string, status: string} | null>}
 */
export async function getExistingPublication(db, bundleId) {
  const rows = await query(
    db,
    `SELECT publication_id, request_token, status FROM publications WHERE bundle_id = '${bundleId}';`
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Stores a new publication receipt in DuckDB.
 *
 * @param {duckdb.Database} db
 * @param {string} bundleId
 * @param {string} requestToken
 * @param {string} publicationId
 * @param {string} status
 * @returns {Promise<void>}
 */
export async function savePublication(db, bundleId, requestToken, publicationId, status) {
  await exec(
    db,
    `INSERT INTO publications (bundle_id, request_token, publication_id, status)
     VALUES ('${bundleId}', '${requestToken}', '${publicationId}', '${status}');`
  );
}
