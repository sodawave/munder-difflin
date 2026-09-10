---
title: Munder Difflin — Pro Upgrade PRD
status: final
created: 2026-09-10
updated: 2026-09-10
---

# Pro Upgrade PRD

## Purpose

Add **Pro** capabilities marketed on munderdiffl.in to this 0.4.6 community codebase **from scratch** (no 0.5.x source access). Teams remains out of scope.

## Goals

1. Entitlements: `community | trial | pro`, 14-day trial, external upgrade URL, optional remote entitlement refresh without payment IDs in-app.
2. Pro sidebar shell: compact one-screen-at-a-time control UI for Pro/trial users.
3. Stapler: floating always-on-top puck — screenshot → note → send path to orchestrator; invisible mode; later AV (message/meeting/dictation + Groq BYOK).

## Non-goals

- Teams network / sealed cross-device messaging / seat console.
- In-app card collection (Stripe/Razorpay SDKs).
- Pixel-perfect clone of closed 0.5.2 binaries.
- Hosted sandboxes / mobile remote control.

## Requirements

### Entitlements

- Persist plan state under harness home; expose via `window.cth.entitlements.*`.
- Trial starts once on first Pro/Stapler enable; 14 days.
- `upgrade()` → `shell.openExternal(billing.upgradeUrl)`.
- Dev unlock: `MD_PRO_DEV_UNLOCK=1`.
- Gate Stapler window creation and Pro shell when not entitled.

### Pro sidebar

- Config `ui.shell: classic | pro`.
- Classic remains default for community.
- Pro shell reuses Command Center surfaces; one primary panel.

### Stapler

- Separate always-on-top BrowserWindow; off until enabled in Pro settings.
- Screenshot region → PNG on disk → note card → send file path + note to god orchestrator queue.
- Content protection when “invisible”.
- AV: message ≤5 min, meeting 10-min chunks, dictation mic; Groq BYOK.

## Success

Community unchanged without Pro. Trial/Pro unlock sidebar + Stapler. No payment IDs in telemetry. Screenshot path reaches orchestrator.
