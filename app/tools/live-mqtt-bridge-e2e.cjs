#!/usr/bin/env node
/**
 * Live two-peer E2E against a real broker (default mqtt://127.0.0.1:1883).
 * Does not start Electron — proves NetworkBridge + hive inbox on a live MQTT port.
 *
 *   MD_MQTT_URL=mqtt://127.0.0.1:1883 node tools/live-mqtt-bridge-e2e.cjs
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

async function waitFor(fn, timeoutMs = 10_000) {
  const start = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout');
    await sleep(50);
  }
}

async function floor(label) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), `md-live-${label}-`));
  const hive = new HiveManager(() => home);
  await hive.ensureAgent({ id: 'god-1', name: 'Michael', provider: 'claude', cwd: home, isGod: true });
  return { home, hive, cleanup: () => fs.rmSync(home, { recursive: true, force: true }) };
}

async function main() {
  console.log('[live-e2e] broker', BROKER);
  const aliceF = await floor('alice');
  const bobF = await floor('bob');
  const orgId = 'org_live';

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
  console.log('[live-e2e] both connected');

  const bobBundle = bob.getPublicBundle();
  const msgId = `live-${Date.now()}`;
  const subject = 'LIVE-E2E-SUBJECT';
  const body = 'LIVE-E2E-BODY-SECRET';

  const sent = alice.sendRemote({
    peerDeviceId: bobBundle.deviceId,
    peerX25519PublicKey: bobBundle.x25519PublicKey,
    message: {
      id: msgId,
      from: 'alice-remote',
      to: 'god',
      act: 'inform',
      subject,
      body,
      conversation: 'live',
    },
  });
  if (!sent.ok) throw new Error(`sendRemote failed: ${sent.error}`);
  console.log('[live-e2e] published sealedBytes=', sent.sealedBytes);

  const inboxPath = path.join(bobF.home, 'hive', 'agents', 'god-1', 'inbox', `${msgId}.json`);
  await waitFor(() => fs.existsSync(inboxPath));
  const landed = JSON.parse(fs.readFileSync(inboxPath, 'utf8'));
  if (landed.subject !== subject || landed.body !== body) {
    throw new Error('inbox payload mismatch');
  }
  console.log('[live-e2e] CAP-1/2 OK inbox', inboxPath);

  // CAP-3: gated peer must not connect
  const gatedHome = fs.mkdtempSync(path.join(os.tmpdir(), 'md-live-gated-'));
  const gatedHive = new HiveManager(() => gatedHome);
  await gatedHive.ensureAgent({ id: 'god-1', name: 'Michael', provider: 'claude', cwd: gatedHome, isGod: true });
  const gated = new NetworkBridge({
    identityDir: () => gatedHome,
    hive: () => gatedHive,
    canNetwork: () => false,
    orgId: () => orgId,
    brokerUrl: () => BROKER,
  });
  gated.sync();
  if (gated.didAttemptConnect()) throw new Error('CAP-3 fail: gated peer attempted MQTT');
  console.log('[live-e2e] CAP-3 OK (no connect when gated)');

  alice.stop();
  bob.stop();
  gated.stop();
  aliceF.cleanup();
  bobF.cleanup();
  fs.rmSync(gatedHome, { recursive: true, force: true });
  console.log('[live-e2e] ALL GREEN');
}

main().catch((e) => {
  console.error('[live-e2e] FAIL', e);
  process.exit(1);
});
