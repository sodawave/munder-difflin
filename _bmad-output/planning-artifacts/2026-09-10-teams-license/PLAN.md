---
title: Plan — Teams license (entitlements + local sim)
status: draft
created: 2026-09-10
depends_on: Pro cycle closed (2026-09-10-pro-upgrade)
---

# Plan: Teams license

## Locked decisions (from analysis; confirm before build)

- **Scope = license plane only** — plan/seat/org entitlements, Refresh, console URLs, local sim. No sealed relay, no `deviceIdentity`, no sandboxes.
- **`teams` implies Pro features** — `requirePro` true for `teams` (and existing `pro` / `trial`).
- **Console owns seats/billing** — app never sees payment ids; same privacy rule as Pro.
- **Boot still local-only** — remote sync via Refresh plan (or Teams-named control); no mandatory auto-refresh on boot in this plan.
- **Simulator outside `app/`** — extend `web/license-sim/` (or `web/teams-sim/`) for multi-seat demo.

## Proposed entitlement model

```ts
PlanId = 'community' | 'trial' | 'pro' | 'teams'

EntitlementState += {
  orgId?: string | null
  seatId?: string | null
  seatLabel?: string | null   // display only
  networkEnabled?: boolean    // true when plan === 'teams' (or explicit flag)
}
```

Remote Refresh body (minimum):

```json
{
  "plan": "teams",
  "trialEndsAt": null,
  "orgId": "org_…",
  "seatId": "seat_…",
  "seatLabel": "Ada",
  "networkEnabled": true
}
```

Invalid / revoked seat → `{ "plan": "community" }` or `{ "plan": "pro" }` per console policy (default: community if seat revoked).

## Workstreams

### 1. Shared + main entitlements

- Extend `PlanId` and `applyRemoteEntitlement` / `effectivePlan` / `canUseProFeatures`.
- Gate stub: `canUse('network')` or `networkEnabled && plan === 'teams'` (no network UI required yet — gate for future).
- Settings: show Teams badge when plan is teams; CTA **Start a team** / **Manage seats** → `billing.teamsUrl` or reuse `manageUrl` (`https://harnessmd.com/console`).
- Env overrides (document in sim `.env.example`):
  - keep `MD_UPGRADE_URL` / `MD_ENTITLEMENT_URL`
  - add `MD_TEAMS_URL` → console / teams checkout (optional if manageUrl suffices)

### 2. Local Teams sim

- Demo keys e.g. `MDS-TEAM0-00000-00001` … bind `(key → { installId, orgId, seatId, plan: 'teams' })`.
- Cap seats in sim (e.g. 5) to exercise “seat full”.
- `GET /entitlement?installId=` returns Teams payload when bound.
- README checklist: redeem seat → Refresh → Settings shows Teams; revoke in sim → Refresh → community.

### 3. Docs

- AGENTS.md: Teams license cycle pointer; network protocol still future.
- Close note in Pro retrospective already points here.

## Non-goals

- X25519 / sealed boxes / relay service.
- In-app seat admin (invite, remove, invoices).
- Hosted sandboxes / mobile remote control.
- Changing Pro solo MDS flow (except shared schema compatibility).

## Verify

- Unit tests: `teams` ⇒ Pro gates; revoked seat ⇒ no Pro/network.
- Sim curl: community → redeem team key → teams payload → revoke → community.
- `npm run typecheck` in `app/`.
- Manual: Settings badge + Manage opens console URL with `installId` (and `seatId` if present).

## Sequencing after this plan

1. Human locks open questions in ANALYSIS.md (especially redeem artifact shape).
2. BMAD PRD/epics for Teams license (this plan’s workstreams → stories).
3. Later cycle: Private Network protocol behind `networkEnabled`.
