import path from 'node:path';

export const DISTRIBUTION_GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:7070';
export const ACTIVE_SIGNING_CERT = process.env.CURRENT_CERT_PATH || '/app/keys/current/current.cert.pem';
export const ACTIVE_SIGNING_KEY = process.env.CURRENT_KEY_PATH || '/app/keys/current/current.key.pem';
export const RELEASES_DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'releases.duckdb');
export const BUILD_MANIFEST_PATH = process.env.MANIFEST_PATH || path.resolve(process.cwd(), 'fixtures/build_manifest.csv');

