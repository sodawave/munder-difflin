/** Topic helpers — opaque ids only (SPEC / conventions). */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const core = require('./topics.cjs') as {
  peerInboxTopic: (orgId: string, deviceId: string) => string;
  sanitizeId: (id: string) => string;
};

export function peerInboxTopic(orgId: string, deviceId: string): string {
  return core.peerInboxTopic(orgId, deviceId);
}

export function sanitizeId(id: string): string {
  return core.sanitizeId(id);
}
