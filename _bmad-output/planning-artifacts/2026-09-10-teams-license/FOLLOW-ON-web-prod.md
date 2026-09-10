---
title: Follow-on — production web/ (after Teams license)
status: deferred
created: 2026-09-10
blocked_by: Teams license app cycle (T1–T4)
---

# Follow-on: production `web/`

**Do not start until** the in-app Teams license point (entitlements + local sim) is finished.

## Intent (owner reminder 2026-09-10)

Ship a professional / production `web/` that includes:

1. **License ↔ Stripe proxy** — bridges paid Stripe checkout to minted/redeemable license entitlements (Pro + Teams seats), replacing the local-only `web/license-sim/` for real customers.
2. **Real presentation site** — marketing / product presentation (not the Electron app).
3. **User backend** — accounts / console surface that owns plan, seats, card, invoices (app still never sees payment identifiers).

## Notes

- Keep the Electron privacy rule: no payment ids in the desktop app; Refresh plan / entitlement GET only.
- `web/license-sim/` remains the local stand-in until this cycle lands.
