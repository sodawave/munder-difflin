/** Topic helpers — opaque ids only (SPEC / conventions). CommonJS for focused tests. */
'use strict';

function sanitizeId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'x';
}

function peerInboxTopic(orgId, deviceId) {
  const org = sanitizeId(orgId || 'local');
  const dev = sanitizeId(deviceId);
  return `md/${org}/dev/${dev}/inbox`;
}

module.exports = { peerInboxTopic, sanitizeId };
