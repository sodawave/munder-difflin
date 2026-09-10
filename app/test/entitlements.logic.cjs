/** CJS mirror of src/shared/entitlements.ts for node:test (no build step). */

const TRIAL_DAYS = 14;

function defaultEntitlementState(installId) {
  return {
    plan: 'community',
    trialStartedAt: null,
    trialEndsAt: null,
    staplerEnabled: false,
    installId,
    lastRefreshAt: null,
    orgId: null,
    seatId: null,
    seatLabel: null,
    networkEnabled: false,
  };
}

function isPlanId(value) {
  return value === 'community' || value === 'trial' || value === 'pro' || value === 'teams';
}

function effectivePlan(state, nowMs, opts = {}) {
  if (opts.devUnlock) return 'pro';
  if (state.plan === 'teams') return 'teams';
  if (state.plan === 'pro') return 'pro';
  if (state.plan === 'trial' && state.trialEndsAt) {
    const end = Date.parse(state.trialEndsAt);
    if (Number.isFinite(end) && nowMs <= end) return 'trial';
    return 'community';
  }
  return 'community';
}

function canUseProFeatures(plan) {
  return plan === 'pro' || plan === 'trial' || plan === 'teams';
}

function requirePro(plan, feature, opts = {}) {
  if (feature === 'network') return plan === 'teams' && !!opts.networkEnabled;
  return canUseProFeatures(plan);
}

function startTrial(state, nowMs, days = TRIAL_DAYS) {
  if (state.plan === 'pro' || state.plan === 'teams') return state;
  if (state.trialStartedAt) {
    const end = state.trialEndsAt ? Date.parse(state.trialEndsAt) : 0;
    if (end && nowMs <= end) return { ...state, plan: 'trial' };
    return state;
  }
  const start = new Date(nowMs).toISOString();
  const end = new Date(nowMs + days * 24 * 60 * 60 * 1000).toISOString();
  return {
    ...state,
    plan: 'trial',
    trialStartedAt: start,
    trialEndsAt: end,
  };
}

/** Mirror of src/shared/entitlements.ts applyRemoteEntitlement (Refresh plan). */
function applyRemoteEntitlement(state, remote, nowMs) {
  const plan = isPlanId(remote.plan) ? remote.plan : state.plan;
  const onTeams = plan === 'teams';
  const networkEnabled = onTeams ? remote.networkEnabled !== false : false;
  return {
    ...state,
    plan,
    trialEndsAt: remote.trialEndsAt !== undefined ? remote.trialEndsAt : state.trialEndsAt,
    lastRefreshAt: new Date(nowMs).toISOString(),
    orgId: onTeams ? (typeof remote.orgId === 'string' ? remote.orgId : state.orgId) : null,
    seatId: onTeams ? (typeof remote.seatId === 'string' ? remote.seatId : state.seatId) : null,
    seatLabel: onTeams
      ? (typeof remote.seatLabel === 'string' ? remote.seatLabel : state.seatLabel)
      : null,
    networkEnabled,
  };
}

/**
 * Mirror of main isAllowedEntitlementUrl: https always, http only on loopback
 * (local web/license-sim).
 */
function isAllowedEntitlementUrl(url) {
  if (String(url || '').startsWith('https://')) return true;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:') return false;
    return u.hostname === '127.0.0.1' || u.hostname === 'localhost';
  } catch {
    return false;
  }
}

/** Mirror of main withInstallId — Upgrade URL gets ?installId=. */
function withInstallId(url, installId) {
  try {
    const u = new URL(url);
    if (!u.searchParams.has('installId')) u.searchParams.set('installId', installId);
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}installId=${encodeURIComponent(installId)}`;
  }
}

module.exports = {
  TRIAL_DAYS,
  defaultEntitlementState,
  effectivePlan,
  requirePro,
  canUseProFeatures,
  startTrial,
  applyRemoteEntitlement,
  isAllowedEntitlementUrl,
  withInstallId,
};
