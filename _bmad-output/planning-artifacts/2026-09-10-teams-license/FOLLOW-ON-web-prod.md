---
title: Follow-on — production web/ (after Teams license)
status: done_pro_account
created: 2026-09-10
updated: 2026-09-10
---

# Follow-on: production `web/`

## Done this cycle (Pro account)

Shipped under `web/account/` (Next.js):

1. **Marketing entry** — public site stays [munderdiffl.in](https://munderdiffl.in/) (`app/docs`); account app links in/out.
2. **Pro subscription UI** — hub, Pro dashboard, licence buy, licence manage (billing, sign-in code, machine, invoices, download).
3. **Backend** — email session, Stripe Checkout + Customer Portal + webhook (dev activate without keys), mint `MDS-…` keys, bind `installId`, `GET /api/entitlement?installId=`, `POST /api/license/redeem`.
4. **Teams stub** — `/console/welcome` + `/console/teams-soon` only.

## Still next

- Full Teams org console / seat purchasing UI
- Production deploy + real Stripe keys
- Magic-link / OTP auth (replace local email session)

## Desktop wiring

```bash
export MD_UPGRADE_URL=http://127.0.0.1:3000/pro/licence
export MD_ENTITLEMENT_URL=http://127.0.0.1:3000/api/entitlement
export MD_TEAMS_URL=http://127.0.0.1:3000/console/welcome
```
