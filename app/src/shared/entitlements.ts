/** Pro / Teams / community entitlement types and pure gate logic (no I/O). */

export type PlanId = 'community' | 'trial' | 'pro' | 'teams';

export type ProFeature = 'proShell' | 'stapler' | 'network';

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
  /** Teams org id from console / sim (null when not on a team seat). */
  orgId: string | null;
  /** Teams seat id bound to this install (null when not on a team seat). */
  seatId: string | null;
  /** Optional display label for the seat. */
  seatLabel: string | null;
  /** True when Teams network features may be gated on (plan must also be teams). */
  networkEnabled: boolean;
}

export interface BillingConfig {
  upgradeUrl: string;
  manageUrl: string;
  /** Teams console / start-a-team URL (seats live here; no payment ids in-app). */
  teamsUrl: string;
  /** Optional HTTP GET endpoint returning { plan, trialEndsAt?, orgId?, … }. */
  entitlementUrl: string;
}

export const DEFAULT_BILLING: BillingConfig = {
  upgradeUrl: 'https://harnessmd.com/pro',
  manageUrl: 'https://harnessmd.com/console',
  teamsUrl: 'https://harnessmd.com/console',
  entitlementUrl: '',
};

export const TRIAL_DAYS = 14;

export type RemoteEntitlement = {
  plan?: string;
  trialEndsAt?: string | null;
  orgId?: string | null;
  seatId?: string | null;
  seatLabel?: string | null;
  networkEnabled?: boolean;
};

export function defaultEntitlementState(installId: string): EntitlementState {
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

function isPlanId(value: string | undefined): value is PlanId {
  return value === 'community' || value === 'trial' || value === 'pro' || value === 'teams';
}

/** Effective plan after applying trial expiry and optional dev unlock. */
export function effectivePlan(
  state: EntitlementState,
  nowMs: number,
  opts: { devUnlock?: boolean } = {}
): PlanId {
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

export function canUseProFeatures(plan: PlanId): boolean {
  return plan === 'pro' || plan === 'trial' || plan === 'teams';
}

/**
 * Feature gate. `network` requires teams + networkEnabled; Pro UI/Stapler use
 * canUseProFeatures (teams included). Trial never unlocks network.
 */
export function requirePro(
  plan: PlanId,
  feature: ProFeature,
  opts: { networkEnabled?: boolean } = {}
): boolean {
  if (feature === 'network') return plan === 'teams' && !!opts.networkEnabled;
  return canUseProFeatures(plan);
}

/** Start trial once. Returns updated state; no-op if already started, pro, or teams. */
export function startTrial(state: EntitlementState, nowMs: number, days = TRIAL_DAYS): EntitlementState {
  if (state.plan === 'pro' || state.plan === 'teams') return state;
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
  remote: RemoteEntitlement,
  nowMs: number
): EntitlementState {
  const plan = isPlanId(remote.plan) ? remote.plan : state.plan;
  const onTeams = plan === 'teams';
  const networkEnabled = onTeams
    ? remote.networkEnabled !== false
    : false;
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
