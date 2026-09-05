import { canonicalEncode } from './lib/canonical.mjs';
import { signDescriptor } from './lib/signer.mjs';
import {
  fetchSigningKeyMetadata,
  postPublication,
} from './lib/gateway.mjs';
import {
  initDatabase,
  reconcileManifest,
  savePublication,
  query,
} from './lib/db.mjs';

function createDescriptor(bundle) {
  return canonicalEncode({
    artifact_count: Number(bundle.artifact_count),
    bundle_id: bundle.bundle_id,
    total_bytes: Number(bundle.total_bytes),
  });
}

function createRequestToken(bundleId) {
  return `token-${bundleId}`;
}

function reportPublication(bundleId, keyId, publicationId, token, status) {
  console.log(
    `BUNDLE ${bundleId} SIGNED KEY=${keyId}`
  );

  console.log(
    `BUNDLE ${bundleId} PUBLISHED ` +
    `RECEIPT=${publicationId} ` +
    `TOKEN=${token} ` +
    `STATUS=${status}`
  );
}

async function loadExistingPublications(db) {
  const rows = await query(
    db,
    `SELECT bundle_id, publication_id, request_token, status FROM publications`
  );

  const byBundleId = new Map();
  for (const row of rows) {
    byBundleId.set(row.bundle_id, row);
  }
  return byBundleId;
}

async function planRelease(db) {
  const bundles = await reconcileManifest(db);
  const signingKey = await fetchSigningKeyMetadata();
  const existingPublications = await loadExistingPublications(db);

  return {
    bundles,
    signingKey,
    existingPublications,
  };
}

async function publishAndPersist(db, bundle, requestToken) {
  const descriptor = createDescriptor(bundle);
  const signature = await signDescriptor(descriptor);
  const receipt = await postPublication(
    descriptor,
    signature,
    requestToken
  );

  await savePublication(
    db,
    bundle.bundle_id,
    requestToken,
    receipt.publication_id,
    receipt.status
  );

  return receipt;
}

async function processBundle(db, bundle, keyId, existingPublications) {
  const bundleId = bundle.bundle_id;
  const requestToken = createRequestToken(bundleId);
  const previousPublication = existingPublications.get(bundleId);

  if (previousPublication) {
    reportPublication(
      bundleId,
      keyId,
      previousPublication.publication_id,
      requestToken,
      previousPublication.status
    );
    return;
  }

  const receipt = await publishAndPersist(db, bundle, requestToken);

  reportPublication(
    bundleId,
    keyId,
    receipt.publication_id,
    requestToken,
    receipt.status
  );
}

async function runPublisher() {
  const db = await initDatabase();
  const plan = await planRelease(db);

  for (const bundle of plan.bundles) {
    await processBundle(
      db,
      bundle,
      plan.signingKey.key_id,
      plan.existingPublications
    );
  }
}

runPublisher().catch((error) => {
  console.error(error);
  process.exit(1);
});
