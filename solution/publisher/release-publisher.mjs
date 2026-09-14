
import { canonicalEncode } from './lib/canonical.mjs';
import { signDescriptor } from './lib/signer.mjs';
import { fetchSigningKeyMetadata, postPublication } from './lib/gateway.mjs';
import {
  initDatabase,
  reconcileManifest,
  getExistingPublication,
  savePublication,
} from './lib/db.mjs';

/**
 * Run the release publishing workflow.
 */
async function runPublisher() {
  const database = await initDatabase();

  // 1. Reconcile raw manifest entries into surviving release bundles
  const releaseBundles = await reconcileManifest(database);

  // 2. Discover active signing key metadata from distribution gateway
  const activeKeyMetadata = await fetchSigningKeyMetadata();
  const activeKeyId = activeKeyMetadata.key_id;

  // 3. Process each publishable release bundle in ascending order
  for (const releaseBundle of releaseBundles) {
    const releaseBundleId = releaseBundle.bundle_id;
    const publicationToken = `token-${releaseBundleId}`;

    let receiptId;
    let publicationStatus;

    // 4. Check local persistence for idempotent replay
    const storedPublication = await getExistingPublication(
      database,
      releaseBundleId
    );

    if (storedPublication) {
      receiptId = storedPublication.publication_id;
      publicationStatus = storedPublication.status;
    } else {
      // 5. Generate canonical JSON descriptor and sign with OpenSSL CMS
      const descriptorData = {
        artifact_count: Number(releaseBundle.artifact_count),
        bundle_id: releaseBundleId,
        total_bytes: Number(releaseBundle.total_bytes),
      };

      const canonicalDescriptor = canonicalEncode(descriptorData);
      const detachedSignature = signDescriptor(canonicalDescriptor);

      // 6. Submit signed publication to distribution gateway
      const publicationReceipt = await postPublication(
        canonicalDescriptor,
        detachedSignature,
        publicationToken
      );

      receiptId = publicationReceipt.publication_id;
      publicationStatus = publicationReceipt.status;

      // 7. Persist receipt to DuckDB for future idempotent runs
      await savePublication(
        database,
        releaseBundleId,
        publicationToken,
        receiptId,
        publicationStatus
      );
    }

    // 8. Emit deterministic output lines
    console.log(
      `BUNDLE ${releaseBundleId} SIGNED KEY=${activeKeyId}`
    );

    console.log(
      `BUNDLE ${releaseBundleId} PUBLISHED ` +
      `RECEIPT=${receiptId} ` +
      `TOKEN=${publicationToken} ` +
      `STATUS=${publicationStatus}`
    );
  }
}

runPublisher().catch((error) => {
  console.error(error);
  process.exit(1);
});

