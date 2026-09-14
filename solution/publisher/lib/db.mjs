import duckdb from 'duckdb';
import { RELEASES_DB_PATH, BUILD_MANIFEST_PATH } from './config.mjs';

/**
 * Executes a SQL query against the DuckDB instance and resolves all matching rows.
 *
 * @param {duckdb.Database} databaseInstance
 * @param {string} sqlQuery
 * @returns {Promise<any[]>}
 */
export function executeSqlQuery(databaseInstance, sqlQuery) {
  return new Promise((resolve, reject) => {
    databaseInstance.all(sqlQuery, (err, resultRows) => {
      if (err) return reject(err);
      resolve(resultRows);
    });
  });
}

/**
 * Executes a SQL statement (DDL/DML) against DuckDB.
 *
 * @param {duckdb.Database} databaseInstance
 * @param {string} sqlStatement
 * @returns {Promise<void>}
 */
export function executeSqlCommand(databaseInstance, sqlStatement) {
  return new Promise((resolve, reject) => {
    databaseInstance.run(sqlStatement, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * Initializes the DuckDB database and ensures the publications receipt table exists.
 *
 * @param {string} [databasePath=RELEASES_DB_PATH]
 * @returns {Promise<duckdb.Database>}
 */
export async function initializeReleasesDb(databasePath = RELEASES_DB_PATH) {
  const dbConnection = new duckdb.Database(databasePath);
  await executeSqlCommand(
    dbConnection,
    `CREATE TABLE IF NOT EXISTS publications (
      bundle_id VARCHAR PRIMARY KEY,
      request_token VARCHAR,
      publication_id VARCHAR,
      status VARCHAR,
      published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`
  );
  return dbConnection;
}

/**
 * Ingests and reconciles the build manifest CSV:
 * - Eliminates duplicate raw records across all attributes
 * - Applies withdrawal notices to cancel superseded builds
 * - Aggregates artifact counts and total file sizes for surviving bundles
 *
 * @param {duckdb.Database} dbConnection
 * @param {string} [manifestCsvPath=BUILD_MANIFEST_PATH]
 * @returns {Promise<Array<{bundle_id: string, artifact_count: number, total_bytes: number}>>}
 */
export async function reconcileBuildManifest(dbConnection, manifestCsvPath = BUILD_MANIFEST_PATH) {
  const reconciledResults = await executeSqlQuery(
    dbConnection,
    `WITH raw_manifest AS (
      SELECT * FROM read_csv_auto('${manifestCsvPath}')
    ),
    deduped_records AS (
      SELECT DISTINCT * FROM raw_manifest
    ),
    withdrawn_entries AS (
      SELECT supersedes_id
      FROM deduped_records
      WHERE record_type = 'WITHDRAWAL' AND supersedes_id IS NOT NULL
    ),
    active_builds AS (
      SELECT *
      FROM deduped_records
      WHERE record_type = 'BUILD'
        AND entry_id NOT IN (SELECT supersedes_id FROM withdrawn_entries)
    )
    SELECT
      bundle_id,
      COUNT(*)::INTEGER AS artifact_count,
      SUM(size_bytes)::BIGINT AS total_bytes
    FROM active_builds
    GROUP BY bundle_id
    ORDER BY bundle_id ASC;`
  );
  return reconciledResults;
}

/**
 * Looks up a previous publication receipt by bundle ID for idempotent execution.
 *
 * @param {duckdb.Database} dbConnection
 * @param {string} bundleId
 * @returns {Promise<{publication_id: string, request_token: string, status: string} | null>}
 */
export async function findStoredPublication(dbConnection, bundleId) {
  const matchingRows = await executeSqlQuery(
    dbConnection,
    `SELECT publication_id, request_token, status FROM publications WHERE bundle_id = '${bundleId}';`
  );
  return matchingRows.length > 0 ? matchingRows[0] : null;
}

/**
 * Persists a new publication receipt record in DuckDB.
 *
 * @param {duckdb.Database} dbConnection
 * @param {string} bundleId
 * @param {string} requestToken
 * @param {string} publicationId
 * @param {string} status
 * @returns {Promise<void>}
 */
export async function persistPublicationReceipt(dbConnection, bundleId, requestToken, publicationId, status) {
  await executeSqlCommand(
    dbConnection,
    `INSERT INTO publications (bundle_id, request_token, publication_id, status)
     VALUES ('${bundleId}', '${requestToken}', '${publicationId}', '${status}');`
  );
}

