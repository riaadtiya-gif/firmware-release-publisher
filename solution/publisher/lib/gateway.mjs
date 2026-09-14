import { DISTRIBUTION_GATEWAY_URL } from './config.mjs';

/**
 * Retrieves the active signing key metadata from the distribution gateway.
 *
 * @returns {Promise<{key_id: string, algorithm: string, certificate_ref: string, status: string}>}
 */
export async function retrieveActiveSigningKeyMetadata() {
  const httpResponse = await fetch(`${DISTRIBUTION_GATEWAY_URL}/v1/signing-key/current`);
  if (!httpResponse.ok) {
    throw new Error(`Failed to retrieve active signing key: HTTP ${httpResponse.status} ${httpResponse.statusText}`);
  }
  return await httpResponse.json();
}

/**
 * Dispatches a signed publication request to the distribution gateway.
 *
 * @param {string} canonicalDescriptor - Formatted canonical JSON descriptor.
 * @param {string} detachedSignature - Detached OpenSSL CMS signature in PEM format.
 * @param {string} idempotencyToken - Client-supplied deterministic request token.
 * @returns {Promise<{publication_id: string, request_token: string, status: string}>}
 */
export async function submitPublicationPayload(canonicalDescriptor, detachedSignature, idempotencyToken) {
  const httpResponse = await fetch(`${DISTRIBUTION_GATEWAY_URL}/v1/publications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      descriptor: canonicalDescriptor,
      signature: detachedSignature,
      request_token: idempotencyToken,
    }),
  });

  const responseBody = await httpResponse.json();
  if (!httpResponse.ok) {
    throw new Error(`Publication rejected (HTTP ${httpResponse.status}): ${JSON.stringify(responseBody)}`);
  }
  return responseBody;
}

