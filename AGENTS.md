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
- Do not start a full Analyst → PRD cycle unless the human explicitly asks.
