---
title: Teams license — analysis (separate from Pro)
status: final
created: 2026-09-10
---

# Teams license — analysis

This document analyzes **Teams licensing only**. Sealed cross-device messaging, relay crypto, and seat UX beyond entitlement gates are product work that depends on a license model — they are named here as dependents, not as this cycle’s delivery.

## Marketed product contract (source: `app/docs/index.html`)

| Fact | Detail |
|------|--------|
| Same binary | Free / Pro / Teams share one download; Teams “unlocks the network”. |
| Price | $39/seat/month or $399/seat/year; **2–20 seats** self-serve; >20 = sales. |
| Trial | Card at checkout; **first charge on day 14** (unlike Pro’s card-optional marketing ambiguity). |
| Console | Plan, seats, card, invoices live at harnessmd.com/console — **not in the Electron app**. |
| Per seat | “Everything in Pro for every seat”; each person’s orchestrator on their own machine / own keys. |
| Network promise | Orchestrators talk; messages sealed per device; relay cannot open boxes. |
| Coming (not sold) | Remote control app; hosted sandboxes. |

Pricing comment in the site points at `web/harnessmd/src/server/pricing.ts` as external source of truth (not in this repo’s product tree).

## As-built Pro license model (what Teams must extend)

Current app (`app/src/shared/entitlements.ts` + `app/src/main/entitlements.ts`):

- Plans: `community | trial | pro` only — **no `teams`**.
- Machine identity: opaque `installId` in local `entitlements.json`.
- Paid Pro path: external Upgrade URL → redeem key bound to `installId` → **Refresh plan** GET `{ plan, trialEndsAt? }`.
- Local sim: `web/license-sim/` (demo key → pro). Env: `MD_UPGRADE_URL`, `MD_ENTITLEMENT_URL`.
- Trial: 14-day **in-app** trial for Pro features; independent of Teams card-at-checkout story.
- Gates: `proShell`, `stapler` via `requirePro` (trial or pro).

## Gap analysis — license layer

| Gap | Why it matters |
|-----|----------------|
| No `plan: 'teams'` | Cannot distinguish network unlock from solo Pro. |
| No org / seat identity | Teams is multi-seat; Pro is one machine. Need durable ids the console can bind (without payment ids in-app). |
| Entitlement payload too small | Today only `{ plan, trialEndsAt }`. Teams needs at least seat count / seat role / org membership / feature flags (e.g. `network: true`). |
| Upgrade vs Start a team | Site uses different CTAs (`/pro` vs `/console`). App today has single `upgradeUrl` / `manageUrl`. |
| Seat transfer / revoke | Console can remove a seat; app must refresh to community/pro and drop network gates. |
| Device bind vs seat bind | Pro: one key ↔ one `installId`. Teams: seat ↔ person/device; may allow rebind with overwrite policy (same as Pro sim) or stricter admin-controlled bind. |

## Gap analysis — dependents (out of license MVP)

| Dependent | As-built status in this repo |
|-----------|------------------------------|
| Sealed messaging / `deviceIdentity` | **Not present** — marketing cites `src/main/deviceIdentity.ts`; file absent here (0.5.x-era). |
| Relay / Private Network | Not implemented. |
| Seat console UI in-app | Explicit non-goal for Pro; remains console-hosted. |
| Sandboxes / remote control | Marketed as coming; not sold. |

## Principles to keep (from Pro)

1. App never collects or transmits payment identifiers.
2. Boot reads **local** entitlements; remote is Refresh (or a Teams equivalent), not silent every-boot sync unless a later cycle decides otherwise.
3. External console owns billing; Electron owns gates + local persistence.
4. Local simulator stays outside `app/` (extend `web/license-sim/` or sibling) for Teams demos.

## Open questions → locked (2026-09-10)

| # | Question | Lock |
|---|----------|------|
| 1 | Does `teams` include Pro features? | **Yes** — always. |
| 2 | Redeem artifact shape? | Per-seat **`MDS-…` key** (sim + compatible with Pro family). Invite tokens later. |
| 3 | Minimum Refresh JSON? | `{ plan, trialEndsAt?, orgId?, seatId?, seatLabel?, networkEnabled? }` |
| 4 | Does in-app Pro trial grant network? | **No** — network only for `plan === 'teams'`. |
| 5 | `PlanId` vs tier map? | Extend **`PlanId` with `'teams'`**. |

See `PLAN.md` (`status: ready`) and `epics.md`.

## Recommendation

Treat **Teams license** as a thin extension of the Pro entitlement plane:

- Add `teams` plan (implies Pro feature gates).
- Extend remote entitlement schema with org/seat metadata + `networkEnabled`.
- Wire console Teams URL + Refresh; extend `web/license-sim/` for multi-seat demo keys.
- **Do not** build sealed network / relay in the same license MVP — gate future work behind `canUse('network')`.
