/** Typed façade over peersStore.cjs */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const core = require('./peersStore.cjs') as {
  loadPeersStore: (harnessHome: string | null) => PeersStore;
  savePeersStore: (harnessHome: string, store: PeersStore) => PeersStore;
  parseAddressCard: (raw: unknown) =>
    | { ok: true; card: AddressCard }
    | { ok: false; error: string };
  tintHueForDevice: (deviceId: string) => number;
  emptyStore: () => PeersStore;
  peersPath: (harnessHome: string) => string;
  isSelfAddressCard: (
    card: AddressCard,
    identity: { deviceId: string; x25519?: { publicKey: string }; ed25519?: { publicKey: string } }
  ) => boolean;
  scrubSelfPeers: (
    store: PeersStore,
    identity: { deviceId: string; x25519?: { publicKey: string }; ed25519?: { publicKey: string } }
  ) => PeersStore;
  MAX_CARD_CHARS: number;
  MAX_PEERS: number;
  MAX_AGENT_IDS: number;
};

export type PeerRecord = {
  deviceId: string;
  mqttUrl: string;
  x25519PublicKey: string;
  ed25519PublicKey: string;
  envLabel: string;
  followAgentIds: string[];
};

export type PeersStore = {
  v: 1;
  peers: PeerRecord[];
  publishAgentIds: string[];
  envLabel: string;
};

export type AddressCard = {
  v: 1;
  mqttUrl: string;
  deviceId: string;
  x25519PublicKey: string;
  ed25519PublicKey: string;
  envLabel: string;
};

export function loadPeersStore(harnessHome: string | null): PeersStore {
  return core.loadPeersStore(harnessHome);
}

export function savePeersStore(harnessHome: string, store: PeersStore): PeersStore {
  return core.savePeersStore(harnessHome, store);
}

export function parseAddressCard(raw: unknown):
  | { ok: true; card: AddressCard }
  | { ok: false; error: string } {
  return core.parseAddressCard(raw);
}

export function tintHueForDevice(deviceId: string): number {
  return core.tintHueForDevice(deviceId);
}

export function emptyPeersStore(): PeersStore {
  return core.emptyStore();
}

export function isSelfAddressCard(
  card: AddressCard,
  identity: { deviceId: string; x25519?: { publicKey: string }; ed25519?: { publicKey: string } }
): boolean {
  return core.isSelfAddressCard(card, identity);
}

export function scrubSelfPeers(
  store: PeersStore,
  identity: { deviceId: string; x25519?: { publicKey: string }; ed25519?: { publicKey: string } }
): PeersStore {
  return core.scrubSelfPeers(store, identity);
}

export const MAX_CARD_CHARS = core.MAX_CARD_CHARS;
export const MAX_PEERS = core.MAX_PEERS;
export const MAX_AGENT_IDS = core.MAX_AGENT_IDS;
