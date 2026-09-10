/**
 * Main-process entitlement persistence and refresh.
 * Payment identifiers never flow through this module — only plan + trial timestamps.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { shell } from 'electron';
import {
  type EntitlementState,
  type BillingConfig,
  type PlanId,
  type ProFeature,
  DEFAULT_BILLING,
  defaultEntitlementState,
  effectivePlan,
  requirePro,
  startTrial,
  applyRemoteEntitlement,
} from '../shared/entitlements';
import { getText } from './fetchText';

let homeDir: string | null = null;
let state: EntitlementState = defaultEntitlementState(randomUUID());
let billing: BillingConfig = { ...DEFAULT_BILLING };

function statePath(): string | null {
  if (!homeDir) return null;
  return join(homeDir, 'entitlements.json');
}

export function setEntitlementsHome(dir: string | null): void {
  homeDir = dir;
  load();
}

export function setBillingConfig(partial: Partial<BillingConfig> | undefined): void {
  billing = { ...DEFAULT_BILLING, ...partial };
}

export function getBillingConfig(): BillingConfig {
  return { ...billing };
}

function load(): void {
  const p = statePath();
  if (!p || !existsSync(p)) {
    if (!state.installId) state = defaultEntitlementState(randomUUID());
    return;
  }
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8')) as Partial<EntitlementState>;
    state = {
      ...defaultEntitlementState(typeof raw.installId === 'string' ? raw.installId : randomUUID()),
      ...raw,
      installId: typeof raw.installId === 'string' && raw.installId ? raw.installId : randomUUID(),
    };
  } catch {
    /* keep defaults */
  }
}

function save(): void {
  const p = statePath();
  if (!p || !homeDir) return;
  try {
    mkdirSync(homeDir, { recursive: true });
    writeFileSync(p, JSON.stringify(state, null, 2));
  } catch {
    /* best-effort */
  }
}

function devUnlock(): boolean {
  return process.env.MD_PRO_DEV_UNLOCK === '1' || process.env.MD_PRO_DEV_UNLOCK === 'true';
}

export function getEntitlementSnapshot(): {
  state: EntitlementState;
  plan: PlanId;
  canPro: boolean;
  billing: BillingConfig;
} {
  const plan = effectivePlan(state, Date.now(), { devUnlock: devUnlock() });
  return {
    state: { ...state },
    plan,
    canPro: requirePro(plan, 'proShell'),
    billing: getBillingConfig(),
  };
}

export function canUse(feature: ProFeature): boolean {
  const plan = effectivePlan(state, Date.now(), { devUnlock: devUnlock() });
  return requirePro(plan, feature);
}

export function beginTrial(): EntitlementState {
  state = startTrial(state, Date.now());
  save();
  return { ...state };
}

export function setStaplerEnabled(on: boolean): EntitlementState {
  if (on && !canUse('stapler')) {
    state = startTrial(state, Date.now());
  }
  if (on && !canUse('stapler')) {
    return { ...state };
  }
  state = { ...state, staplerEnabled: !!on };
  save();
  return { ...state };
}

export function setPlanLocal(plan: PlanId): EntitlementState {
  state = { ...state, plan };
  save();
  return { ...state };
}

export async function openUpgrade(): Promise<void> {
  const url = billing.upgradeUrl || DEFAULT_BILLING.upgradeUrl;
  await shell.openExternal(url);
}

export async function openManage(): Promise<void> {
  const url = billing.manageUrl || DEFAULT_BILLING.manageUrl;
  await shell.openExternal(url);
}

export async function refreshEntitlements(): Promise<EntitlementState> {
  const url = (billing.entitlementUrl || '').trim();
  if (!url.startsWith('https://')) {
    return { ...state };
  }
  try {
    const sep = url.includes('?') ? '&' : '?';
    const body = await getText(`${url}${sep}installId=${encodeURIComponent(state.installId)}`, {
      timeoutMs: 8000,
    });
    const remote = JSON.parse(body) as { plan?: string; trialEndsAt?: string | null };
    state = applyRemoteEntitlement(state, remote, Date.now());
    save();
  } catch {
    /* offline / misconfigured — keep local */
  }
  return { ...state };
}
