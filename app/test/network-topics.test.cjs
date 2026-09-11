/**
 * Topic helper hygiene (epic M2-S3) — opaque ids, no raw PII in topic path.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { join } = require('node:path');

const { peerInboxTopic } = require(join(__dirname, '../src/main/network/topics.cjs'));

describe('peerInboxTopic', () => {
  it('builds opaque org/device inbox topics', () => {
    assert.equal(peerInboxTopic('org_abc', 'dev_xyz'), 'md/org_abc/dev/dev_xyz/inbox');
  });

  it('strips email-like characters from ids', () => {
    const t = peerInboxTopic('user@example.com', 'Alice Bob');
    assert.equal(t.includes('@'), false);
    assert.equal(t.includes(' '), false);
    assert.match(t, /^md\/[a-zA-Z0-9_-]+\/dev\/[a-zA-Z0-9_-]+\/inbox$/);
  });
});
