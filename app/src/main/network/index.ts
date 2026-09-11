/**
 * Additive sealed MQTT bridge (SPEC CAP-1..3, epics M2–M4).
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
import { peerInboxTopic } from './topics';

export type BridgeDeps = {
  /** Directory for device-identity.json (typically harnessHome). */
  identityDir: () => string | null;
  hive: () => HiveManager;
  /** Injected for tests; defaults to entitlements.canUse('network'). */
  canNetwork?: () => boolean;
  /** Injected org id for topics; defaults to entitlement snapshot. */
  orgId?: () => string;
  /** Injected broker URL; defaults to MD_MQTT_URL / localhost. */
  brokerUrl?: () => string;
};

export class NetworkBridge {
  private mqtt: NetworkMqttClient | null = null;
  private identity: DeviceIdentity | null = null;
  private readonly seenIds = new Set<string>();
  private running = false;
  /** True once start() attempted a client (for CAP-3 assertions). */
  private connectAttempted = false;

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

  /** Start or stop MQTT according to canNetwork (CAP-3). */
  sync(): void {
    const allowed = this.isNetworkAllowed();
    if (allowed && !this.running) this.start();
    else if (!allowed && this.running) this.stop();
  }

  stop(): void {
    this.running = false;
    this.mqtt?.stop();
    this.mqtt = null;
  }

  /**
   * CAP-1 / M4: seal + publish to peer device inbox topic.
   * Requires canNetwork and known peer X25519 public key.
   */
  sendRemote(opts: {
    peerDeviceId: string;
    peerX25519PublicKey: string;
    orgId?: string;
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
    const topic = peerInboxTopic(orgId, opts.peerDeviceId);
    const payload = {
      id: opts.message.id,
      conversation: opts.message.conversation ?? '',
      in_reply_to: opts.message.in_reply_to ?? null,
      from: opts.message.from ?? 'remote',
      to: opts.message.to ?? 'god',
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

  private start(): void {
    const id = this.ensureIdentity();
    if (!id) {
      console.warn('[network-bridge] cannot start — no identity dir');
      return;
    }
    const orgId = this.resolveOrgId();
    const topic = peerInboxTopic(orgId, id.deviceId);
    const mqtt = new NetworkMqttClient(this.resolveBrokerUrl());
    this.mqtt = mqtt;
    this.running = true;
    this.connectAttempted = true;
    mqtt.start((t, payload) => this.onMqtt(t, payload));
    mqtt.subscribe(topic);
    console.log('[network-bridge] started; subscribed', topic);
  }

  private onMqtt(_topic: string, payload: Buffer): void {
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
    // Cap memory for long-lived processes
    if (this.seenIds.size > 5_000) {
      const drop = [...this.seenIds].slice(0, 1_000);
      for (const x of drop) this.seenIds.delete(x);
    }
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
          to: msg.to || 'god',
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
