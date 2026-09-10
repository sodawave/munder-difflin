---
title: Plan — Teams license (entitlements + local sim)
status: ready
created: 2026-09-10
updated: 2026-09-10
depends_on: Pro cycle closed (merged to dev)
---

# Plan: Teams license

Executable plan after Pro close. **License plane only** — Private Network crypto is a later cycle.

## Locked decisions

| # | Decision |
|---|----------|
| L1 | Scope = entitlements + Settings CTAs + local sim. No sealed relay, no `deviceIdentity`, no sandboxes, no in-app seat admin. |
| L2 | `PlanId` extends with `'teams'` (not a separate tier/features map). |
| L3 | `teams` ⇒ Pro feature gates (`proShell`, `stapler`) always. |
| L4 | In-app Pro **trial does not** grant network / Teams. Network only when `plan === 'teams'` (or explicit `networkEnabled: true` from remote). |
| L5 | Redeem artifact for local sim = per-seat `MDS-…` key (same family as Pro). Production console may mint the same shape; invite tokens are out of scope. |
| L6 | One key ↔ one `installId` (re-redeem overwrites previous bind), same as Pro sim. |
| L7 | Seat revoke via Refresh → default `plan: 'community'` (clears org/seat/network). |
| L8 | Console URL: `billing.teamsUrl` (env `MD_TEAMS_URL`, default `https://harnessmd.com/console`); append `installId` (+ `seatId` when known). |
| L9 | Boot still reads local `entitlements.json` only; remote = Refresh plan. |
| L10 | Extend `web/license-sim/` (not a second package) for Teams demo keys. |

## Entitlement model

```ts
type PlanId = 'community' | 'trial' | 'pro' | 'teams'

type ProFeature = 'proShell' | 'stapler' | 'network'

interface EntitlementState {
  plan: PlanId
  trialStartedAt: string | null
  trialEndsAt: string | null
  staplerEnabled: boolean
  installId: string
  lastRefreshAt: string | null
  orgId: string | null
  seatId: string | null
  seatLabel: string | null
  networkEnabled: boolean
}
```

`effectivePlan` / `canUseProFeatures`: `pro | trial | teams` → Pro UI/Stapler.  
`requirePro(plan, 'network')` / `canUse('network')`: requires `plan === 'teams'` **and** `networkEnabled` (set true on Teams refresh; false on revoke).

### Refresh JSON

```json
{
  "plan": "teams",
  "trialEndsAt": null,
  "orgId": "org_demo",
  "seatId": "seat_1",
  "seatLabel": "Ada",
  "networkEnabled": true
}
```

Pro-only refresh stays `{ "plan": "pro", "trialEndsAt": null }` (org/seat null, `networkEnabled` false).

## Workstreams → stories

See `epics.md`. Summary:

1. **Shared gates** — PlanId, applyRemote, network gate, CJS test mirror.
2. **Main + Settings** — persist new fields; Teams badge; Start a team / Manage seats; `MD_TEAMS_URL`.
3. **license-sim** — Teams keys, seat cap, revoke endpoint or admin delete; README checklist.
4. **Docs verify** — AGENTS already points here; typecheck + tests + curl checklist.

## Non-goals

- X25519 / sealed boxes / relay.
- In-app invites, invoices, seat slider.
- Auto-refresh on every boot.
- Changing solo Pro MDS `MDS-00000-00000-00000` behavior.

## Verify

- Unit: `teams` ⇒ Pro gates + network; `trial`/`pro` ⇒ no network; revoke ⇒ community.
- Sim: redeem team key → Refresh teams → revoke → community.
- `npm run typecheck` from `app/`.
- Manual: Settings shows Teams; Manage opens console with `installId`.

## After this plan ships

1. BMAD cycle for Private Network behind `canUse('network')` (optional sequencing — may trail web/).
2. **Next major cycle (remember):** professional / production `web/` — real presentation site + user backend that **proxies licenses ↔ Stripe-paid entitlements** (replaces local `web/license-sim/` for prod). Do this only after the Teams license point in the app is done.
