#!/usr/bin/env node
/**
 * Live MQTT broker for local Private Network E2E (Aedes on :1883).
 * Usage: node tools/mqtt-dev-broker.cjs
 */
'use strict';

const net = require('node:net');
const { Aedes } = require('aedes');

const PORT = Number(process.env.MD_MQTT_PORT || 1883);
const HOST = process.env.MD_MQTT_HOST || '127.0.0.1';

async function main() {
  const broker = await Aedes.createBroker();
  const server = net.createServer(broker.handle);
  await new Promise((resolve, reject) => {
    server.listen(PORT, HOST, (err) => (err ? reject(err) : resolve()));
  });
  console.log(`[mqtt-dev-broker] listening mqtt://${HOST}:${PORT}`);
  broker.on('client', (c) => console.log('[mqtt-dev-broker] client', c.id));
  broker.on('publish', (packet, client) => {
    if (!client) return;
    console.log('[mqtt-dev-broker] publish', packet.topic, 'bytes=', packet.payload?.length ?? 0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
