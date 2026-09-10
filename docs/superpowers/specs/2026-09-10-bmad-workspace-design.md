# BMAD as Principal Process — Workspace Design

**Date:** 2026-09-10  
**Status:** Approved in conversation; awaiting implementation  
**Product:** Munder Difflin (Electron multi-agent harness)  
**Method:** BMad Method (BMM + TEA + CIS)

## Context

We adopt BMad Method as the **principal development process** for this fork. Munder Difflin remains the **product**. Cursor is the IDE runtime: BMAD slash commands load agent/workflow prompts that the Cursor agent follows.

This repo already contains a full product tree at the root. BMAD must not scatter tooling across the product tree, and we want a clean separation between methodology and application code without using git submodules.

## Goals

1. Install BMAD (BMM + TEA + CIS) with Cursor integration at the **workspace root**.
2. Relocate the Munder Difflin application into `app/` (monorepo-style layout, single git remote).
3. Encode process rules in root `AGENTS.md` (language policy, BMAD as principal process, `app/` as product).
4. Stop after scaffolding is verified — **no first Analyst/PRD cycle** until explicitly requested.

## Non-goals

- Git submodule / separate methodology repo
- Customizing BMAD agents to the Office theme
- Renaming the GitHub remote/repo
- CI redesign for the monorepo
- Running the first product planning cycle

## Layout

```text
munder-difflin/                    # same remote (sodawave/munder-difflin)
├── _bmad/                         # BMM + TEA + CIS (committed)
├── _bmad-output/                  # planning + implementation artifacts
├── .cursor/commands/bmad/         # Cursor slash commands
├── AGENTS.md                      # process governance for agents
├── README.md                      # workspace entrypoint → points to app/
├── docs/superpowers/              # process specs/plans for this workspace
│   ├── specs/
│   └── plans/
└── app/                           # Munder Difflin product (former root contents)
    ├── package.json
    ├── src/
    ├── tools/
    ├── docs/                      # product docs/site
    └── ...
```

### Move rules

- Everything that constitutes the **application** moves under `app/` (source, Electron config, product `docs/`, `tools/`, tests, landing, scripts, etc.).
- **Stay at root after the move:** `.git`, root process files (`AGENTS.md`, workspace `README.md`), `docs/superpowers/`, then BMAD/`Cursor` artifacts created by the installer.
- Do **not** install BMAD inside `app/`. Official BMAD monorepo guidance: method at workspace root, packages underneath.

## Process governance

| Topic | Rule |
|---|---|
| Principal process | BMAD via Cursor (`/bmad-help`, agents, workflows) |
| Modules | BMM + TEA + CIS |
| Spoken / chat language | Spanish |
| Formal artifacts | English (PRD, epics, stories, architecture, specs) |
| Product code & product docs | Only under `app/` |
| Superpowers / local skills | Optional helpers; do not replace BMAD for product work |
| First cycle | Deferred until explicitly requested |

## Branch model (canonical)

Default flow: **work branch → develop → test with evidence → human OK → merge to `dev`**. Do not develop directly on `dev` or `main` unless the human explicitly agrees (e.g. trivial hotfix).

| Branch | Role |
|---|---|
| `feat/*`, `fix/*`, `chore/*`, `docs/*`, `spec/*`, … | Day-to-day work — one branch per unit of change |
| `dev` | Integration only — receives merges after develop → test → OK |
| `main` | Production / deploy only |

Rules:

- Prefer branch names aligned with conventional commits (`feat/…` + `feat: …`, `fix/…` + `fix: …`, etc.).
- When work is driven by a formal spec, prefer `spec/YYYY-MM-DD-<slug>` (or a `feat/…` linked to that spec) — one option of the same default pattern, not the only branch type.
- Merge `dev` → `main` **only when the human explicitly requests it**.
- Agents must not merge to `main`, cut releases, or treat `main`/`dev` as a working branch for new features without that explicit request.
- Push to remotes only when the human asks.

Bootstrap note: the initial BMAD workspace scaffolding landed directly on `dev` before this per-branch default was locked; new work follows the table above.

## Quality bar (canonical)

- **Ordered modeling:** spec → plan → implementation → verification with evidence.
- **Tests:** every behavior-changing task includes tests; pure scaffolding uses an executable verification checklist (real commands, real exit codes).
- **Double confirmation:** large or irreversible steps (mass moves, BMAD install, merge to `dev` or `main`) require explicit human OK before execution.
- **Zero hallucination:** never assert that a path exists, a command passed, or a tool is installed unless verified in the current session (command output, file read, or equivalent evidence).
- **Done means evidence:** report paths, exit codes, and test/command output — not confidence.

## Installation parameters

```text
npx bmad-method install
  modules:                 bmm, tea, cis
  tools:                   cursor
  communication-language:  Spanish
  document-output-language: English
  output-folder:           _bmad-output
  directory:               workspace root (not app/)
```

## Verification

1. `_bmad/` exists with expected modules; `manifest.yaml` present.
2. `.cursor/commands/bmad/` exists; `/bmad-help` available after Cursor reload.
3. Product still runnable from `app/` (e.g. `cd app && npm` scripts resolve; no BMAD files mixed into product `tools/`).
4. Root `AGENTS.md` states the governance table above, plus branch model (work branches → `dev` → `main`) and quality bar.
5. Root `README.md` explains workspace vs `app/`.
6. Integration branch is `dev`; `main` untouched by day-to-day work except when the human later requests a merge from `dev`.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| BMAD installer path bugs (e.g. v6.2.0 ENOENT) | Use latest stable; verify `_bmad/` after install; retry with `@latest` if needed |
| Weak models skip PRD/epics | Prefer capable models for BMAD workflows; fresh chats per workflow |
| Accidental move of `docs/superpowers/` into `app/docs/` | Explicit keep-list during the file move |
| Electron/CI path assumptions after move | Smoke-check `app/` scripts; defer deep CI fixes unless broken |

## Decision log

- **Principal process:** BMAD (not product agents / Office hires).
- **Language:** mixed (ES chat / EN artifacts).
- **Modules:** BMM + TEA + CIS from day one.
- **First cycle:** install only (option C).
- **Structure:** option A — single repo, product in `app/` (rejected submodule parent repo).
- **Governance:** install + thin `AGENTS.md` layer (not themed custom agents).
- **Branches:** default work branch (`feat`/`fix`/`docs`/`spec`/…) → test → OK → `dev`; `main` is prod; merge to `main` only on human request (updated 2026-09-10).
- **Quality:** ordered modeling, tests/verification, double confirmation, evidence-backed claims (confirmed 2026-09-10).

## Approval

Design approved in chat on 2026-09-10. Branch/quality canon confirmed 2026-09-10; per-work-branch default clarified the same day. New work proceeds on topic branches merging into `dev` after explicit OK.
