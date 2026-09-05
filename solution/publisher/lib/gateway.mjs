import { GATEWAY_URL } from './config.mjs';

/**
 * Retrieves the currently active signing key metadata from the distribution gateway.
 *
 * @returns {Promise<{key_id: string, algorithm: string, certificate_ref: string, status: string}>}
 */
export async function fetchSigningKeyMetadata() {
  const res = await fetch(`${GATEWAY_URL}/v1/signing-key/current`);
  if (!res.ok) {
    throw new Error(`Failed to fetch current signing key: ${res.statusText}`);
  }
  return await res.json();
}

/**
 * Submits a signed release bundle publication request to the distribution gateway.
 *
 * @param {string} descriptorStr - Canonical descriptor JSON.
 * @param {string} signaturePem - Detached OpenSSL CMS signature in PEM format.
 * @param {string} requestToken - Deterministic idempotency token.
 * @returns {Promise<{publication_id: string, request_token: string, status: string}>}
 */
export async function postPublication(descriptorStr, signaturePem, requestToken) {
  const res = await fetch(`${GATEWAY_URL}/v1/publications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      descriptor: descriptorStr,
      signature: signaturePem,
      request_token: requestToken,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Publication rejected (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}
