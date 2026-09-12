/**
 * Peer address + sync selection store (SPEC peer-harness-coop).
 * Lives under harnessHome/network/peers.json — no absolute harness paths on the wire.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PEERS_FILE = 'peers.json';
/** Hard limits — prevent runaway paste / peer lists from freezing the UI. */
const MAX_CARD_CHARS = 8 * 1024;
const MAX_PEERS = 8;
const MAX_AGENT_IDS = 64;
const MAX_ID_LEN = 64;
const MAX_LABEL_LEN = 64;
const MAX_KEY_LEN = 128;

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
        .slice(0, MAX_PEERS)
        .map((p) => ({
          deviceId: String(p.deviceId).slice(0, MAX_ID_LEN),
          mqttUrl: typeof p.mqttUrl === 'string' ? p.mqttUrl.slice(0, 512) : '',
          x25519PublicKey: String(p.x25519PublicKey).slice(0, MAX_KEY_LEN),
          ed25519PublicKey: typeof p.ed25519PublicKey === 'string' ? p.ed25519PublicKey.slice(0, MAX_KEY_LEN) : '',
          envLabel: typeof p.envLabel === 'string' ? p.envLabel.slice(0, MAX_LABEL_LEN) : '',
          followAgentIds: Array.isArray(p.followAgentIds)
            ? p.followAgentIds
                .filter((id) => typeof id === 'string')
                .map((id) => String(id).slice(0, MAX_ID_LEN))
                .slice(0, MAX_AGENT_IDS)
            : [],
        }))
    : [];
  return {
    v: 1,
    peers,
    publishAgentIds: Array.isArray(raw.publishAgentIds)
      ? raw.publishAgentIds
          .filter((id) => typeof id === 'string')
          .map((id) => String(id).slice(0, MAX_ID_LEN))
          .slice(0, MAX_AGENT_IDS)
      : [],
    envLabel: typeof raw.envLabel === 'string' ? raw.envLabel.slice(0, MAX_LABEL_LEN) : '',
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
    if (raw.length > MAX_CARD_CHARS) {
      return { ok: false, error: `card too large (max ${MAX_CARD_CHARS} chars)` };
    }
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
  const deviceId = String(obj.deviceId).trim().slice(0, MAX_ID_LEN);
  const x25519PublicKey = String(obj.x25519PublicKey).trim().slice(0, MAX_KEY_LEN);
  const ed25519PublicKey =
    typeof obj.ed25519PublicKey === 'string' ? obj.ed25519PublicKey.trim().slice(0, MAX_KEY_LEN) : '';
  if (!deviceId || !x25519PublicKey) return { ok: false, error: 'deviceId and x25519PublicKey required' };
  return {
    ok: true,
    card: {
      v: 1,
      mqttUrl: typeof obj.mqttUrl === 'string' ? obj.mqttUrl.trim().slice(0, 512) : '',
      deviceId,
      x25519PublicKey,
      ed25519PublicKey,
      envLabel: typeof obj.envLabel === 'string' ? obj.envLabel.trim().slice(0, MAX_LABEL_LEN) : '',
    },
  };
}

/** True when the card is this install (by device id or either public key). */
function isSelfAddressCard(card, identity) {
  if (!card || !identity) return false;
  if (card.deviceId && card.deviceId === identity.deviceId) return true;
  if (card.x25519PublicKey && card.x25519PublicKey === identity.x25519?.publicKey) return true;
  if (card.ed25519PublicKey && identity.ed25519?.publicKey && card.ed25519PublicKey === identity.ed25519.publicKey) {
    return true;
  }
  return false;
}

/** Drop any peer rows that are this device (corrupt self-import). */
function scrubSelfPeers(store, identity) {
  if (!identity || !store || !Array.isArray(store.peers)) return store;
  const next = {
    ...store,
    peers: store.peers.filter(
      (p) =>
        p.deviceId !== identity.deviceId &&
        p.x25519PublicKey !== identity.x25519?.publicKey &&
        (!p.ed25519PublicKey || p.ed25519PublicKey !== identity.ed25519?.publicKey)
    ),
  };
  return next;
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
  isSelfAddressCard,
  scrubSelfPeers,
  MAX_CARD_CHARS,
  MAX_PEERS,
  MAX_AGENT_IDS,
};
