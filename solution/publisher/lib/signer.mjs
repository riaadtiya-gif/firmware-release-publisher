import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ACTIVE_SIGNING_CERT, ACTIVE_SIGNING_KEY } from './config.mjs';

/**
 * Generates a detached OpenSSL CMS signature for canonical descriptor payload.
 *
 * @param {string} payloadContent - Exact canonical JSON string to sign.
 * @param {string} [certificatePath=ACTIVE_SIGNING_CERT] - Path to signer X.509 certificate.
 * @param {string} [privateKeyPath=ACTIVE_SIGNING_KEY] - Path to private key PEM.
 * @returns {string} Formatted PEM detached signature.
 */
export function generateDetachedCmsSignature(
  payloadContent,
  certificatePath = ACTIVE_SIGNING_CERT,
  privateKeyPath = ACTIVE_SIGNING_KEY
) {
  const temporaryWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-signer-'));
  const inputBinaryFile = path.join(temporaryWorkspace, 'payload.bin');

  try {
    fs.writeFileSync(inputBinaryFile, Buffer.from(payloadContent, 'utf8'));

    const opensslOutput = execFileSync(
      'openssl',
      [
        'cms',
        '-sign',
        '-in', inputBinaryFile,
        '-signer', certificatePath,
        '-inkey', privateKeyPath,
        '-outform', 'PEM',
        '-binary',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );

    return opensslOutput.trim();
  } finally {
    fs.rmSync(temporaryWorkspace, { recursive: true, force: true });
  }
}

