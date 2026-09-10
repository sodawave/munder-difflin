---
title: Teams license — Epics & Stories
status: ready
created: 2026-09-10
---

# Teams license — Epics & Stories

## Epic T1 — Entitlement model — done
- T1-S1: Extend `PlanId` with `teams`; add `orgId` / `seatId` / `seatLabel` / `networkEnabled` defaults
- T1-S2: `applyRemoteEntitlement` maps Teams payload; revoke clears org/seat/network
- T1-S3: `canUseProFeatures` includes teams; new feature `'network'` gated to teams+networkEnabled
- T1-S4: CJS test mirror + unit tests (teams/pro/trial/revoke)

## Epic T2 — App wiring & Settings — done
- T2-S1: Persist new fields in main `entitlements.json`; IPC snapshot includes them
- T2-S2: `billing.teamsUrl` + `MD_TEAMS_URL` override; open with `installId` (+ `seatId` if set)
- T2-S3: Settings plan UI — Teams badge; Start a team / Manage seats CTAs; Refresh still used after console/sim redeem

## Epic T3 — Local license sim (Teams) — done
- T3-S1: Demo per-seat keys → `plan: teams` + org/seat fields; one bind per key
- T3-S2: Seat cap in sim (e.g. 5); reject when full
- T3-S3: Revoke path (e.g. `POST /api/license/revoke` `{ installId }` or delete bind)
- T3-S4: README checklist + `.env.example` (`MD_TEAMS_URL`)

## Epic T4 — Verify — in progress
- T4-S1: `npm run typecheck`; entitlements unit tests green
- T4-S2: Curl/sim checklist recorded; AGENTS pitfall still accurate
