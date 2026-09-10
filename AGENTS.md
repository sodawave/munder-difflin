# Agent instructions — Munder Difflin workspace

## What this repo is

- **Product:** Munder Difflin, located entirely under `app/`.
- **Method:** BMad Method at the workspace root (`_bmad/`, Cursor commands under `.cursor/commands/bmad/`).
- BMAD is the **principal development process**. Office/hire agents inside the product are runtime features of Munder, not the build method.

## Branches

- Work only on `dev`.
- `main` is production/deploy. Merge `dev` → `main` only when the human explicitly asks.
- Do not merge to `main`, release, or deploy without that request.

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

- Prefer BMAD slash commands (`/bmad-help`, agents, workflows) for product work.
- Superpowers and other local skills are optional helpers; they do not replace BMAD for planned product delivery.
- Do not start a full Analyst → PRD cycle unless the human explicitly asks.
