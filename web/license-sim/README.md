# Local Pro / Teams license simulator

Standalone mock of harnessmd.com “Enter your license key” + entitlement refresh.
Lives **outside** `app/` — the Electron product only talks to it over HTTP.

> **Production path:** `web/account/` is the Pro subscription hub + Stripe↔licence proxy. This sim remains the local stand-in for desktop Refresh-plan without Stripe.


## Quick start

```bash
# Terminal A — simulator
cd web/license-sim
npm start
# → http://127.0.0.1:8787/

# Terminal B — Electron with billing overrides
cd app
export MD_UPGRADE_URL=http://127.0.0.1:8787/
export MD_ENTITLEMENT_URL=http://127.0.0.1:8787/entitlement
export MD_TEAMS_URL=http://127.0.0.1:8787/
npm run dev
```

See [`.env.example`](./.env.example) for the same values.

## Checklist (manual)

### Pro

1. Start the sim (`npm start` in this folder).
2. Export `MD_UPGRADE_URL` / `MD_ENTITLEMENT_URL` / `MD_TEAMS_URL`, then `npm run dev` from `app/`.
3. Settings → **Upgrade** — browser opens with `?installId=<uuid>`.
4. Demo key `MDS-00000-00000-00000` → **Activate**.
5. **Refresh plan** — badge **Pro**.

### Teams

1. Activate a seat key e.g. `MDS-TEAM0-00000-00001` (Ada) with a fresh `installId`.
2. **Refresh plan** — badge **Teams**; Pro features unlocked; `networkEnabled: true` in entitlement JSON.
3. Seat cap: five `MDS-TEAM0-…` keys; a sixth distinct seat redeem returns seat-cap error.
4. Revoke: `POST /api/license/revoke` `{ "installId": "…" }` then Refresh → **Community**.

## API

| Method | Path | Body / query | Result |
|--------|------|--------------|--------|
| `GET` | `/` | `?installId=` | License UI |
| `POST` | `/api/license/redeem` | `{ key, installId }` | Bind key → machine |
| `POST` | `/api/license/revoke` | `{ installId }` | Drop bind (Refresh → community) |
| `GET` | `/entitlement` | `?installId=` | `{ plan, trialEndsAt, orgId, seatId, seatLabel, networkEnabled }` |

Demo keys:

- **Pro:** `MDS-00000-00000-00000`
- **Teams seats:** `MDS-TEAM0-00000-00001` … `00005` (org `org_demo`, cap 5). `00006` exists only to exercise the seat-cap error.

One machine per key (re-redeem moves the bind). State persists in `.data.json` (gitignored).

## Notes

- The 14-day **in-app Pro trial** does not unlock Teams network.
- Production Stripe → mint real `MDS-…` keys via future prod `web/`; this folder stays a local stand-in.
