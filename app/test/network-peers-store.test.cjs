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

  it('rejects oversized cards', () => {
    const huge = JSON.stringify({
      v: 1,
      deviceId: 'x',
      x25519PublicKey: 'y',
      pad: 'z'.repeat(store.MAX_CARD_CHARS),
    });
    const r = store.parseAddressCard(huge);
    assert.equal(r.ok, false);
  });

  it('detects self address cards by deviceId or keys', () => {
    const identity = {
      deviceId: 'devA',
      x25519: { publicKey: 'xA' },
      ed25519: { publicKey: 'eA' },
    };
    assert.equal(
      store.isSelfAddressCard(
        { v: 1, mqttUrl: '', deviceId: 'devA', x25519PublicKey: 'other', ed25519PublicKey: '', envLabel: '' },
        identity
      ),
      true
    );
    assert.equal(
      store.isSelfAddressCard(
        { v: 1, mqttUrl: '', deviceId: 'devB', x25519PublicKey: 'xA', ed25519PublicKey: '', envLabel: '' },
        identity
      ),
      true
    );
    assert.equal(
      store.isSelfAddressCard(
        { v: 1, mqttUrl: '', deviceId: 'devB', x25519PublicKey: 'xB', ed25519PublicKey: 'eB', envLabel: '' },
        identity
      ),
      false
    );
  });

  it('scrubs self peers from store', () => {
    const identity = {
      deviceId: 'me',
      x25519: { publicKey: 'xMe' },
      ed25519: { publicKey: 'eMe' },
    };
    const scrubbed = store.scrubSelfPeers(
      {
        v: 1,
        envLabel: '',
        publishAgentIds: [],
        peers: [
          {
            deviceId: 'me',
            mqttUrl: '',
            x25519PublicKey: 'xMe',
            ed25519PublicKey: 'eMe',
            envLabel: '',
            followAgentIds: [],
          },
          {
            deviceId: 'peer',
            mqttUrl: '',
            x25519PublicKey: 'xP',
            ed25519PublicKey: 'eP',
            envLabel: '',
            followAgentIds: [],
          },
        ],
      },
      identity
    );
    assert.equal(scrubbed.peers.length, 1);
    assert.equal(scrubbed.peers[0].deviceId, 'peer');
  });
});
