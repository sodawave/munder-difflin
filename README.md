# Munder Difflin — workspace

This repository is a **BMAD-method workspace**. The product lives in [`app/`](./app/).

## Layout

| Path | Role |
|------|------|
| `app/` | Munder Difflin (Electron app) |
| `_bmad/` | BMad Method modules (BMM, TEA, CIS) |
| `_bmad-output/` | Planning & implementation artifacts (English) |
| `.cursor/commands/bmad/` | Cursor slash commands |
| `docs/superpowers/` | Workspace design specs & implementation plans |
| `AGENTS.md` | Process rules for coding agents |

## Product

```bash
cd app
npm ci
npm run dev
```

See [`app/README.md`](./app/README.md) for product documentation.

## Method

After BMAD is installed, use `/bmad-help` in Cursor. Chat may be in Spanish; formal BMAD documents are English.
