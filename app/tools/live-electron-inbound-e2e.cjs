#!/usr/bin/env node
/**
 * Publish one sealed message into a running Electron install's device inbox.
 *
 *   MD_HARNESS_HOME=~/HarnessAgents MD_ORG_ID=org_demo \
 *     MD_MQTT_URL=mqtt://127.0.0.1:1883 node tools/live-electron-inbound-e2e.cjs
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const sealCore = require('../src/main/network/deviceSealCore.cjs');
const { peerInboxTopic } = require('../src/main/network/topics.cjs');
const mqtt = require('mqtt');

function findInboxFile(root, msgId) {
  const agents = path.join(root, 'hive', 'agents');
  if (!fs.existsSync(agents)) return null;
  for (const id of fs.readdirSync(agents)) {
    const p = path.join(agents, id, 'inbox', `${msgId}.json`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function main() {
  const home = (process.env.MD_HARNESS_HOME || '').trim();
  if (!home) {
    console.error('MD_HARNESS_HOME required (directory with network/device-identity.json)');
    process.exit(1);
  }
  const broker = (process.env.MD_MQTT_URL || '').trim() || 'mqtt://127.0.0.1:1883';
  const orgId = (process.env.MD_ORG_ID || '').trim() || 'org_demo';
  const idPath = path.join(home, 'network', 'device-identity.json');
  const device = JSON.parse(fs.readFileSync(idPath, 'utf8'));
  const msgId = `live-app-${Date.now()}`;
  const subject = 'FROM-EXTERNAL-PEER';
  const body = 'hello electron over mqtt';
  const sender = sealCore.generateDeviceIdentity();
  const plain = JSON.stringify({
    id: msgId,
    from: 'external-peer',
    to: 'god',
    act: 'inform',
    subject,
    body,
    conversation: 'live-app',
    in_reply_to: null,
    hops: 0,
    requires_reply: false,
    needs_human: false,
    created_at: new Date().toISOString(),
  });
  const sealed = sealCore.seal(plain, device.x25519.publicKey, sender);
  const topic = peerInboxTopic(orgId, device.deviceId);
  console.log('device', device.deviceId, 'topic', topic, 'aead', sealCore.AEAD);

  const client = mqtt.connect(broker, { protocolVersion: 4, clean: true, reconnectPeriod: 0 });
  await new Promise((resolve, reject) => {
    client.on('connect', resolve);
    client.on('error', reject);
  });
  await new Promise((resolve, reject) => {
    client.publish(topic, sealed, { qos: 1, retain: false }, (err) => (err ? reject(err) : resolve()));
  });
  console.log('published', msgId);
  client.end(true);

  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const found = findInboxFile(home, msgId);
    if (found) {
      const landed = JSON.parse(fs.readFileSync(found, 'utf8'));
      console.log('LANDED', found);
      console.log('subject=', landed.subject, 'body=', landed.body);
      if (landed.subject !== subject || landed.body !== body) process.exit(3);
      console.log('ELECTRON INBOUND E2E OK');
      return;
    }
  }
  console.error('FAIL: inbox not found');
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
