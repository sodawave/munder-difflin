/**
 * peersStore — address card parse + persist (SPEC peer-harness-coop).
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const store = require(path.join(__dirname, '../src/main/network/peersStore.cjs'));

describe('peersStore', () => {
  it('parseAddressCard accepts v1 cards', () => {
    const r = store.parseAddressCard({
      v: 1,
      mqttUrl: 'mqtt://127.0.0.1:1883',
      deviceId: 'abc',
      x25519PublicKey: 'pub',
      ed25519PublicKey: 'ed',
      envLabel: 'prod',
    });
    assert.equal(r.ok, true);
    assert.equal(r.card.deviceId, 'abc');
  });

  it('rejects missing keys', () => {
    const r = store.parseAddressCard({ v: 1, deviceId: 'x' });
    assert.equal(r.ok, false);
  });

  it('roundtrips peers.json with publish/follow selection', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'md-peers-'));
    try {
      const saved = store.savePeersStore(home, {
        v: 1,
        publishAgentIds: ['god'],
        envLabel: 'dev',
        peers: [
          {
            deviceId: 'peer1',
            mqttUrl: 'mqtt://x',
            x25519PublicKey: 'x',
            ed25519PublicKey: 'e',
            envLabel: 'vps',
            followAgentIds: ['god', 'ops'],
          },
        ],
      });
      assert.equal(saved.peers.length, 1);
      const loaded = store.loadPeersStore(home);
      assert.deepEqual(loaded.publishAgentIds, ['god']);
      assert.deepEqual(loaded.peers[0].followAgentIds, ['god', 'ops']);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it('tintHueForDevice is stable', () => {
    assert.equal(store.tintHueForDevice('abc'), store.tintHueForDevice('abc'));
    assert.notEqual(store.tintHueForDevice('abc'), store.tintHueForDevice('xyz'));
  });
});
