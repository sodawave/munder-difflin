/** Topic helpers — opaque ids only (SPEC peer-harness-coop / mqtt-additive-bridge). */
'use strict';

function sanitizeId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'x';
}

/** Legacy device-level inbox (mqtt-additive-bridge CAP tests). */
function peerInboxTopic(orgId, deviceId) {
  const org = sanitizeId(orgId || 'local');
  const dev = sanitizeId(deviceId);
  return `md/${org}/dev/${dev}/inbox`;
}

/** Per-agent delivery topic — mirrors hive/agents/{agentId}/inbox. */
function agentInboxTopic(orgId, deviceId, agentId) {
  const org = sanitizeId(orgId || 'local');
  const dev = sanitizeId(deviceId);
  const agent = sanitizeId(agentId);
  return `md/${org}/dev/${dev}/agents/${agent}/inbox`;
}

/** Wildcard subscribe for all agent inboxes on this device. */
function agentInboxWildcard(orgId, deviceId) {
  const org = sanitizeId(orgId || 'local');
  const dev = sanitizeId(deviceId);
  return `md/${org}/dev/${dev}/agents/+/inbox`;
}

/** Knowhow / roster publish topic. */
function rosterTopic(orgId, deviceId) {
  const org = sanitizeId(orgId || 'local');
  const dev = sanitizeId(deviceId);
  return `md/${org}/dev/${dev}/roster`;
}

module.exports = {
  sanitizeId,
  peerInboxTopic,
  agentInboxTopic,
  agentInboxWildcard,
  rosterTopic,
};
