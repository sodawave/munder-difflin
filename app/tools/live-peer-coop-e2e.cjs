#!/usr/bin/env node
/**
 * Live peer-harness-coop E2E against a real broker.
 * Pair → publish/follow roster → sendRemote to agent inbox.
 *
 *   MD_MQTT_URL=mqtt://127.0.0.1:1883 node tools/live-peer-coop-e2e.cjs
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('../test/load-ts.cjs');

const { NetworkBridge } = loadTs('src/main/network/index.ts');
const { HiveManager } = loadTs('src/main/hive.ts');

const BROKER = (process.env.MD_MQTT_URL || '').trim() || 'mqtt://127.0.0.1:1883';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(fn, timeoutMs = 12_000) {
  const start = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout');
    await sleep(50);
  }
}

async function floor(label) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), `md-coop-${label}-`));
  const hive = new HiveManager(() => home);
  await hive.ensureAgent({ id: 'god-1', name: 'Michael', provider: 'claude', cwd: home, isGod: true });
  return { home, hive, cleanup: () => fs.rmSync(home, { recursive: true, force: true }) };
}

async function main() {
  console.log('[live-coop] broker', BROKER);
  const aliceF = await floor('alice');
  const bobF = await floor('bob');
  await bobF.hive.ensureAgent({
    id: 'ops-1',
    name: 'Ops',
    provider: 'claude',
    cwd: bobF.home,
    role: 'ops',
  });

  const orgId = 'org_coop_live';
  const alice = new NetworkBridge({
    identityDir: () => aliceF.home,
    hive: () => aliceF.hive,
    canNetwork: () => true,
    orgId: () => orgId,
    brokerUrl: () => BROKER,
  });
  const bob = new NetworkBridge({
    identityDir: () => bobF.home,
    hive: () => bobF.hive,
    canNetwork: () => true,
    orgId: () => orgId,
    brokerUrl: () => BROKER,
  });

  await alice.whenConnected(15_000);
  await bob.whenConnected(15_000);
  console.log('[live-coop] both connected');

  bob.setEnvLabel('prod-vps');
  bob.setPublishAgentIds(['god-1', 'ops-1']);
  bob.publishRoster();

  const card = bob.getAddressCard();
  if (!card) throw new Error('bob address card missing');
  const imp = alice.importPeer(card);
  if (!imp.ok) throw new Error(`importPeer: ${imp.error}`);
  console.log('[live-coop] alice imported bob', card.deviceId);

  // Peer must (re)publish after the other side is subscribed to roster
  bob.publishRoster();

  await waitFor(() => alice.getSyncState().peerRosters[card.deviceId]);
  const roster = alice.getSyncState().peerRosters[card.deviceId];
  if (!roster.agents.some((a) => a.agentId === 'ops-1')) {
    throw new Error('roster missing ops-1');
  }
  console.log('[live-coop] roster OK agents=', roster.agents.map((a) => a.agentId).join(','));

  alice.setFollowAgentIds(card.deviceId, ['ops-1']);
  if (!alice.getSyncState().followed.some((f) => f.agentId === 'ops-1')) {
    throw new Error('follow failed');
  }
  console.log('[live-coop] follow ops-1 OK');

  const msgId = `coop-live-${Date.now()}`;
  const sent = alice.sendRemote({
    peerDeviceId: card.deviceId,
    peerX25519PublicKey: card.x25519PublicKey,
    agentId: 'ops-1',
    message: {
      id: msgId,
      from: 'alice-operator',
      to: 'ops-1',
      act: 'request',
      subject: 'COOP-LIVE-DEPLOY',
      body: 'Please ship on the VPS path /var/app',
      conversation: 'coop-live',
    },
  });
  if (!sent.ok) throw new Error(`sendRemote: ${sent.error}`);
  console.log('[live-coop] sealed publish bytes=', sent.sealedBytes);

  const inboxPath = path.join(bobF.home, 'hive', 'agents', 'ops-1', 'inbox', `${msgId}.json`);
  await waitFor(() => fs.existsSync(inboxPath));
  const landed = JSON.parse(fs.readFileSync(inboxPath, 'utf8'));
  if (landed.subject !== 'COOP-LIVE-DEPLOY' || landed.to !== 'ops-1') {
    throw new Error(`inbox mismatch ${JSON.stringify(landed)}`);
  }
  console.log('[live-coop] inbox OK', inboxPath);

  // Evidence artifact for the run (machine-readable)
  const report = {
    ok: true,
    broker: BROKER,
    bobDeviceId: card.deviceId,
    followed: alice.getSyncState().followed.map((f) => f.agentId),
    inboxPath,
    subject: landed.subject,
    at: new Date().toISOString(),
  };
  const out = path.join(__dirname, '../docs/evidence/pr-9/live-coop-result.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log('[live-coop] wrote', out);

  alice.stop();
  bob.stop();
  aliceF.cleanup();
  bobF.cleanup();
  console.log('[live-coop] ALL GREEN');
}

main().catch((e) => {
  console.error('[live-coop] FAIL', e);
  process.exit(1);
});
