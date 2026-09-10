# BMAD Workspace Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relocate the Munder Difflin product into `app/` and install BMAD (BMM + TEA + CIS) with Cursor at the workspace root, with governance in `AGENTS.md`, without running a first planning cycle.

**Architecture:** Single git repo. Methodology (`_bmad/`, `_bmad-output/`, `.cursor/commands/bmad/`, root `AGENTS.md`, `docs/superpowers/`) lives at the workspace root. The Electron app and its product docs live entirely under `app/`. `.github/` stays at the repo root (GitHub requirement) but workflow steps are updated to run inside `app/` where they touch the product.

**Tech Stack:** git file moves, Node 20+, `npx bmad-method`, Cursor slash commands, existing Electron/npm product under `app/`.

**Spec:** `docs/superpowers/specs/2026-09-10-bmad-workspace-design.md`

## Global Constraints

- Communication language for BMAD agents: **Spanish**
- Document output language for BMAD artifacts: **English**
- Modules: **bmm, tea, cis**
- IDE tool: **cursor**
- Output folder: **`_bmad-output`**
- Install BMAD at **workspace root**, never inside `app/`
- Do **not** start Analyst/PRD/first product cycle
- Preserve `docs/superpowers/` at workspace root (do not bury it under `app/docs/`)
- Keep `.git`, `.github/`, and root process files at root; product code only under `app/`
- No git submodules
- **Branch:** default = work branch (`feat`/`fix`/`chore`/`docs`/`spec`/…) → test → human OK → merge to **`dev`**; never merge to **`main`** unless the human explicitly requests it (`main` = prod/deploy only)
- No force-push; commit on the work branch; push only if the user asks
- **Quality:** ordered modeling (spec → plan → implement → verify); tests or executable verification checklist; double confirmation before mass moves / BMAD install / merge to `dev` or `main`; zero hallucination — verify claims with evidence before asserting them

---

## File structure (target)

```text
./
├── .git/
├── .github/                 # stays; workflows updated for app/
├── .gitignore               # updated paths for app/
├── .claude/                 # stays (workspace skills)
├── .cursor/commands/bmad/   # created by BMAD installer
├── _bmad/                   # created by BMAD installer
├── _bmad-output/            # created by BMAD installer
├── AGENTS.md                # create
├── README.md                # replace with workspace README
├── docs/superpowers/        # keep at root (specs + plans)
└── app/                     # former product root
    ├── package.json
    ├── src/
    ├── docs/                # product docs/site (former ./docs minus superpowers)
    ├── tools/
    ├── .gitignore           # optional product-local ignores if needed
    └── ...
```

---

### Task 1: Move product tree into `app/` (preserve `docs/superpowers/`)

**Files:**
- Create: `app/` (directory)
- Move: all product root entries listed below → `app/`
- Keep at root: `.git`, `.github`, `.gitignore`, `.claude`, `docs/superpowers/`

**Interfaces:**
- Consumes: current repo root layout
- Produces: `app/package.json` as product entrypoint; `docs/superpowers/` still at `./docs/superpowers/`

**Root entries to MOVE into `app/`:**

```text
CHANGELOG.md
CODE_OF_CONDUCT.md
CONTRIBUTING.md
CONTRIBUTORS.md
DESIGN.md
HIVE.md
LICENSE
LICENSE-ASSETS
MEMORY_GRAPH_SPEC.md
README.md          # becomes app/README.md (product readme)
RELEASE-CHECKLIST.md
RELEASE.md
SECURITY.md
SPEC.md
TELEMETRY.md
blog/
build/
docs/              # SPECIAL: see steps — exclude superpowers
electron-builder.yml
electron.vite.config.ts
hive/
landing-remotion/
package-lock.json
package.json
prototypes/
resources/
scripts/
seo/
src/
test/
tools/
tsconfig.json
tsconfig.node.json
tsconfig.web.json
```

**Keep at root (do not move):**

```text
.git/
.github/
.gitignore
.claude/
docs/superpowers/
```

- [ ] **Step 1: Create `app/` and move non-docs product entries**

```bash
cd /Users/rafa/Projects/HARNESS/munder-difflin
mkdir -p app
# Move everything except docs, .git, .github, .gitignore, .claude
git mv CHANGELOG.md CODE_OF_CONDUCT.md CONTRIBUTING.md CONTRIBUTORS.md \
  DESIGN.md HIVE.md LICENSE LICENSE-ASSETS MEMORY_GRAPH_SPEC.md \
  README.md RELEASE-CHECKLIST.md RELEASE.md SECURITY.md SPEC.md TELEMETRY.md \
  blog build electron-builder.yml electron.vite.config.ts hive \
  landing-remotion package-lock.json package.json prototypes resources \
  scripts seo src test tools \
  tsconfig.json tsconfig.node.json tsconfig.web.json \
  app/
```

If `git mv` fails on any path (untracked / ignored), use `mv` then `git add -A` for that path.

- [ ] **Step 2: Split `docs/` — product docs → `app/docs/`, keep superpowers at root**

```bash
mkdir -p app/docs
# Move every docs child except superpowers
for item in docs/* docs/.[!.]*; do
  base=$(basename "$item")
  [ "$base" = "superpowers" ] && continue
  [ -e "$item" ] || continue
  git mv "$item" "app/docs/$base" 2>/dev/null || mv "$item" "app/docs/$base"
done
# Ensure root docs only contains superpowers
ls -la docs
# Expected: only superpowers/
```

- [ ] **Step 3: Verify layout before continuing**

```bash
test -f app/package.json && test -d app/src && test -d docs/superpowers/specs
test ! -f ./package.json
ls docs
```

Expected: `app/package.json` and `app/src` exist; root has no `package.json`; `docs/` lists only `superpowers`.

- [ ] **Step 4: Commit the move**

```bash
git add -A
git status
git commit -m "$(cat <<'EOF'
chore: move Munder Difflin product into app/

Keep methodology docs under docs/superpowers at the workspace root
so BMAD can live beside the product without mixing trees.
EOF
)"
```

---

### Task 2: Update root `.gitignore` and GitHub Actions for `app/`

**Files:**
- Modify: `.gitignore`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `.github/workflows/blog.yml`
- Modify: `.github/workflows/wall-sync.yml` (and any other workflow that assumes root `package.json` or `docs/`)
- Test: dry-read workflows; run product typecheck from `app/`

**Interfaces:**
- Consumes: `app/package.json` scripts (`typecheck`, `build`, `check:links`)
- Produces: CI that uses `defaults.run.working-directory: app` or per-step `working-directory: app`

- [ ] **Step 1: Update `.gitignore` paths that pointed at root `docs/`**

Change product-doc ignores to live under `app/`:

```gitignore
# heavy hero source — only the compressed hero.mp4/.webm are deployed
app/docs/media/*.mov

# git worktree mounts for hive worker agents — never commit (each is a separate branch checkout)
.worktrees/
app/.worktrees/

# raw demo screen recordings — only the compressed app/docs/media/demo/*.mp4 are deployed
app/docs/media/MunderDifflin*.mp4

# blog theme previews (local only)
app/docs/blog-preview-*/

# stray built bundles at the repo root (a 12 MB one skewed GitHub's language stats)
/index-*.js
app/index-*.js
```

Keep existing `node_modules/`, `out/`, `dist/`, `.env*` patterns (they still apply under `app/` via normal gitignore matching if we also add explicit `app/node_modules/` for clarity):

```gitignore
node_modules/
app/node_modules/
out/
app/out/
dist/
app/dist/
```

- [ ] **Step 2: Patch CI to run npm inside `app/`**

For `.github/workflows/ci.yml`, set:

```yaml
defaults:
  run:
    working-directory: app
```

Ensure `actions/checkout` stays at job level (no working-directory). If `setup-node` cache uses `cache-dependency-path`, set:

```yaml
cache-dependency-path: app/package-lock.json
```

Apply the same pattern to `release.yml` (build/dist from `app/`). For `blog.yml`, update paths:

- `working-directory: app/blog` (was `blog`)
- git add paths: `app/docs/blog`, `app/docs/sitemap.xml`
- trigger paths: `app/blog/**` as needed

For `wall-sync.yml`, update any `docs/wall-data.json` references to `app/docs/wall-data.json`.

- [ ] **Step 3: Smoke-check product scripts from `app/`**

```bash
cd /Users/rafa/Projects/HARNESS/munder-difflin/app
# Install only if node_modules missing after move
test -d node_modules || npm ci
npm run typecheck
```

Expected: typecheck exits 0 (or same failures as before the move — not new path errors).

If `npm ci` is too heavy for this environment, at minimum:

```bash
node -e "require('./package.json'); console.log('ok', require('./package.json').name)"
test -f electron.vite.config.ts && test -d src
```

- [ ] **Step 4: Commit path fixes**

```bash
git add .gitignore .github/workflows
git commit -m "$(cat <<'EOF'
chore: point ignore rules and CI at app/

After relocating the product, npm and docs paths resolve under app/.
EOF
)"
```

---

### Task 3: Add workspace `AGENTS.md` and root `README.md`

**Files:**
- Create: `AGENTS.md`
- Create: `README.md` (workspace entrypoint; product readme remains `app/README.md`)

**Interfaces:**
- Consumes: governance table from the spec
- Produces: agents/humans understand root = method, `app/` = product

- [ ] **Step 1: Write `AGENTS.md`**

Create `/Users/rafa/Projects/HARNESS/munder-difflin/AGENTS.md` with exactly this substance (Spanish headers OK; keep artifact language rule explicit):

```markdown
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
```

- [ ] **Step 2: Write root workspace `README.md`**

```markdown
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
```

- [ ] **Step 3: Commit governance docs**

```bash
git add AGENTS.md README.md
git commit -m "$(cat <<'EOF'
docs: add workspace AGENTS.md and root README

Declare BMAD as the principal process and point humans/agents at app/.
EOF
)"
```

---

### Task 4: Install BMAD (BMM + TEA + CIS + Cursor) at workspace root

**Files:**
- Create (via installer): `_bmad/`, `_bmad-output/`, `.cursor/commands/bmad/`
- Possibly create/update: installer config files under `_bmad/**/config.yaml`

**Interfaces:**
- Consumes: empty root (no prior `_bmad/`)
- Produces: working `/bmad-help` command files for Cursor

- [ ] **Step 1: Check Node version**

```bash
node --version
```

Expected: `v20` or higher.

- [ ] **Step 2: Run non-interactive install from workspace root**

```bash
cd /Users/rafa/Projects/HARNESS/munder-difflin
npx bmad-method@latest install \
  --directory /Users/rafa/Projects/HARNESS/munder-difflin \
  --modules bmm,tea,cis \
  --tools cursor \
  --user-name "Sodawave" \
  --communication-language Spanish \
  --document-output-language English \
  --output-folder _bmad-output \
  --yes
```

If the CLI rejects flags or prompts interactively, re-run without `--yes` and answer to match the Global Constraints. If install fails with `ENOENT` on `src/core`, clear npm cache and retry `@latest`:

```bash
npm cache clean --force
npx bmad-method@latest install ...
```

- [ ] **Step 3: Verify install artifacts**

```bash
test -f _bmad/manifest.yaml
ls _bmad
ls .cursor/commands/bmad | head
npx bmad-method status
```

Expected: `_bmad` contains `bmm` (and tea/cis as installed names), Cursor commands directory non-empty, status reports modules + cursor.

- [ ] **Step 4: Commit BMAD scaffolding**

```bash
git add _bmad _bmad-output .cursor
# If installer touched other root files (e.g. config), add them too after review — never add secrets
git status
git commit -m "$(cat <<'EOF'
chore: install BMAD (BMM, TEA, CIS) with Cursor

Scaffold the principal development method at the workspace root.
EOF
)"
```

---

### Task 5: End-to-end verification (no planning cycle)

**Files:**
- Modify: none unless verification finds a broken path (fix only what failed)
- Test: layout + BMAD + product entry checks

**Interfaces:**
- Consumes: Tasks 1–4 outputs
- Produces: confirmation checklist matching the spec Verification section

- [ ] **Step 1: Run verification checklist**

```bash
cd /Users/rafa/Projects/HARNESS/munder-difflin

test -f AGENTS.md
test -f README.md
test -f docs/superpowers/specs/2026-09-10-bmad-workspace-design.md
test -f docs/superpowers/plans/2026-09-10-bmad-workspace-scaffolding.md
test -d app/src && test -f app/package.json
test -f _bmad/manifest.yaml
test -d .cursor/commands/bmad
test ! -f package.json   # product package.json must not be at root
test ! -d app/_bmad      # BMAD must not be inside app
```

- [ ] **Step 2: Confirm Cursor commands exist for help**

```bash
find .cursor/commands -iname '*help*' -o -iname '*bmad*' | head -40
```

Expected: at least one help-related command under `.cursor/commands`.

- [ ] **Step 3: Stop**

Do **not** invoke Analyst, create-prd, or any first product cycle. Report verification results to the human.

- [ ] **Step 4: Final commit only if verification required fixes**

If no fixes: skip. If fixes were made:

```bash
git add -A
git status
git commit -m "$(cat <<'EOF'
fix: finish BMAD workspace verification cleanups

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| Product under `app/` | Task 1 |
| `docs/superpowers/` at root | Task 1 Step 2 |
| BMAD at root with BMM+TEA+CIS+Cursor | Task 4 |
| ES chat / EN artifacts | Task 3 + Task 4 install flags |
| `AGENTS.md` governance | Task 3 |
| Root README → `app/` | Task 3 |
| Verify install; no first cycle | Task 5 |
| CI/gitignore still coherent | Task 2 |

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-10-bmad-workspace-scaffolding.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with executing-plans checkpoints  

Which approach?
