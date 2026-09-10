# Munder Difflin Account (`web/account`)

Pro subscription hub + Stripe↔licence proxy. Marketing site remains [munderdiffl.in](https://munderdiffl.in/) (`app/docs`). Teams org console is stubbed (`/console/welcome` → soon).

## Run

```bash
cd web/account
cp .env.example .env.local   # optional Stripe keys
npm install
npm run dev                  # http://127.0.0.1:3000
```

Without Stripe keys, **Get Pro** activates a local Pro licence immediately (dev stand-in).

## Env

| Variable | Purpose |
|----------|---------|
| `MD_ACCOUNT_URL` | Public base URL (Checkout return URLs). Use `http://…` locally so session cookies are not `Secure`. |
| `MD_ACCOUNT_SECRET` | Session HMAC secret |
| `MD_COOKIE_SECURE=1` | Force `Secure` cookies when `MD_ACCOUNT_URL` is unset |
| `STRIPE_SECRET_KEY` | Stripe secret |
| `STRIPE_PRICE_PRO_MONTH` / `STRIPE_PRICE_PRO_YEAR` | Price IDs |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |

## Desktop wiring

Point the Electron process at this app instead of `web/license-sim`:

```bash
export MD_UPGRADE_URL=http://127.0.0.1:3000/pro/licence
export MD_ENTITLEMENT_URL=http://127.0.0.1:3000/api/entitlement
export MD_TEAMS_URL=http://127.0.0.1:3000/console/welcome
```

- `GET /api/entitlement?installId=` — same shape as the license sim
- `POST /api/license/redeem` with `{ key, installId }` — binds a minted key to one machine

## Flows

1. Sign in (email session) → hub (team vs yourself)
2. Pro dashboard → licence buy → Stripe Checkout (or dev activate)
3. Licence manage: key, billing portal, sign-in code, machine unbind, invoices, download
4. Teams: `/console/welcome` stub only (full org console is the next cycle)
