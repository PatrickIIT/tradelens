// backend/src/utils/hash.js
const crypto = require('crypto');

// ─── generateHash ─────────────────────────────────────────────────────────────
// Creates a SHA-256 hex digest of any string payload.
// Called by certificateService.generateCertificate() when issuing a certificate.
//
// Usage:
//   const hash = generateHash(JSON.stringify(payload));
const generateHash = (data) => {
  if (!data || typeof data !== 'string') {
    throw new Error('[hash.js] generateHash: input must be a non-empty string.');
  }
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
};

// ─── verifyHash ───────────────────────────────────────────────────────────────
// Re-hashes the decoded QR payload (without the embedded hash field) and
// compares it against the stored sha256_hash from the certificates table.
// Called by verify.js on every QR scan at the border checkpoint (BR-03, US-05).
//
// Returns true  → payload is intact, certificate is genuine
// Returns false → hash mismatch, tamper detected → log + alert officer
//
// Usage:
//   const intact = verifyHash(decodedPayload, certificate.sha256_hash);
const verifyHash = (payload, storedHash) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('[hash.js] verifyHash: payload must be a non-null object.');
  }
  if (!storedHash || typeof storedHash !== 'string') {
    throw new Error('[hash.js] verifyHash: storedHash must be a non-empty string.');
  }

  // Strip the embedded sha256_hash field before re-hashing —
  // this mirrors exactly what generateCertificate() hashed originally.
  const { sha256_hash: _removed, ...payloadWithoutHash } = payload;

  const recomputed = generateHash(JSON.stringify(payloadWithoutHash));

  // Constant-time comparison prevents timing attacks
  const recomputedBuf = Buffer.from(recomputed,  'hex');
  const storedBuf     = Buffer.from(storedHash,  'hex');

  if (recomputedBuf.length !== storedBuf.length) return false;

  return crypto.timingSafeEqual(recomputedBuf, storedBuf);
};

// ─── hashFile ─────────────────────────────────────────────────────────────────
// Generates a SHA-256 hash of a file buffer (e.g. uploaded PDF or image).
// Can be used by documents.js to fingerprint uploaded files for integrity
// logging in the verification_log metadata.
//
// Usage:
//   const fileHash = hashFile(req.file.buffer);
const hashFile = (buffer) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('[hash.js] hashFile: input must be a Buffer.');
  }
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  generateHash,
  verifyHash,
  hashFile,
};
