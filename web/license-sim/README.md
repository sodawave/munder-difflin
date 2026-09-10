# Local Pro license simulator

Standalone mock of harnessmd.com “Enter your license key” + entitlement refresh.
Lives **outside** `app/` — the Electron product only talks to it over HTTP.

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
npm run dev
```

See [`.env.example`](./.env.example) for the same values.

## Checklist (manual)

1. Start the sim (`npm start` in this folder).
2. Export `MD_UPGRADE_URL` / `MD_ENTITLEMENT_URL`, then `npm run dev` from `app/`.
3. In Settings → General, click **Upgrade** — browser opens with `?installId=<uuid>`.
4. Leave the demo key `MDS-00000-00000-00000`, click **Activate**.
5. Back in the app, click **Refresh plan** — badge should show **Pro**.
6. Confirm `{harnessHome}/entitlements.json` has `"plan": "pro"`.

## API

| Method | Path | Body / query | Result |
|--------|------|--------------|--------|
| `GET` | `/` | `?installId=` | License UI |
| `POST` | `/api/license/redeem` | `{ key, installId }` | Bind key → machine |
| `GET` | `/entitlement` | `?installId=` | `{ plan, trialEndsAt }` |

Demo key: **`MDS-00000-00000-00000`** → `pro`. One machine per key (re-redeem moves the bind).

State persists in `.data.json` (gitignored).

## Notes

- The 14-day **trial** in the app does not use this sim.
- Production Stripe → mint real `MDS-…` keys; this folder stays a local stand-in.
