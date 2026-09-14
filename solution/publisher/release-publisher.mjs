
import { serializeCanonicalDescriptor } from './lib/canonical.mjs';
import { generateDetachedCmsSignature } from './lib/signer.mjs';
import {
  retrieveActiveSigningKeyMetadata,
  submitPublicationPayload,
} from './lib/gateway.mjs';
import {
  initializeReleasesDb,
  reconcileBuildManifest,
  findStoredPublication,
  persistPublicationReceipt,
} from './lib/db.mjs';

/**
 * Executes the end-to-end firmware release publishing workflow.
 */
async function publishReleaseBundles() {
  const dbConnection = await initializeReleasesDb();

  // 1. Reconcile raw manifest records and identify publishable bundles
  const reconciledBundles = await reconcileBuildManifest(dbConnection);

  // 2. Query distribution gateway for the currently active signing key ID
  const activeSigningMetadata = await retrieveActiveSigningKeyMetadata();
  const currentKeyIdentifier = activeSigningMetadata.key_id;

  // 3. Process each publishable release bundle in ascending order
  for (const bundle of reconciledBundles) {
    const bundleIdentifier = bundle.bundle_id;
    const requestToken = `token-${bundleIdentifier}`;

    let receiptIdentifier;
    let finalStatus;

    // 4. Check for prior publication record in DuckDB for idempotency
    const existingPublication = await findStoredPublication(
      dbConnection,
      bundleIdentifier
    );

    if (existingPublication) {
      receiptIdentifier = existingPublication.publication_id;
      finalStatus = existingPublication.status;
    } else {
      // 5. Build canonical descriptor and generate detached CMS signature
      const bundleDescriptor = {
        artifact_count: Number(bundle.artifact_count),
        bundle_id: bundleIdentifier,
        total_bytes: Number(bundle.total_bytes),
      };

      const canonicalPayload = serializeCanonicalDescriptor(bundleDescriptor);
      const cmsSignature = generateDetachedCmsSignature(canonicalPayload);

      // 6. Submit signed payload to the distribution gateway
      const publicationResult = await submitPublicationPayload(
        canonicalPayload,
        cmsSignature,
        requestToken
      );

      receiptIdentifier = publicationResult.publication_id;
      finalStatus = publicationResult.status;

      // 7. Save publication receipt in DuckDB
      await persistPublicationReceipt(
        dbConnection,
        bundleIdentifier,
        requestToken,
        receiptIdentifier,
        finalStatus
      );
    }

    // 8. Output deterministic status lines
    console.log(`BUNDLE ${bundleIdentifier} SIGNED KEY=${currentKeyIdentifier}`);
    console.log(
      `BUNDLE ${bundleIdentifier} PUBLISHED ` +
      `RECEIPT=${receiptIdentifier} ` +
      `TOKEN=${requestToken} ` +
      `STATUS=${finalStatus}`
    );
  }
}

publishReleaseBundles().catch((err) => {
  console.error(err);
  process.exit(1);
});


