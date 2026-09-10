/**
 * Pure entitlement gate tests (no Electron).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  effectivePlan,
  requirePro,
  startTrial,
  defaultEntitlementState,
  applyRemoteEntitlement,
  isAllowedEntitlementUrl,
  withInstallId,
  TRIAL_DAYS,
} = require('./entitlements.logic.cjs');

describe('entitlements', () => {
  it('community cannot use pro features', () => {
    const s = defaultEntitlementState('x');
    const plan = effectivePlan(s, Date.now());
    assert.equal(plan, 'community');
    assert.equal(requirePro(plan, 'stapler'), false);
  });

  it('dev unlock forces pro', () => {
    const s = defaultEntitlementState('x');
    assert.equal(effectivePlan(s, Date.now(), { devUnlock: true }), 'pro');
  });

  it('startTrial sets 14-day window once', () => {
    const now = Date.parse('2026-09-10T12:00:00.000Z');
    let s = defaultEntitlementState('x');
    s = startTrial(s, now, TRIAL_DAYS);
    assert.equal(s.plan, 'trial');
    assert.ok(s.trialStartedAt);
    assert.ok(s.trialEndsAt);
    const end = Date.parse(s.trialEndsAt);
    assert.equal(end - now, TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const again = startTrial(s, now + 1000, TRIAL_DAYS);
    assert.equal(again.trialStartedAt, s.trialStartedAt);
  });

  it('expired trial falls back to community', () => {
    const s = {
      ...defaultEntitlementState('x'),
      plan: 'trial',
      trialStartedAt: '2026-01-01T00:00:00.000Z',
      trialEndsAt: '2026-01-15T00:00:00.000Z',
    };
    assert.equal(effectivePlan(s, Date.parse('2026-02-01T00:00:00.000Z')), 'community');
  });

  it('active trial allows stapler gate', () => {
    const now = Date.parse('2026-09-10T12:00:00.000Z');
    const s = startTrial(defaultEntitlementState('x'), now);
    const plan = effectivePlan(s, now);
    assert.equal(requirePro(plan, 'stapler'), true);
  });

  it('Refresh plan applies remote pro from license sim payload', () => {
    const now = Date.parse('2026-09-10T14:00:00.000Z');
    const before = defaultEntitlementState('install-a');
    const after = applyRemoteEntitlement(before, { plan: 'pro', trialEndsAt: null }, now);
    assert.equal(after.plan, 'pro');
    assert.equal(after.installId, 'install-a');
    assert.equal(after.lastRefreshAt, '2026-09-10T14:00:00.000Z');
    assert.equal(requirePro(effectivePlan(after, now), 'proShell'), true);
  });

  it('entitlement URL allowlist permits https and loopback http only', () => {
    assert.equal(isAllowedEntitlementUrl('https://harnessmd.com/entitlement'), true);
    assert.equal(isAllowedEntitlementUrl('http://127.0.0.1:8787/entitlement'), true);
    assert.equal(isAllowedEntitlementUrl('http://localhost:8787/entitlement'), true);
    assert.equal(isAllowedEntitlementUrl('http://evil.example/entitlement'), false);
    assert.equal(isAllowedEntitlementUrl('ftp://127.0.0.1/x'), false);
  });

  it('Upgrade URL appends installId once', () => {
    const u = withInstallId('http://127.0.0.1:8787/', 'abc-123');
    assert.match(u, /[?&]installId=abc-123/);
    const again = withInstallId(u, 'other');
    assert.match(again, /installId=abc-123/);
    assert.doesNotMatch(again, /installId=other/);
  });
});
