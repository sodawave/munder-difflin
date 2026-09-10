/**
 * Main-process entitlement persistence and refresh.
 * Payment identifiers never flow through this module — only plan + trial / seat metadata.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { shell } from 'electron';
import {
  type EntitlementState,
  type BillingConfig,
  type PlanId,
  type ProFeature,
  type RemoteEntitlement,
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

/** Drop the old harnessmd.com placeholder so Start a team / Manage seats open
 *  our account console instead of a dead brand site. */
function scrubLegacyBillingHost(url: string | undefined, fallback: string): string {
  const u = (url || '').trim();
  if (!u) return fallback;
  try {
    const host = new URL(u).hostname.toLowerCase();
    if (host === 'harnessmd.com' || host.endsWith('.harnessmd.com')) return fallback;
  } catch {
    return fallback;
  }
  return u;
}

export function setBillingConfig(partial: Partial<BillingConfig> | undefined): void {
  const merged = { ...DEFAULT_BILLING, ...partial };
  billing = {
    ...merged,
    upgradeUrl: scrubLegacyBillingHost(merged.upgradeUrl, DEFAULT_BILLING.upgradeUrl),
    manageUrl: scrubLegacyBillingHost(merged.manageUrl, DEFAULT_BILLING.manageUrl),
    teamsUrl: scrubLegacyBillingHost(merged.teamsUrl, DEFAULT_BILLING.teamsUrl),
    entitlementUrl: scrubLegacyBillingHost(merged.entitlementUrl, DEFAULT_BILLING.entitlementUrl),
  };
}

/** Apply MD_* URL env overrides over the current billing config (local account / sim). */
export function applyBillingEnvOverrides(): void {
  const upgrade = (process.env.MD_UPGRADE_URL || '').trim();
  const manage = (process.env.MD_MANAGE_URL || '').trim();
  const entitlement = (process.env.MD_ENTITLEMENT_URL || '').trim();
  const teams = (process.env.MD_TEAMS_URL || '').trim();
  if (upgrade) billing = { ...billing, upgradeUrl: upgrade };
  if (manage) billing = { ...billing, manageUrl: manage };
  if (entitlement) billing = { ...billing, entitlementUrl: entitlement };
  if (teams) billing = { ...billing, teamsUrl: teams };
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
      orgId: typeof raw.orgId === 'string' ? raw.orgId : null,
      seatId: typeof raw.seatId === 'string' ? raw.seatId : null,
      seatLabel: typeof raw.seatLabel === 'string' ? raw.seatLabel : null,
      networkEnabled: !!raw.networkEnabled,
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
  canNetwork: boolean;
  billing: BillingConfig;
} {
  const plan = effectivePlan(state, Date.now(), { devUnlock: devUnlock() });
  return {
    state: { ...state },
    plan,
    canPro: requirePro(plan, 'proShell'),
    canNetwork: requirePro(plan, 'network', { networkEnabled: state.networkEnabled }),
    billing: getBillingConfig(),
  };
}

export function canUse(feature: ProFeature): boolean {
  const plan = effectivePlan(state, Date.now(), { devUnlock: devUnlock() });
  return requirePro(plan, feature, { networkEnabled: state.networkEnabled });
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

/** Append installId (and seatId when known) for console / local sim binding. */
function withMachineParams(url: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has('installId')) u.searchParams.set('installId', state.installId);
    if (state.seatId && !u.searchParams.has('seatId')) u.searchParams.set('seatId', state.seatId);
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    let out = `${url}${sep}installId=${encodeURIComponent(state.installId)}`;
    if (state.seatId) out += `&seatId=${encodeURIComponent(state.seatId)}`;
    return out;
  }
}

export async function openUpgrade(): Promise<void> {
  const base = billing.upgradeUrl || DEFAULT_BILLING.upgradeUrl;
  await shell.openExternal(withMachineParams(base));
}

export async function openManage(): Promise<void> {
  const url = billing.manageUrl || DEFAULT_BILLING.manageUrl;
  await shell.openExternal(withMachineParams(url));
}

export async function openTeams(): Promise<void> {
  const url = billing.teamsUrl || billing.manageUrl || DEFAULT_BILLING.teamsUrl;
  await shell.openExternal(withMachineParams(url));
}

/** True for production https, or loopback http used by web/license-sim. */
function isAllowedEntitlementUrl(url: string): boolean {
  if (url.startsWith('https://')) return true;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:') return false;
    return u.hostname === '127.0.0.1' || u.hostname === 'localhost';
  } catch {
    return false;
  }
}

/** GET text over https (via getText) or loopback http for the local license sim. */
function fetchEntitlementBody(url: string, timeoutMs: number): Promise<string> {
  if (url.startsWith('https://')) return getText(url, { timeoutMs });
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch (e) {
      reject(e);
      return;
    }
    const lib = parsed.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = lib(parsed, { method: 'GET', headers: { 'user-agent': 'munder-difflin' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        fetchEntitlementBody(res.headers.location, timeoutMs).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timed out')));
    req.end();
  });
}

export async function refreshEntitlements(): Promise<EntitlementState> {
  const url = (billing.entitlementUrl || '').trim();
  if (!url || !isAllowedEntitlementUrl(url)) {
    return { ...state };
  }
  try {
    const sep = url.includes('?') ? '&' : '?';
    const body = await fetchEntitlementBody(
      `${url}${sep}installId=${encodeURIComponent(state.installId)}`,
      8000
    );
    const remote = JSON.parse(body) as RemoteEntitlement;
    state = applyRemoteEntitlement(state, remote, Date.now());
    save();
  } catch {
    /* offline / misconfigured — keep local */
  }
  return { ...state };
}
