/**
 * Additive sealed MQTT bridge + peer harness coop (SPEC mqtt-additive-bridge + peer-harness-coop).
 * Does not modify HiveManager routing — inbound uses hive.send only.
 */
import type { HiveManager, HiveMessage } from '../hive';
import { canUse, getEntitlementSnapshot } from '../entitlements';
import {
  loadOrCreateDeviceIdentity,
  publicBundle,
  seal,
  unseal,
  type DeviceIdentity,
} from './deviceSeal';
import { NetworkMqttClient, defaultBrokerUrl } from './mqttClient';
import {
  agentInboxTopic,
  agentInboxWildcard,
  peerInboxTopic,
  rosterTopic,
} from './topics';
import {
  isSelfAddressCard,
  loadPeersStore,
  parseAddressCard,
  savePeersStore,
  scrubSelfPeers,
  tintHueForDevice,
  MAX_AGENT_IDS,
  MAX_PEERS,
  type AddressCard,
  type PeerRecord,
  type PeersStore,
} from './peersStore';

export type AgentKnowhowCard = {
  agentId: string;
  name: string;
  role: string;
  caps: string[];
  isGod: boolean;
  deviceId: string;
  peerLabel: string;
};

export type RosterPayload = {
  v: 1;
  deviceId: string;
  envLabel: string;
  agents: AgentKnowhowCard[];
};

export type FollowedRemote = AgentKnowhowCard & {
  tintHue: number;
  x25519PublicKey: string;
};

export type SyncState = {
  canNetwork: boolean;
  connected: boolean;
  addressCard: AddressCard | null;
  envLabel: string;
  publishAgentIds: string[];
  localAgents: Array<{ id: string; name: string; role: string; isGod: boolean }>;
  peers: PeerRecord[];
  followed: FollowedRemote[];
  peerRosters: Record<string, RosterPayload>;
};

export type BridgeDeps = {
  /** Directory for device-identity.json + peers.json (typically harnessHome). */
  identityDir: () => string | null;
  hive: () => HiveManager;
  /** Injected for tests; defaults to entitlements.canUse('network'). */
  canNetwork?: () => boolean;
  /** Topic namespace (org or local); defaults to entitlement orgId or local. */
  orgId?: () => string;
  /** Injected broker URL; defaults to MD_MQTT_URL / localhost. */
  brokerUrl?: () => string;
  /** Push sync state to renderer. */
  emit?: (channel: string, payload: unknown) => void;
};

export class NetworkBridge {
  private mqtt: NetworkMqttClient | null = null;
  private identity: DeviceIdentity | null = null;
  private readonly seenIds = new Set<string>();
  private running = false;
  /** True once start() attempted a client (for CAP-3 assertions). */
  private connectAttempted = false;
  /** Last roster seen per peer deviceId. */
  private peerRosters = new Map<string, RosterPayload>();

  constructor(private readonly deps: BridgeDeps) {}

  /** Whether sync/start would open MQTT (CAP-3). */
  isNetworkAllowed(): boolean {
    return this.deps.canNetwork ? this.deps.canNetwork() : canUse('network');
  }

  /** Public for tests / CAP-3 evidence. */
  didAttemptConnect(): boolean {
    return this.connectAttempted;
  }

  get connected(): boolean {
    return !!this.mqtt?.connected;
  }

  /** Wait until MQTT is up (tests / callers that need CAP-1 readiness). */
  whenConnected(timeoutMs = 10_000): Promise<void> {
    this.sync();
    if (!this.mqtt) return Promise.reject(new Error('mqtt not started (network gated?)'));
    return this.mqtt.whenConnected(timeoutMs);
  }

  /** Public device bundle for peer exchange (no private keys). */
  getPublicBundle(): ReturnType<typeof publicBundle> | null {
    const id = this.ensureIdentity();
    return id ? publicBundle(id) : null;
  }

  /** Boss address card for Sync screen copy/export. */
  getAddressCard(): AddressCard | null {
    const id = this.ensureIdentity();
    if (!id) return null;
    const store = this.readStore();
    return {
      v: 1,
      mqttUrl: this.resolveBrokerUrl(),
      deviceId: id.deviceId,
      x25519PublicKey: id.x25519.publicKey,
      ed25519PublicKey: id.ed25519.publicKey,
      envLabel: store.envLabel || '',
    };
  }

  getSyncState(): SyncState {
    const store = this.readStore();
    this.ensureDefaultPublish(store);
    const id = this.ensureIdentity();
    const localAgents = this.listLocalAgents();
    const followed: FollowedRemote[] = [];
    for (const peer of store.peers) {
      const roster = this.peerRosters.get(peer.deviceId);
      const hue = tintHueForDevice(peer.deviceId);
      const follow = new Set(peer.followAgentIds);
      if (roster) {
        for (const card of roster.agents) {
          if (!follow.has(card.agentId)) continue;
          followed.push({
            ...card,
            tintHue: hue,
            x25519PublicKey: peer.x25519PublicKey,
          });
        }
      }
    }
    return {
      canNetwork: this.isNetworkAllowed(),
      connected: this.connected,
      addressCard: this.getAddressCard(),
      envLabel: store.envLabel,
      publishAgentIds: store.publishAgentIds,
      localAgents,
      peers: store.peers,
      followed,
      peerRosters: Object.fromEntries(this.peerRosters),
    };
  }

  importPeer(raw: unknown): { ok: boolean; error?: string } {
    const parsed = parseAddressCard(raw);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const dir = this.deps.identityDir();
    if (!dir) return { ok: false, error: 'harness home required' };
    const me = this.ensureIdentity();
    if (!me) return { ok: false, error: 'device identity unavailable' };
    if (isSelfAddressCard(parsed.card, me)) {
      return {
        ok: false,
        error: 'that is this harness’s own address card — paste a peer’s card instead',
      };
    }
    const store = this.readStore();
    if (store.peers.length >= MAX_PEERS && !store.peers.some((p) => p.deviceId === parsed.card.deviceId)) {
      return { ok: false, error: `peer limit reached (max ${MAX_PEERS})` };
    }
    const existing = store.peers.find((p) => p.deviceId === parsed.card.deviceId);
    const followAgentIds = existing?.followAgentIds?.length
      ? existing.followAgentIds.slice(0, MAX_AGENT_IDS)
      : [];
    const nextPeer: PeerRecord = {
      deviceId: parsed.card.deviceId,
      mqttUrl: parsed.card.mqttUrl,
      x25519PublicKey: parsed.card.x25519PublicKey,
      ed25519PublicKey: parsed.card.ed25519PublicKey,
      envLabel: parsed.card.envLabel,
      followAgentIds,
    };
    store.peers = [
      ...store.peers.filter((p) => p.deviceId !== nextPeer.deviceId),
      nextPeer,
    ].slice(0, MAX_PEERS);
    savePeersStore(dir, store);
    this.sync();
    // Never subscribe to our own roster topic
    if (this.mqtt && nextPeer.deviceId !== me.deviceId) {
      this.mqtt.subscribe(rosterTopic(this.resolveOrgId(), nextPeer.deviceId));
    }
    this.publishRoster();
    this.emitSync();
    return { ok: true };
  }

  removePeer(deviceId: string): { ok: boolean; error?: string } {
    const dir = this.deps.identityDir();
    if (!dir) return { ok: false, error: 'harness home required' };
    const store = this.readStore();
    store.peers = store.peers.filter((p) => p.deviceId !== deviceId);
    this.peerRosters.delete(deviceId);
    savePeersStore(dir, store);
    this.emitSync();
    return { ok: true };
  }

  setPublishAgentIds(ids: string[]): { ok: boolean; error?: string } {
    const dir = this.deps.identityDir();
    if (!dir) return { ok: false, error: 'harness home required' };
    const store = this.readStore();
    store.publishAgentIds = [...new Set(ids.filter((x) => typeof x === 'string'))].slice(0, MAX_AGENT_IDS);
    savePeersStore(dir, store);
    this.publishRoster();
    this.emitSync();
    return { ok: true };
  }

  setFollowAgentIds(peerDeviceId: string, ids: string[]): { ok: boolean; error?: string } {
    const dir = this.deps.identityDir();
    if (!dir) return { ok: false, error: 'harness home required' };
    const me = this.ensureIdentity();
    if (me && peerDeviceId === me.deviceId) {
      return { ok: false, error: 'cannot follow this harness as a peer' };
    }
    const store = this.readStore();
    const peer = store.peers.find((p) => p.deviceId === peerDeviceId);
    if (!peer) return { ok: false, error: 'peer not found' };
    peer.followAgentIds = [...new Set(ids.filter((x) => typeof x === 'string'))].slice(0, MAX_AGENT_IDS);
    savePeersStore(dir, store);
    this.emitSync();
    return { ok: true };
  }

  setEnvLabel(label: string): { ok: boolean; error?: string } {
    const dir = this.deps.identityDir();
    if (!dir) return { ok: false, error: 'harness home required' };
    const store = this.readStore();
    store.envLabel = String(label || '').slice(0, 64);
    savePeersStore(dir, store);
    this.publishRoster();
    this.emitSync();
    return { ok: true };
  }

  /** Start or stop MQTT according to canNetwork (CAP-3). */
  sync(): void {
    const allowed = this.isNetworkAllowed();
    if (allowed && !this.running) this.start();
    else if (!allowed && this.running) this.stop();
    else if (allowed && this.running) {
      // Refresh peer roster subscriptions only — do not republish on every
      // Settings refresh (that froze the UI when toggling share checkboxes).
      this.subscribePeerRosters();
    }
  }

  stop(): void {
    this.running = false;
    this.mqtt?.stop();
    this.mqtt = null;
  }

  /**
   * Seal + publish to peer agent inbox (preferred) or legacy device inbox.
   */
  sendRemote(opts: {
    peerDeviceId: string;
    peerX25519PublicKey: string;
    orgId?: string;
    /** Target agent on peer machine; defaults to message.to or god. */
    agentId?: string;
    message: Partial<HiveMessage>;
  }): { ok: boolean; error?: string; sealedBytes?: number } {
    if (!this.isNetworkAllowed()) {
      return { ok: false, error: 'network not entitled (Teams + networkEnabled required)' };
    }
    const id = this.ensureIdentity();
    if (!id) return { ok: false, error: 'device identity unavailable (set harness home)' };
    this.sync();
    if (!this.mqtt?.connected) {
      return { ok: false, error: 'mqtt not connected (is the broker up? MD_MQTT_URL)' };
    }
    const orgId = opts.orgId || this.resolveOrgId();
    const toAgent =
      (typeof opts.agentId === 'string' && opts.agentId) ||
      (typeof opts.message.to === 'string' && opts.message.to) ||
      'god';
    const topic = agentInboxTopic(orgId, opts.peerDeviceId, toAgent);
    const payload = {
      id: opts.message.id,
      conversation: opts.message.conversation ?? '',
      in_reply_to: opts.message.in_reply_to ?? null,
      from: opts.message.from ?? 'remote',
      to: toAgent,
      act: opts.message.act ?? 'inform',
      subject: opts.message.subject ?? '',
      body: opts.message.body ?? '',
      hops: opts.message.hops ?? 0,
      requires_reply: opts.message.requires_reply ?? false,
      needs_human: opts.message.needs_human ?? false,
      created_at: opts.message.created_at ?? new Date().toISOString(),
    };
    const sealed = seal(JSON.stringify(payload), opts.peerX25519PublicKey, id);
    const ok = this.mqtt.publish(topic, sealed);
    if (!ok) return { ok: false, error: 'mqtt publish failed' };
    return { ok: true, sealedBytes: Buffer.byteLength(sealed, 'utf8') };
  }

  /** Publish knowhow cards for publishAgentIds (tests / manual refresh). */
  publishRoster(): void {
    if (!this.isNetworkAllowed() || !this.mqtt?.connected) return;
    const id = this.ensureIdentity();
    if (!id) return;
    const store = this.readStore();
    this.ensureDefaultPublish(store);
    const cards = this.buildPublishCards(id.deviceId, store);
    const payload: RosterPayload = {
      v: 1,
      deviceId: id.deviceId,
      envLabel: store.envLabel || '',
      agents: cards,
    };
    this.mqtt.publish(rosterTopic(this.resolveOrgId(), id.deviceId), JSON.stringify(payload));
  }

  private resolveOrgId(): string {
    if (this.deps.orgId) return this.deps.orgId();
    const snap = getEntitlementSnapshot();
    return snap.state.orgId || 'local';
  }

  private resolveBrokerUrl(): string {
    if (this.deps.brokerUrl) return this.deps.brokerUrl();
    return defaultBrokerUrl();
  }

  private ensureIdentity(): DeviceIdentity | null {
    if (this.identity) return this.identity;
    const dir = this.deps.identityDir();
    if (!dir) return null;
    this.identity = loadOrCreateDeviceIdentity(dir);
    return this.identity;
  }

  private readStore(): PeersStore {
    const dir = this.deps.identityDir();
    let store = loadPeersStore(dir);
    const me = this.identity || (dir ? this.ensureIdentity() : null);
    if (me) {
      const scrubbed = scrubSelfPeers(store, me);
      if (scrubbed.peers.length !== store.peers.length && dir) {
        store = savePeersStore(dir, scrubbed);
      } else {
        store = scrubbed;
      }
    }
    return store;
  }

  private subscribePeerRosters(): void {
    if (!this.mqtt) return;
    const org = this.resolveOrgId();
    const me = this.ensureIdentity();
    for (const peer of this.readStore().peers) {
      if (me && peer.deviceId === me.deviceId) continue;
      this.mqtt.subscribe(rosterTopic(org, peer.deviceId));
    }
  }

  private ensureDefaultPublish(store: PeersStore): void {
    if (store.publishAgentIds.length > 0) return;
    const dir = this.deps.identityDir();
    if (!dir) return;
    try {
      const hive = this.deps.hive();
      if (!hive.enabled()) return;
      const reg = hive.registry();
      const godId = reg.godId;
      if (godId && reg.agents[godId] && !reg.agents[godId].archived) {
        store.publishAgentIds = [godId];
        savePeersStore(dir, store);
      }
    } catch {
      /* hive not ready */
    }
  }

  private listLocalAgents(): Array<{ id: string; name: string; role: string; isGod: boolean }> {
    try {
      const hive = this.deps.hive();
      if (!hive.enabled()) return [];
      const reg = hive.registry();
      return Object.values(reg.agents)
        .filter((a) => !a.archived)
        .map((a) => ({
          id: a.id,
          name: a.name,
          role: a.role || '',
          isGod: !!a.isGod || a.id === reg.godId,
        }));
    } catch {
      return [];
    }
  }

  private buildPublishCards(deviceId: string, store: PeersStore): AgentKnowhowCard[] {
    const publish = new Set(store.publishAgentIds);
    const label = store.envLabel || '';
    try {
      const hive = this.deps.hive();
      if (!hive.enabled()) return [];
      const reg = hive.registry();
      const out: AgentKnowhowCard[] = [];
      for (const a of Object.values(reg.agents)) {
        if (a.archived || !publish.has(a.id)) continue;
        const caps =
          Array.isArray(a.capabilities) && a.capabilities.length
            ? a.capabilities.map(String)
            : a.role
              ? [String(a.role)]
              : [];
        out.push({
          agentId: a.id,
          name: a.name,
          role: a.role || '',
          caps,
          isGod: !!a.isGod || a.id === reg.godId,
          deviceId,
          peerLabel: label,
        });
      }
      return out;
    } catch {
      return [];
    }
  }

  private emitSync(): void {
    try {
      this.deps.emit?.('network:syncState', this.getSyncState());
    } catch {
      /* renderer gone */
    }
  }

  private start(): void {
    const id = this.ensureIdentity();
    if (!id) {
      console.warn('[network-bridge] cannot start — no identity dir');
      return;
    }
    const orgId = this.resolveOrgId();
    const mqtt = new NetworkMqttClient(this.resolveBrokerUrl());
    this.mqtt = mqtt;
    this.running = true;
    this.connectAttempted = true;
    mqtt.start((t, payload) => this.onMqtt(t, payload));
    // Legacy device inbox + per-agent wildcard
    mqtt.subscribe(peerInboxTopic(orgId, id.deviceId));
    mqtt.subscribe(agentInboxWildcard(orgId, id.deviceId));
    this.subscribePeerRosters();
    console.log('[network-bridge] started; subscribed inbox + agents/+ + peer rosters');
    void mqtt.whenConnected(15_000).then(() => {
      this.publishRoster();
      this.emitSync();
    }).catch(() => { /* broker down */ });
  }

  private onMqtt(topic: string, payload: Buffer): void {
    if (topic.endsWith('/roster')) {
      this.onRoster(payload);
      return;
    }
    this.onSealedMail(topic, payload);
  }

  private onRoster(payload: Buffer): void {
    let data: RosterPayload;
    try {
      data = JSON.parse(payload.toString('utf8')) as RosterPayload;
    } catch {
      return;
    }
    if (!data || data.v !== 1 || typeof data.deviceId !== 'string' || !Array.isArray(data.agents)) {
      return;
    }
    const me = this.ensureIdentity();
    if (me && data.deviceId === me.deviceId) return;
    this.peerRosters.set(data.deviceId, data);
    // Default-follow god on first sight if follow list empty
    const dir = this.deps.identityDir();
    if (dir) {
      const store = this.readStore();
      const peer = store.peers.find((p) => p.deviceId === data.deviceId);
      if (peer && peer.followAgentIds.length === 0) {
        const god = data.agents.find((a) => a.isGod);
        if (god) {
          peer.followAgentIds = [god.agentId];
          peer.envLabel = peer.envLabel || data.envLabel || '';
          savePeersStore(dir, store);
        }
      }
    }
    this.emitSync();
  }

  private onSealedMail(topic: string, payload: Buffer): void {
    const id = this.ensureIdentity();
    if (!id) return;
    let sealed: string;
    try {
      sealed = payload.toString('utf8');
    } catch {
      return;
    }
    let plaintext: Buffer;
    try {
      ({ plaintext } = unseal(sealed, id));
    } catch (e) {
      console.warn('[network-bridge] unseal failed:', e instanceof Error ? e.message : e);
      return;
    }
    let msg: Partial<HiveMessage>;
    try {
      msg = JSON.parse(plaintext.toString('utf8')) as Partial<HiveMessage>;
    } catch {
      console.warn('[network-bridge] invalid JSON after unseal');
      return;
    }
    if (!msg.id || typeof msg.id !== 'string') {
      console.warn('[network-bridge] missing message id');
      return;
    }
    if (this.seenIds.has(msg.id)) return;
    this.seenIds.add(msg.id);
    if (this.seenIds.size > 5_000) {
      const drop = [...this.seenIds].slice(0, 1_000);
      for (const x of drop) this.seenIds.delete(x);
    }
    // Prefer envelope to=; topic agent segment is routing hint only
    const topicAgent = topic.match(/\/agents\/([^/]+)\/inbox$/)?.[1];
    const to =
      (typeof msg.to === 'string' && msg.to) ||
      (topicAgent && topicAgent !== '+' ? topicAgent : null) ||
      'god';
    try {
      const hive = this.deps.hive();
      if (!hive.enabled()) {
        console.warn('[network-bridge] hive disabled; drop inbound', msg.id);
        return;
      }
      hive.send(
        {
          id: msg.id,
          conversation: msg.conversation,
          in_reply_to: msg.in_reply_to ?? null,
          to,
          act: msg.act || 'inform',
          subject: msg.subject || '(remote)',
          body: msg.body || '',
          hops: typeof msg.hops === 'number' ? msg.hops : 0,
          requires_reply: !!msg.requires_reply,
          needs_human: !!msg.needs_human,
          created_at: msg.created_at,
        },
        typeof msg.from === 'string' && msg.from ? msg.from : 'remote'
      );
    } catch (e) {
      console.error('[network-bridge] hive.send failed:', e);
      this.seenIds.delete(msg.id);
    }
  }
}
