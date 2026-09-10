---
title: Munder Difflin — Architecture Spine (as-built)
status: draft
created: 2026-09-10
updated: 2026-09-10
source_sha: b1439959
altitude: system
---

# Architecture Spine — Munder Difflin (as-built)

Brownfield ratification. Seed (stack/tree) is owned by the code; this spine fixes **invariants** that independently built units must not violate.

## Paradigm

**Dual-plane local desktop harness:** a **terminal plane** (authentic PTY bytes) and an **event/hive plane** (structured agent lifecycle + on-disk coordination) feed **one Electron renderer** (floor + Command Center + terminals).

```text
Renderer (React + Pixi + xterm)
        ^                 ^
   avatar/IPC          pty/fs/git IPC
        |                 |
  Event/Hive plane    Terminal plane
  hooks + hive        PtyManager (node-pty)
        \                 /
         agent CLI processes
```

## Architectural decisions

### AD-1 Dual planes [ADOPTED]

- **Binds:** Terminal I/O and hive/events remain separate channels into the renderer.
- **Prevents:** Parsing PTY text as the only source of tool/lifecycle state; or driving the floor solely from hooks without a real terminal.
- **Rule:** New features must declare which plane they extend; do not collapse planes into one bus.

### AD-2 Workspace product boundary [ADOPTED]

- **Binds:** Runnable product and product docs live under `app/`; BMAD method lives at repo root.
- **Prevents:** Installing method tooling inside `app/` or scattering product sources at root again.
- **Rule:** Implement product changes only under `app/`; write BMAD artifacts under `_bmad-output/`.

### AD-3 Hive write ownership [ADOPTED]

- **Binds:** Agents write plain files; Electron main is the sole git committer for hive coordination (see `app/HIVE.md`).
- **Prevents:** Concurrent `.git` corruption from many agent git processes.
- **Rule:** Do not teach agents to `git commit`; extend the main-process commit path instead.

### AD-4 Preload-only renderer Node access [ADOPTED]

- **Binds:** Renderer uses `window.cth` from `app/src/preload/`; no direct Node APIs in renderer code.
- **Prevents:** Broken security model and untyped IPC sprawl.
- **Rule:** New main capabilities ship as preload-exposed APIs first.

### AD-5 Design-token source [ADOPTED]

- **Binds:** Visual system derives from `app/DESIGN.md` + `app/src/renderer/src/design/`.
- **Prevents:** One-off colors/components that drift the Office UI.
- **Rule:** New UI starts from existing tokens/components.

## Seed (non-binding inventory)

- Electron main: `app/src/main/` (`pty.ts`, `hive.ts`, `hooks.ts`, `index.ts`, …)
- Renderer: `app/src/renderer/src/`
- Tests: `app/test/*.test.cjs` (`npm run test:focused`)
- Contributor map: `app/docs/ARCHITECTURE.md`
- Historical MVP notes: `app/SPEC.md` (tmux-era — do not re-adopt)

## Deferred

- Pages deploy strategy and absolute URL cutover (stream C).
- Durable Darwin native rebuild shim (stream A).
- Feature-level spines when the first epic is chosen.

## References

- Memlog: `.memlog.md` in this folder.
- PRD: `../prd/prd.md`.
