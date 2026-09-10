# Agent instructions — Munder Difflin workspace

## What this repo is

- **Product:** Munder Difflin, located entirely under `app/`.
- **Method:** BMad Method at the workspace root (`_bmad/`, Cursor skills under `.agents/skills/` including `bmad-help`).
- BMAD is the **principal development process**. Office/hire agents inside the product are runtime features of Munder, not the build method.

## Branches

Default flow: **work branch → test with evidence → human OK → merge to `dev`**. Do not develop directly on `dev` or `main` unless the human explicitly agrees (e.g. trivial hotfix).

| Branch | Role |
|--------|------|
| `feat/*`, `fix/*`, `chore/*`, `docs/*`, `spec/*`, … | Day-to-day work — one branch per unit of change |
| `dev` | Integration only — receives merges after develop → test → OK |
| `main` | Production / deploy — merge from `dev` only when the human explicitly asks |

- Prefer branch names aligned with conventional commits (`feat/…` + `feat: …`, `fix/…` + `fix: …`, etc.).
- When work is driven by a formal spec, a `spec/YYYY-MM-DD-<slug>` branch (or a `feat/…` linked to that spec) is the default option — not the only branch type.
- Do not merge to `main`, release, or deploy without an explicit human request.

## Language

- Chat with the human in **Spanish** when they write in Spanish.
- Write BMAD formal artifacts (PRD, epics, stories, architecture, specs) in **English**.

## Working tree

- Implement product code only under `app/`.
- Keep methodology files at repo root (`_bmad/`, `_bmad-output/`, `docs/superpowers/`, `AGENTS.md`).
- Do not install or reinstall BMAD inside `app/`.

## Quality

- Follow spec → plan → implement → verify with evidence.
- Prefer tests for behavior changes; otherwise run an executable verification checklist.
- Double-confirm large/irreversible steps with the human.
- Never claim success, existence, or test results without verifying in the current session.

## Process

- Prefer BMAD Cursor skills (start with `bmad-help`, then agents and workflows) for product work.
- Superpowers and other local skills are optional helpers; they do not replace BMAD for planned product delivery.

<!-- bmad:context -->
<!-- Verified 2026-09-10 against b1439959. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## munder-difflin (product)

Local-first Electron harness that turns coding-agent CLIs (`claude`, `codex`, `agy`, …) into coordinated “office” agents with PTY terminals, hive mail, and a Pixi floor. Stack: Electron + React + TypeScript + node-pty + xterm.js + Pixi. Product code and product docs live under `app/`. Planning artifacts: `_bmad-output/planning-artifacts/`. Contributor map: `app/docs/ARCHITECTURE.md`. Treat `app/SPEC.md` as historical MVP notes — prefer ARCHITECTURE.md + `app/src/` for as-built truth.

## Policy

- Never invent product behavior that contradicts `app/src/` — verify before asserting.
- Never put BMAD method files under `app/`.
- Never commit secrets (`.env`, signing keys); honor root and `app/` gitignores.
- UI tokens and visual rules: derive from `app/DESIGN.md` / `app/src/renderer/src/design/`, do not invent a parallel palette.

## Where things are

- Electron main (PTY, hive, hooks, memory): `app/src/main/` — start at `index.ts`, `pty.ts`, `hive.ts`, `hooks.ts`.
- Preload bridge: `app/src/preload/` → typed `window.cth`.
- Renderer (floor, Command Center, terminals): `app/src/renderer/src/`.
- Hive / multi-agent design intent: `app/HIVE.md` (code is truth for what is built).
- Marketing/site + GitHub Pages content: `app/docs/` (CNAME `munderdiffl.in`).
- Focused Node tests: `app/test/*.test.cjs` via `npm run test:focused` from `app/`.

## Running and verifying

- All npm scripts run from **`app/`** (`cd app`), not the workspace root.
- After clone: `npm ci` in `app/` (postinstall rebuilds `node-pty` for Electron via `tools/electron-rebuild-with-sdk.cjs`, which applies a Darwin SDK libc++ fallback when CLT headers are incomplete).
- Iterate with `npm run typecheck` and `npm run test:focused`; full Electron boot is `npm run dev`.
- CI typecheck/build use `working-directory: app` (see `.github/workflows/ci.yml`).

## Conventions that differ from defaults

- Two data planes: **terminal** (`PtyManager` / node-pty IPC) and **event/hive** (hooks + on-disk mail/router) — do not collapse them into one channel.
- Main process is the sole git committer for hive coordination; agents write files, main commits (see `app/HIVE.md`).
- Design tokens live in `app/src/renderer/src/design/`; new UI must follow `app/DESIGN.md`.

## Known pitfalls

- `app/SPEC.md` still describes an early tmux-based terminal plane; as-built uses **node-pty** (`app/src/main/pty.ts`). Prefer ARCHITECTURE.md + code.
- Absolute GitHub URLs for product assets use `main/app/docs/`; remote catalog/hero fetchers try `app/docs/` then fall back to legacy `docs/` on upstream.
- Do not assume root `docs/` is the product site — it only holds `docs/superpowers/` methodology.
- **Pro** is a local entitlement (`app/src/main/entitlements.ts`) plus external checkout via `shell.openExternal` — the app never collects or sends payment identifiers. Teams / seat console remains a future BMAD cycle. Dev unlock: `MD_PRO_DEV_UNLOCK=1`.

<!-- /bmad:context -->
