/** Pro / community entitlement types and pure gate logic (no I/O). */

export type PlanId = 'community' | 'trial' | 'pro';

export type ProFeature = 'proShell' | 'stapler';

export interface EntitlementState {
  plan: PlanId;
  /** ISO timestamp when trial started; null if never started. */
  trialStartedAt: string | null;
  /** ISO timestamp when trial ends; null if no trial. */
  trialEndsAt: string | null;
  /** User toggled Stapler on (still requires plan gate). */
  staplerEnabled: boolean;
  /** Install id for remote entitlement refresh (opaque, not a payment id). */
  installId: string;
  /** Last successful remote refresh ISO time. */
  lastRefreshAt: string | null;
}

export interface BillingConfig {
  upgradeUrl: string;
  manageUrl: string;
  /** Optional HTTP GET endpoint returning { plan: 'pro' | 'trial' | 'community', trialEndsAt?: string }. */
  entitlementUrl: string;
}

export const DEFAULT_BILLING: BillingConfig = {
  upgradeUrl: 'https://harnessmd.com/pro',
  manageUrl: 'https://harnessmd.com/console',
  entitlementUrl: '',
};

export const TRIAL_DAYS = 14;

export function defaultEntitlementState(installId: string): EntitlementState {
  return {
    plan: 'community',
    trialStartedAt: null,
    trialEndsAt: null,
    staplerEnabled: false,
    installId,
    lastRefreshAt: null,
  };
}

/** Effective plan after applying trial expiry and optional dev unlock. */
export function effectivePlan(
  state: EntitlementState,
  nowMs: number,
  opts: { devUnlock?: boolean } = {}
): PlanId {
  if (opts.devUnlock) return 'pro';
  if (state.plan === 'pro') return 'pro';
  if (state.plan === 'trial' && state.trialEndsAt) {
    const end = Date.parse(state.trialEndsAt);
    if (Number.isFinite(end) && nowMs <= end) return 'trial';
    return 'community';
  }
  return 'community';
}

export function canUseProFeatures(plan: PlanId): boolean {
  return plan === 'pro' || plan === 'trial';
}

export function requirePro(plan: PlanId, _feature: ProFeature): boolean {
  return canUseProFeatures(plan);
}

/** Start trial once. Returns updated state; no-op if already started or already pro. */
export function startTrial(state: EntitlementState, nowMs: number, days = TRIAL_DAYS): EntitlementState {
  if (state.plan === 'pro') return state;
  if (state.trialStartedAt) {
    // Re-assert trial if still within window
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

export function applyRemoteEntitlement(
  state: EntitlementState,
  remote: { plan?: string; trialEndsAt?: string | null },
  nowMs: number
): EntitlementState {
  const plan = remote.plan === 'pro' || remote.plan === 'trial' || remote.plan === 'community'
    ? remote.plan
    : state.plan;
  return {
    ...state,
    plan,
    trialEndsAt: remote.trialEndsAt ?? state.trialEndsAt,
    lastRefreshAt: new Date(nowMs).toISOString(),
  };
}
