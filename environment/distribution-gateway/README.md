# Distribution Gateway

An Express service that exposes the active firmware code-signing key metadata and validates CMS-signed release descriptors from the release publisher.

---

## HTTP API Endpoints

### 1. Retrieve Active Signing Key
- **Method / Path**: `GET /v1/signing-key/current`
- **Response**:
  ```json
  {
    "key_id": "fw-signing-2026-current",
    "algorithm": "RSA-SHA256",
    "certificate_ref": "/app/keys/current/current.cert.pem",
    "status": "ACTIVE"
  }
  ```
- **Description**: Returns the active signing key identifier and certificate reference that clients must use to sign release descriptors.

### 2. Submit Release Publication
- **Method / Path**: `POST /v1/publications`
- **Request Body**:
  ```json
  {
    "descriptor": "<canonical release descriptor JSON string>",
    "signature": "<detached OpenSSL CMS signature in PEM format>",
    "request_token": "<client-supplied idempotency token>"
  }
  ```
- **Success Response (HTTP 200/201)**:
  ```json
  {
    "publication_id": "pub-BND-101",
    "request_token": "token-BND-101",
    "status": "PUBLISHED"
  }
  ```
- **Rejection Response (HTTP 400)**:
  ```json
  {
    "error": "UNTRUSTED_SIGNATURE",
    "message": "Signature verification against current trust anchor failed."
  }
  ```

---

## Signature Verification

The distribution gateway validates detached signatures by executing OpenSSL CMS verification:

```bash
openssl cms -verify -inform PEM -in <signature.pem> -content <descriptor.bin> \
  -certfile $CURRENT_CERT_PATH -CAfile $CURRENT_CERT_PATH \
  -purpose any -no_check_time -binary
```

- Because the active certificate is self-signed, it acts as both the signer certificate and the root trust anchor.
- `CURRENT_CERT_PATH` defaults to `/app/keys/current/current.cert.pem` inside the container.

---

## Local Service Execution & Tests

```bash
# Start the gateway server (default port: 7070)
node server.js

# Run gateway test suite (Node >= 18)
node --test tests/
```

