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
  };
}

function effectivePlan(state, nowMs, opts = {}) {
  if (opts.devUnlock) return 'pro';
  if (state.plan === 'pro') return 'pro';
  if (state.plan === 'trial' && state.trialEndsAt) {
    const end = Date.parse(state.trialEndsAt);
    if (Number.isFinite(end) && nowMs <= end) return 'trial';
    return 'community';
  }
  return 'community';
}

function canUseProFeatures(plan) {
  return plan === 'pro' || plan === 'trial';
}

function requirePro(plan, _feature) {
  return canUseProFeatures(plan);
}

function startTrial(state, nowMs, days = TRIAL_DAYS) {
  if (state.plan === 'pro') return state;
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

module.exports = {
  TRIAL_DAYS,
  defaultEntitlementState,
  effectivePlan,
  requirePro,
  startTrial,
};
