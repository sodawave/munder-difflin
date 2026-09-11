/**
 * MQTT client for the additive sealed bridge (epic M2).
 * Retain is always forced off; QoS 1. No connection unless start() is called
 * by the bridge when canNetwork is true.
 */
import mqtt, { type MqttClient } from 'mqtt';

export type MqttMessageHandler = (topic: string, payload: Buffer) => void;

export class NetworkMqttClient {
  private client: MqttClient | null = null;
  private handler: MqttMessageHandler | null = null;
  private subscribed = new Set<string>();

  constructor(private readonly brokerUrl: string) {}

  private connectWaiters: Array<() => void> = [];

  get connected(): boolean {
    return !!this.client?.connected;
  }

  /** Resolve when the client is connected (for tests / sendRemote readiness). */
  whenConnected(timeoutMs = 10_000): Promise<void> {
    if (this.connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('mqtt connect timeout')), timeoutMs);
      this.connectWaiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  start(onMessage: MqttMessageHandler): void {
    if (this.client) return;
    this.handler = onMessage;
    const client = mqtt.connect(this.brokerUrl, {
      reconnectPeriod: 3_000,
      connectTimeout: 10_000,
      // Never resume retained sealed traffic
      clean: true,
      // Aedes / Mosquitto 3.1.1 — mqtt.js v5 defaults to MQTT 5
      protocolVersion: 4,
    });
    this.client = client;
    client.on('message', (topic, payload) => {
      try {
        this.handler?.(topic, payload);
      } catch (e) {
        console.error('[network-mqtt] handler error:', e);
      }
    });
    client.on('error', (err) => {
      console.warn('[network-mqtt]', err.message);
    });
    client.on('connect', () => {
      for (const t of this.subscribed) {
        client.subscribe(t, { qos: 1 });
      }
      const waiters = this.connectWaiters.splice(0);
      for (const w of waiters) w();
    });
  }

  stop(): void {
    const c = this.client;
    this.client = null;
    this.handler = null;
    this.subscribed.clear();
    if (!c) return;
    try {
      c.end(true);
    } catch {
      /* best-effort */
    }
  }

  subscribe(topic: string): void {
    this.subscribed.add(topic);
    if (this.client?.connected) {
      this.client.subscribe(topic, { qos: 1 });
    }
  }

  /** Publish sealed blob; retain always false. */
  publish(topic: string, payload: string | Buffer): boolean {
    if (!this.client?.connected) return false;
    this.client.publish(topic, payload, { qos: 1, retain: false });
    return true;
  }
}

export function defaultBrokerUrl(): string {
  return (process.env.MD_MQTT_URL || '').trim() || 'mqtt://127.0.0.1:1883';
}
