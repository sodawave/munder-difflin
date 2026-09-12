/**
 * Automated SPEC verification for mqtt-additive-bridge (CAP-1..CAP-4).
 * Uses an in-process Aedes broker — no manual Mosquitto.
 */
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const mqtt = require('mqtt');
const { Aedes } = require('aedes');
const loadTs = require('./load-ts.cjs');

const { NetworkBridge } = loadTs('src/main/network/index.ts');
const { HiveManager } = loadTs('src/main/hive.ts');
const sealCore = require(path.join(__dirname, '../src/main/network/deviceSealCore.cjs'));
const { peerInboxTopic, agentInboxTopic, rosterTopic } = require(path.join(__dirname, '../src/main/network/topics.cjs'));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(fn, { timeoutMs = 8_000, intervalMs = 50 } = {}) {
  const start = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout');
    await sleep(intervalMs);
  }
}

async function startBroker() {
  const broker = await Aedes.createBroker();
  const server = net.createServer(broker.handle);
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve()));
  });
  const { port } = server.address();
  const url = `mqtt://127.0.0.1:${port}`;
  return {
    url,
    broker,
    async close() {
      await new Promise((r) => broker.close(() => r()));
      await new Promise((r) => server.close(() => r()));
    },
  };
}

async function makeFloor(t, label) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), `md-net-${label}-`));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const hive = new HiveManager(() => home);
  await hive.ensureAgent({ id: 'god-1', name: 'Michael', provider: 'claude', cwd: home, isGod: true });
  return { home, hive };
}

describe('SPEC mqtt-additive-bridge', () => {
  let brokerEnv;

  before(async () => {
    brokerEnv = await startBroker();
  });

  after(async () => {
    await brokerEnv?.close();
  });

  it('CAP-3: without canNetwork never opens MQTT', async (t) => {
    const { home, hive } = await makeFloor(t, 'gate');
    const bridge = new NetworkBridge({
      identityDir: () => home,
      hive: () => hive,
      canNetwork: () => false,
      orgId: () => 'org_test',
      brokerUrl: () => brokerEnv.url,
    });
    bridge.sync();
    assert.equal(bridge.didAttemptConnect(), false);
    assert.equal(bridge.connected, false);
    const gated = bridge.sendRemote({
      peerDeviceId: 'peer',
      peerX25519PublicKey: 'x',
      message: { id: 'x', subject: 'nope', body: 'nope' },
    });
    assert.equal(gated.ok, false);
    assert.match(gated.error || '', /not entitled|network/i);
  });

  it('CAP-1 + CAP-4: peer receives ciphertext; unseal yields same HiveMessage; wire has no plaintext', async (t) => {
    const aliceFloor = await makeFloor(t, 'alice');
    const bobFloor = await makeFloor(t, 'bob');
    const orgId = 'org_cap1';

    const alice = new NetworkBridge({
      identityDir: () => aliceFloor.home,
      hive: () => aliceFloor.hive,
      canNetwork: () => true,
      orgId: () => orgId,
      brokerUrl: () => brokerEnv.url,
    });
    const bob = new NetworkBridge({
      identityDir: () => bobFloor.home,
      hive: () => bobFloor.hive,
      canNetwork: () => true,
      orgId: () => orgId,
      brokerUrl: () => brokerEnv.url,
    });

    await alice.whenConnected();
    await bob.whenConnected();
    const bobBundle = bob.getPublicBundle();
    assert.ok(bobBundle?.deviceId);
    assert.ok(bobBundle?.x25519PublicKey);

    const subject = 'UNIQUE-SUBJECT-CAP1-TOKEN';
    const body = 'UNIQUE-BODY-CAP1-SECRET';
    const msgId = `2026-09-11T20-00-00-000Z-cap1`;

    // Eavesdropper on the broker — must see ciphertext only (CAP-4)
    const wireHits = [];
    const eaves = mqtt.connect(brokerEnv.url, { clean: true });
    t.after(() => eaves.end(true));
    await new Promise((resolve, reject) => {
      eaves.on('connect', () => {
        eaves.subscribe(agentInboxTopic(orgId, bobBundle.deviceId, 'god'), { qos: 1 }, (err) =>
          err ? reject(err) : resolve()
        );
      });
      eaves.on('error', reject);
    });
    eaves.on('message', (_topic, payload) => {
      wireHits.push(payload.toString('utf8'));
    });

    // Give bob's subscribe a tick to land on the broker
    await sleep(100);

    const sent = alice.sendRemote({
      peerDeviceId: bobBundle.deviceId,
      peerX25519PublicKey: bobBundle.x25519PublicKey,
      message: {
        id: msgId,
        from: 'remote-alice',
        to: 'god',
        act: 'inform',
        subject,
        body,
        conversation: 'c-cap1',
      },
    });
    assert.equal(sent.ok, true, sent.error);

    await waitFor(() => wireHits.length >= 1);
    for (const wire of wireHits) {
      assert.equal(sealCore.wireContainsUtf8(wire, subject), false);
      assert.equal(sealCore.wireContainsUtf8(wire, body), false);
    }

    const inboxPath = path.join(bobFloor.home, 'hive', 'agents', 'god-1', 'inbox', `${msgId}.json`);
    await waitFor(() => fs.existsSync(inboxPath));
    const landed = JSON.parse(fs.readFileSync(inboxPath, 'utf8'));
    assert.equal(landed.id, msgId);
    assert.equal(landed.subject, subject);
    assert.equal(landed.body, body);

    alice.stop();
    bob.stop();
  });

  it('CAP-2: inbound materializes inbox JSON; QoS redelivery does not dual-file', async (t) => {
    const floor = await makeFloor(t, 'cap2');
    const orgId = 'org_cap2';
    const bridge = new NetworkBridge({
      identityDir: () => floor.home,
      hive: () => floor.hive,
      canNetwork: () => true,
      orgId: () => orgId,
      brokerUrl: () => brokerEnv.url,
    });
    await bridge.whenConnected();
    const bundle = bridge.getPublicBundle();
    assert.ok(bundle);

    const msgId = '2026-09-11T20-01-00-000Z-cap2';
    const plaintext = JSON.stringify({
      id: msgId,
      from: 'remote',
      to: 'god',
      act: 'inform',
      subject: 'dedupe-subject',
      body: 'dedupe-body',
      conversation: 'c2',
      in_reply_to: null,
      hops: 0,
      requires_reply: false,
      needs_human: false,
      created_at: new Date().toISOString(),
    });

    // Foreign sender identity seals to this device
    const sender = sealCore.generateDeviceIdentity();
    const sealed = sealCore.seal(plaintext, bundle.x25519PublicKey, sender);
    const topic = peerInboxTopic(orgId, bundle.deviceId);

    const pub = mqtt.connect(brokerEnv.url, { clean: true });
    t.after(() => pub.end(true));
    await new Promise((resolve, reject) => {
      pub.on('connect', resolve);
      pub.on('error', reject);
    });

    pub.publish(topic, sealed, { qos: 1, retain: false });
    pub.publish(topic, sealed, { qos: 1, retain: false }); // duplicate

    const inboxDir = path.join(floor.home, 'hive', 'agents', 'god-1', 'inbox');
    await waitFor(() => fs.existsSync(path.join(inboxDir, `${msgId}.json`)));
    await sleep(200); // allow a second deliver attempt if any
    const files = fs.readdirSync(inboxDir).filter((f) => f.endsWith('.json'));
    const sameId = files.filter((f) => f.startsWith(msgId));
    assert.equal(sameId.length, 1);

    // M3-S2: same inbox surface the existing nudge path reads (hive.inbox + nudge text).
    const { inboxNudgeText, isInboxNudge } = loadTs('src/shared/hiveNudge.ts');
    const pending = floor.hive.inbox('god-1');
    assert.ok(pending.some((m) => m.id === msgId), 'hive.inbox must see remote-landed mail');
    const nudge = inboxNudgeText(pending.map((m) => m.id));
    assert.equal(isInboxNudge(nudge), true);

    bridge.stop();
  });

  it('CAP-3 revoke: sync after canNetwork false stops client', async (t) => {
    const { home, hive } = await makeFloor(t, 'revoke');
    let allowed = true;
    const bridge = new NetworkBridge({
      identityDir: () => home,
      hive: () => hive,
      canNetwork: () => allowed,
      orgId: () => 'org_rev',
      brokerUrl: () => brokerEnv.url,
    });
    await bridge.whenConnected();
    assert.equal(bridge.connected, true);
    allowed = false;
    bridge.sync();
    assert.equal(bridge.connected, false);
  });

  it('coop: agent inbox topic + roster share/follow', async (t) => {
    const aliceFloor = await makeFloor(t, 'coop-a');
    const bobFloor = await makeFloor(t, 'coop-b');
    await bobFloor.hive.ensureAgent({
      id: 'ops-1',
      name: 'Ops',
      provider: 'claude',
      cwd: bobFloor.home,
      role: 'ops',
    });
    const orgId = 'org_coop';

    const alice = new NetworkBridge({
      identityDir: () => aliceFloor.home,
      hive: () => aliceFloor.hive,
      canNetwork: () => true,
      orgId: () => orgId,
      brokerUrl: () => brokerEnv.url,
    });
    const bob = new NetworkBridge({
      identityDir: () => bobFloor.home,
      hive: () => bobFloor.hive,
      canNetwork: () => true,
      orgId: () => orgId,
      brokerUrl: () => brokerEnv.url,
    });

    await alice.whenConnected();
    await bob.whenConnected();

    bob.setEnvLabel('prod-vps');
    bob.setPublishAgentIds(['god-1', 'ops-1']);

    const bobCard = bob.getAddressCard();
    assert.ok(bobCard);
    const imported = alice.importPeer(bobCard);
    assert.equal(imported.ok, true, imported.error);

    await waitFor(() => alice.getSyncState().peerRosters[bobCard.deviceId]);
    const roster = alice.getSyncState().peerRosters[bobCard.deviceId];
    assert.ok(roster.agents.some((a) => a.agentId === 'ops-1'));
    assert.ok(roster.agents.some((a) => a.isGod));

    alice.setFollowAgentIds(bobCard.deviceId, ['ops-1']);
    const followed = alice.getSyncState().followed;
    assert.ok(followed.some((f) => f.agentId === 'ops-1'));

    const msgId = '2026-09-12T00-00-00-000Z-coop';
    const sent = alice.sendRemote({
      peerDeviceId: bobCard.deviceId,
      peerX25519PublicKey: bobCard.x25519PublicKey,
      agentId: 'ops-1',
      message: {
        id: msgId,
        from: 'alice-god',
        to: 'ops-1',
        act: 'request',
        subject: 'deploy-please',
        body: 'ship it on the VPS',
      },
    });
    assert.equal(sent.ok, true, sent.error);

    const inboxPath = path.join(bobFloor.home, 'hive', 'agents', 'ops-1', 'inbox', `${msgId}.json`);
    await waitFor(() => fs.existsSync(inboxPath));
    const landed = JSON.parse(fs.readFileSync(inboxPath, 'utf8'));
    assert.equal(landed.to, 'ops-1');
    assert.equal(landed.subject, 'deploy-please');

    alice.stop();
    bob.stop();
  });
});
