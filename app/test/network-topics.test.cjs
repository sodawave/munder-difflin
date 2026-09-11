/**
 * Topic helper hygiene — opaque ids, agent inbox + roster (peer-harness-coop).
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { join } = require('node:path');

const {
  peerInboxTopic,
  agentInboxTopic,
  agentInboxWildcard,
  rosterTopic,
} = require(join(__dirname, '../src/main/network/topics.cjs'));

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

describe('agentInboxTopic + roster', () => {
  it('mirrors disk delivery path without absolute harnessHome', () => {
    assert.equal(
      agentInboxTopic('local', 'devA', 'buer-1'),
      'md/local/dev/devA/agents/buer-1/inbox'
    );
    assert.equal(rosterTopic('local', 'devA'), 'md/local/dev/devA/roster');
    assert.equal(agentInboxWildcard('local', 'devA'), 'md/local/dev/devA/agents/+/inbox');
  });

  it('sanitizes agent ids', () => {
    const t = agentInboxTopic('local', 'd', 'a@b/c');
    assert.equal(t.includes('@'), false);
    assert.equal(t, 'md/local/dev/d/agents/a_b_c/inbox');
  });
});
