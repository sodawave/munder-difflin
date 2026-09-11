/**
 * Typed façade over deviceSealCore.cjs for Electron main.
 * Keys persist under a path chosen by the caller (harnessHome or userData) — never in git.
 * AEAD is AES-256-GCM (Electron OpenSSL has no ChaCha20-Poly1305).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Same pattern as knowledge.ts / slack.ts — works under electron-vite and load-ts tests.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const core = require('./deviceSealCore.cjs') as {
  generateDeviceIdentity: () => DeviceIdentity;
  seal: (plaintext: Buffer | string, recipientX25519PubB64: string, sender: DeviceIdentity) => string;
  unseal: (sealedB64: string, recipient: DeviceIdentity) => { plaintext: Buffer; senderEd25519PublicKey: string };
  wireContainsUtf8: (wireB64: string, needle: string) => boolean;
};

export interface DeviceIdentity {
  deviceId: string;
  ed25519: { publicKey: string; privateKey: string };
  x25519: { publicKey: string; privateKey: string };
}

export function generateDeviceIdentity(): DeviceIdentity {
  return core.generateDeviceIdentity();
}

export function seal(
  plaintext: Buffer | string,
  recipientX25519PubB64: string,
  sender: DeviceIdentity
): string {
  return core.seal(plaintext, recipientX25519PubB64, sender);
}

export function unseal(
  sealedB64: string,
  recipient: DeviceIdentity
): { plaintext: Buffer; senderEd25519PublicKey: string } {
  return core.unseal(sealedB64, recipient);
}

export function wireContainsUtf8(wireB64: string, needle: string): boolean {
  return core.wireContainsUtf8(wireB64, needle);
}

export function identityPath(dir: string): string {
  return join(dir, 'network', 'device-identity.json');
}

/** Load or create durable device identity under `dir/network/`. */
export function loadOrCreateDeviceIdentity(dir: string): DeviceIdentity {
  const p = identityPath(dir);
  if (existsSync(p)) {
    const raw = JSON.parse(readFileSync(p, 'utf8')) as DeviceIdentity;
    if (raw?.deviceId && raw.ed25519?.privateKey && raw.x25519?.privateKey) return raw;
  }
  const id = generateDeviceIdentity();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(id, null, 2));
  return id;
}

export function publicBundle(id: DeviceIdentity): {
  deviceId: string;
  ed25519PublicKey: string;
  x25519PublicKey: string;
} {
  return {
    deviceId: id.deviceId,
    ed25519PublicKey: id.ed25519.publicKey,
    x25519PublicKey: id.x25519.publicKey,
  };
}
