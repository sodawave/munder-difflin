---
title: Pro Upgrade — Cycle Close / Retrospective
status: accepted
created: 2026-09-10
epic: Pro Upgrade E1–E5 + local license sim
verdict: accepted
---

# Pro Upgrade — Cycle Close

## Verdict

**Accepted.** Pro entitlements, Pro shell, Stapler (+ AV), polish, and the local license simulator are on `dev`. Human OK + merge of license-sim PR #1 completed 2026-09-10 (`38e4d199`).

## What shipped (evidence)

| Slice | Evidence |
|-------|----------|
| E1 Entitlements | `app/src/shared/entitlements.ts`, `app/src/main/entitlements.ts`, Settings plan UI, `app/test/entitlements.*` |
| E2 Pro sidebar | `ui.shell` classic\|pro, ProShell |
| E3–E4 Stapler | Stapler window, capture, message/meeting/dictation + Groq BYOK |
| E5 Polish | i18n, hero, AGENTS pitfall, permissions UX |
| License sim | `web/license-sim/`, `MD_UPGRADE_URL` / `MD_ENTITLEMENT_URL`, installId on Upgrade, loopback Refresh plan |

## Success criteria (from PRD) vs as-built

| Criterion | Result |
|-----------|--------|
| Community unchanged without Pro | Met — gates on plan |
| Trial/Pro unlock sidebar + Stapler | Met |
| No payment IDs in telemetry / app | Met — external checkout + local entitlements only |
| Screenshot path reaches orchestrator | Met (Stapler send path) |

## Explicitly deferred (not defects)

- Real Stripe / harnessmd.com production mint + redeem (sim stands in locally).
- Auto-refresh entitlements on every boot (Refresh plan remains manual).
- In-app license key paste UI.
- **Teams** (seat console, sealed network, plan `teams`) — separate cycle; see `../2026-09-10-teams-license/`.

## Process notes

- Built Pro from scratch without 0.5.x source; marketing site was the product contract.
- Stale Electron preload briefly broke entitlements IPC; fixed with optional chaining + restart.
- CI for PRs targeting `dev` is evidence-gated (`PR evidence`); full `ci.yml` typecheck/build still targets `main` / `release/**` only.

## Acceptance

Cycle **closed**. No further Pro stories required before starting Teams **license** analysis/plan.
