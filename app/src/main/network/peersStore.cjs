/**
 * Peer address + sync selection store (SPEC peer-harness-coop).
 * Lives under harnessHome/network/peers.json — no absolute harness paths on the wire.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PEERS_FILE = 'peers.json';

function peersPath(harnessHome) {
  return path.join(harnessHome, 'network', PEERS_FILE);
}

function emptyStore() {
  return { v: 1, peers: [], publishAgentIds: [], envLabel: '' };
}

function normalizeStore(raw) {
  const base = emptyStore();
  if (!raw || typeof raw !== 'object') return base;
  const peers = Array.isArray(raw.peers)
    ? raw.peers
        .filter((p) => p && typeof p.deviceId === 'string' && typeof p.x25519PublicKey === 'string')
        .map((p) => ({
          deviceId: String(p.deviceId),
          mqttUrl: typeof p.mqttUrl === 'string' ? p.mqttUrl : '',
          x25519PublicKey: String(p.x25519PublicKey),
          ed25519PublicKey: typeof p.ed25519PublicKey === 'string' ? p.ed25519PublicKey : '',
          envLabel: typeof p.envLabel === 'string' ? p.envLabel : '',
          followAgentIds: Array.isArray(p.followAgentIds)
            ? p.followAgentIds.filter((id) => typeof id === 'string')
            : [],
        }))
    : [];
  return {
    v: 1,
    peers,
    publishAgentIds: Array.isArray(raw.publishAgentIds)
      ? raw.publishAgentIds.filter((id) => typeof id === 'string')
      : [],
    envLabel: typeof raw.envLabel === 'string' ? raw.envLabel : '',
  };
}

function loadPeersStore(harnessHome) {
  if (!harnessHome) return emptyStore();
  const p = peersPath(harnessHome);
  try {
    if (!fs.existsSync(p)) return emptyStore();
    return normalizeStore(JSON.parse(fs.readFileSync(p, 'utf8')));
  } catch {
    return emptyStore();
  }
}

function savePeersStore(harnessHome, store) {
  if (!harnessHome) throw new Error('harness home required');
  const normalized = normalizeStore(store);
  const dir = path.join(harnessHome, 'network');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(peersPath(harnessHome), JSON.stringify(normalized, null, 2));
  return normalized;
}

/**
 * Validate an imported address card (v1).
 * @returns {{ ok: true, card } | { ok: false, error: string }}
 */
function parseAddressCard(raw) {
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return { ok: false, error: 'invalid JSON' };
    }
  }
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'card required' };
  if (obj.v !== 1 && obj.v !== undefined) return { ok: false, error: 'unsupported card version' };
  if (typeof obj.deviceId !== 'string' || !obj.deviceId.trim()) {
    return { ok: false, error: 'deviceId required' };
  }
  if (typeof obj.x25519PublicKey !== 'string' || !obj.x25519PublicKey.trim()) {
    return { ok: false, error: 'x25519PublicKey required' };
  }
  return {
    ok: true,
    card: {
      v: 1,
      mqttUrl: typeof obj.mqttUrl === 'string' ? obj.mqttUrl : '',
      deviceId: String(obj.deviceId).trim(),
      x25519PublicKey: String(obj.x25519PublicKey).trim(),
      ed25519PublicKey: typeof obj.ed25519PublicKey === 'string' ? obj.ed25519PublicKey.trim() : '',
      envLabel: typeof obj.envLabel === 'string' ? obj.envLabel.trim() : '',
    },
  };
}

/** Stable tint hue 0–359 from deviceId. */
function tintHueForDevice(deviceId) {
  const s = String(deviceId || 'x');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

module.exports = {
  peersPath,
  emptyStore,
  loadPeersStore,
  savePeersStore,
  parseAddressCard,
  tintHueForDevice,
  normalizeStore,
};
