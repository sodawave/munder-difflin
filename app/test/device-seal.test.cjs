/**
 * Focused tests for device seal (SPEC CAP-4 / epic M1).
 * Asserts roundtrip and that plaintext subject/body never appear on the wire blob.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { join } = require('node:path');

const core = require(join(__dirname, '../src/main/network/deviceSealCore.cjs'));

describe('deviceSeal', () => {
  it('roundtrips seal → unseal for a hive-shaped payload', () => {
    const alice = core.generateDeviceIdentity();
    const bob = core.generateDeviceIdentity();
    const msg = {
      id: '2026-09-11T12-00-00-000Z-test01',
      from: 'god',
      to: 'god',
      act: 'inform',
      subject: 'UNIQUE-SUBJECT-TOKEN-xyz',
      body: 'UNIQUE-BODY-SECRET-PAYLOAD-abc',
      conversation: 'c1',
      in_reply_to: null,
      hops: 0,
      requires_reply: false,
      needs_human: false,
      created_at: new Date().toISOString(),
    };
    const plain = JSON.stringify(msg);
    const sealed = core.seal(plain, bob.x25519.publicKey, alice);
    assert.equal(typeof sealed, 'string');
    assert.ok(sealed.length > 80);

    // CAP-4: plaintext must not appear in the wire buffer
    assert.equal(core.wireContainsUtf8(sealed, msg.subject), false);
    assert.equal(core.wireContainsUtf8(sealed, msg.body), false);

    const { plaintext, senderEd25519PublicKey } = core.unseal(sealed, bob);
    assert.equal(plaintext.toString('utf8'), plain);
    assert.equal(senderEd25519PublicKey, alice.ed25519.publicKey);
  });

  it('rejects tampered ciphertext', () => {
    const alice = core.generateDeviceIdentity();
    const bob = core.generateDeviceIdentity();
    const sealed = core.seal('hello', bob.x25519.publicKey, alice);
    const buf = Buffer.from(sealed, 'base64');
    buf[buf.length - 20] ^= 0xff;
    const bad = buf.toString('base64');
    assert.throws(() => core.unseal(bad, bob));
  });

  it('generateDeviceIdentity yields distinct devices', () => {
    const a = core.generateDeviceIdentity();
    const b = core.generateDeviceIdentity();
    assert.notEqual(a.deviceId, b.deviceId);
    assert.equal(a.ed25519.publicKey.length > 0, true);
    assert.equal(a.x25519.publicKey.length > 0, true);
  });
});
