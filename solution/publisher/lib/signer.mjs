import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { CURRENT_CERT_PATH, CURRENT_KEY_PATH } from './config.mjs';

/**
 * Signs a canonical descriptor string using OpenSSL detached CMS with the specified keypair.
 *
 * @param {string} descriptorStr - Canonical JSON descriptor to sign.
 * @param {string} [certPath=CURRENT_CERT_PATH] - Path to X.509 signer certificate PEM.
 * @param {string} [keyPath=CURRENT_KEY_PATH] - Path to RSA private key PEM.
 * @returns {string} Detached PEM signature string.
 */
export function signDescriptor(descriptorStr, certPath = CURRENT_CERT_PATH, keyPath = CURRENT_KEY_PATH) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'signer-'));
  const descFile = path.join(scratch, 'descriptor.bin');
  try {
    fs.writeFileSync(descFile, Buffer.from(descriptorStr, 'utf8'));
    const sigPem = execFileSync(
      'openssl',
      [
        'cms',
        '-sign',
        '-in', descFile,
        '-signer', certPath,
        '-inkey', keyPath,
        '-outform', 'PEM',
        '-binary',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return sigPem.trim();
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}
