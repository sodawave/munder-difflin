# Munder Difflin — workspace

This repository is a **BMAD-method workspace**. The product lives in [`app/`](./app/).

## Layout

| Path | Role |
|------|------|
| `app/` | Munder Difflin (Electron app) |
| `_bmad/` | BMad Method modules (BMM, TEA, CIS) |
| `_bmad-output/` | Planning & implementation artifacts (English) |
| `.agents/skills/` | Cursor BMAD skills (e.g. `bmad-help`) |
| `docs/superpowers/` | Workspace design specs & implementation plans |
| `AGENTS.md` | Process rules for coding agents |

## Product

```bash
cd app
npm ci
npm run dev
```

On some macOS Command Line Tools installs, bare `electron-rebuild` fails looking for `<functional>`. `npm ci` in `app/` runs a Darwin SDK fallback automatically — details in [`app/README.md`](./app/README.md#prerequisites).

See [`app/README.md`](./app/README.md) for full product documentation.

## Method

After BMAD is installed, invoke the `bmad-help` skill in Cursor. Chat may be in Spanish; formal BMAD documents are English.

## GitHub Pages

Product site sources live in [`app/docs/`](./app/docs/) (CNAME `munderdiffl.in`). Deploy uses [`.github/workflows/pages.yml`](./.github/workflows/pages.yml) on push to `main`. In GitHub → Settings → Pages, set Source to **GitHub Actions** (branch `/docs` cannot serve `app/docs/`).
