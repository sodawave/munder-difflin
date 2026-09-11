/**
 * Device seal core (CJS) — X25519 ECDH + AES-256-GCM + Ed25519 signature.
 * Electron's bundled OpenSSL reports no ChaCha20-Poly1305 (openssl 0.0.0 /
 * BoringSSL subset); AES-256-GCM is available in both Node and Electron.
 *
 * Wire blob is base64(version || senderEdPub || ephX25519Pub || nonce || ciphertext||tag || sig).
 * Never log plaintext. Tests assert subject/body absent from the wire buffer.
 */
'use strict';

const crypto = require('node:crypto');

const VERSION = 2;
const ED_PUB_LEN = 32;
const X_PUB_LEN = 32;
const NONCE_LEN = 12;
const SIG_LEN = 64;
const HEADER_LEN = 1 + ED_PUB_LEN + X_PUB_LEN + NONCE_LEN;
const AEAD = 'aes-256-gcm';

/** @typedef {{ deviceId: string, ed25519: { publicKey: string, privateKey: string }, x25519: { publicKey: string, privateKey: string } }} DeviceIdentity */

function b64(buf) {
  return Buffer.from(buf).toString('base64');
}

function fromB64(s) {
  return Buffer.from(s, 'base64');
}

function generateDeviceIdentity() {
  const ed = crypto.generateKeyPairSync('ed25519');
  const x = crypto.generateKeyPairSync('x25519');
  const edPub = ed.publicKey.export({ type: 'spki', format: 'der' });
  // Raw 32-byte ed25519 public key is last 32 bytes of SPKI DER for this curve
  const edPubRaw = edPub.subarray(edPub.length - 32);
  const edPriv = ed.privateKey.export({ type: 'pkcs8', format: 'der' });
  const xPub = x.publicKey.export({ type: 'spki', format: 'der' });
  const xPubRaw = xPub.subarray(xPub.length - 32);
  const xPriv = x.privateKey.export({ type: 'pkcs8', format: 'der' });
  const deviceId = crypto.createHash('sha256').update(edPubRaw).digest('hex').slice(0, 16);
  return {
    deviceId,
    ed25519: { publicKey: b64(edPubRaw), privateKey: b64(edPriv) },
    x25519: { publicKey: b64(xPubRaw), privateKey: b64(xPriv) },
  };
}

function edPrivateKeyFromB64(pkcs8B64) {
  return crypto.createPrivateKey({ key: fromB64(pkcs8B64), format: 'der', type: 'pkcs8' });
}

function edPublicKeyFromRawB64(rawB64) {
  // SPKI prefix for Ed25519 + raw 32-byte key
  const prefix = Buffer.from('302a300506032b6570032100', 'hex');
  return crypto.createPublicKey({ key: Buffer.concat([prefix, fromB64(rawB64)]), format: 'der', type: 'spki' });
}

function xPrivateKeyFromB64(pkcs8B64) {
  return crypto.createPrivateKey({ key: fromB64(pkcs8B64), format: 'der', type: 'pkcs8' });
}

function xPublicKeyFromRawB64(rawB64) {
  const prefix = Buffer.from('302a300506032b656e032100', 'hex');
  return crypto.createPublicKey({ key: Buffer.concat([prefix, fromB64(rawB64)]), format: 'der', type: 'spki' });
}

/**
 * @param {Buffer|string|Uint8Array} plaintext
 * @param {string} recipientX25519PubB64 raw 32-byte pub
 * @param {DeviceIdentity} sender
 * @returns {string} base64 sealed blob
 */
function seal(plaintext, recipientX25519PubB64, sender) {
  const plain = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext);
  const eph = crypto.generateKeyPairSync('x25519');
  const recipientPub = xPublicKeyFromRawB64(recipientX25519PubB64);
  const shared = crypto.diffieHellman({ privateKey: eph.privateKey, publicKey: recipientPub });
  const ephPubDer = eph.publicKey.export({ type: 'spki', format: 'der' });
  const ephPubRaw = ephPubDer.subarray(ephPubDer.length - 32);
  const key = crypto.hkdfSync('sha256', shared, Buffer.alloc(0), Buffer.from('md-seal-v2'), 32);
  const nonce = crypto.randomBytes(NONCE_LEN);
  const cipher = crypto.createCipheriv(AEAD, Buffer.from(key), nonce, { authTagLength: 16 });
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([enc, tag]);
  const senderEdPub = fromB64(sender.ed25519.publicKey);
  const body = Buffer.concat([
    Buffer.from([VERSION]),
    senderEdPub,
    ephPubRaw,
    nonce,
    ciphertext,
  ]);
  const sig = crypto.sign(null, body, edPrivateKeyFromB64(sender.ed25519.privateKey));
  return b64(Buffer.concat([body, sig]));
}

/**
 * @param {string} sealedB64
 * @param {DeviceIdentity} recipient
 * @returns {{ plaintext: Buffer, senderEd25519PublicKey: string }}
 */
function unseal(sealedB64, recipient) {
  const blob = fromB64(sealedB64);
  if (blob.length < HEADER_LEN + 16 + SIG_LEN) throw new Error('sealed blob too short');
  const sig = blob.subarray(blob.length - SIG_LEN);
  const body = blob.subarray(0, blob.length - SIG_LEN);
  const version = body[0];
  if (version !== VERSION) throw new Error(`unsupported seal version ${version}`);
  const senderEdPub = body.subarray(1, 1 + ED_PUB_LEN);
  const ephPubRaw = body.subarray(1 + ED_PUB_LEN, 1 + ED_PUB_LEN + X_PUB_LEN);
  const nonce = body.subarray(1 + ED_PUB_LEN + X_PUB_LEN, HEADER_LEN);
  const ciphertext = body.subarray(HEADER_LEN);
  if (!crypto.verify(null, body, edPublicKeyFromRawB64(b64(senderEdPub)), sig)) {
    throw new Error('seal signature invalid');
  }
  const ephPub = xPublicKeyFromRawB64(b64(ephPubRaw));
  const shared = crypto.diffieHellman({
    privateKey: xPrivateKeyFromB64(recipient.x25519.privateKey),
    publicKey: ephPub,
  });
  const key = crypto.hkdfSync('sha256', shared, Buffer.alloc(0), Buffer.from('md-seal-v2'), 32);
  if (ciphertext.length < 16) throw new Error('ciphertext too short');
  const tag = ciphertext.subarray(ciphertext.length - 16);
  const enc = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = crypto.createDecipheriv(AEAD, Buffer.from(key), nonce, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(enc), decipher.final()]);
  return { plaintext, senderEd25519PublicKey: b64(senderEdPub) };
}

/** True if wire buffer (utf8 or base64 decode attempt) contains needle as utf8 substring. */
function wireContainsUtf8(wireB64, needle) {
  if (!needle) return false;
  const raw = fromB64(wireB64);
  return raw.includes(Buffer.from(String(needle), 'utf8'));
}

module.exports = {
  VERSION,
  AEAD,
  generateDeviceIdentity,
  seal,
  unseal,
  wireContainsUtf8,
  b64,
  fromB64,
};
