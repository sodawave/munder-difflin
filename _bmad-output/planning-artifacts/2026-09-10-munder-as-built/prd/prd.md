---
title: Munder Difflin — As-Built Product Requirements
status: draft
created: 2026-09-10
updated: 2026-09-10
source_sha: b1439959
---

# Munder Difflin — As-Built PRD

## 1. Purpose

Document the **product as it exists today** in this fork’s workspace so future BMAD cycles (epics, stories, builds) start from verified reality, not from outdated MVP notes or greenfield invention.

## 2. Problem

Developers already pay for coding-agent CLIs and run many sessions in terminals. Coordinating those sessions—seeing them, routing work, retaining memory, and staying in control—is painful without a local control room.

## 3. Product

**Munder Difflin** is a **local-first Electron desktop app** that:

- Spawns and attaches to real coding-agent CLI processes (Claude Code, Codex, Antigravity/Gemini, and other supported CLIs).
- Shows each agent as an avatar on a shared 2D office floor (Pixi.js).
- Streams authentic terminal I/O via **node-pty** into xterm.js views.
- Coordinates agents through an on-disk **hive** (mailboxes, memory, router) with a privileged orchestrator persona (“Michael” / GOD).
- Keeps the human in control via the Command Center, approvals/HITL paths, and cost/breaker controls.

It is **not** a replacement for the agent CLIs, **not** a hosted multi-tenant SaaS control plane, and **not** a full IDE.

## 4. Users & jobs

| Job | User |
|-----|------|
| Run many agent sessions without losing the plot | Solo power users / small teams |
| Watch agents work and intervene in a terminal | Same |
| Route tasks between agents with memory | Same |
| Ship / contribute to the open-source harness | Contributors |

## 5. Capabilities (as-built — verified against repo)

Evidence bases: [`app/README.md`](../../../app/README.md), [`app/docs/ARCHITECTURE.md`](../../../app/docs/ARCHITECTURE.md), [`app/src/main/`](../../../app/src/main/), [`app/HIVE.md`](../../../app/HIVE.md).

1. **Multi-CLI harness** — wrap supported terminal agents; BYO keys / local LLMs where configured.
2. **Terminal plane** — `PtyManager` in `app/src/main/pty.ts` owns PTYs; renderer consumes streams over IPC.
3. **Event / hive plane** — hooks + hive router/mail/memory (`hive.ts`, `hooks.ts`, `memory.ts`).
4. **Office floor + Command Center** — Pixi scene + React panels under `app/src/renderer/src/`.
5. **Typed preload bridge** — `window.cth` only (`app/src/preload/`).
6. **Observability & control** — usage/cost, breaker, steer/stop patterns in main process modules.
7. **Distribution** — signed releases; also build-from-source via `app/` npm scripts.
8. **Site** — static marketing/docs under `app/docs/` (domain `munderdiffl.in`).

## 6. Non-goals (current)

- Replacing upstream CLIs.
- Remote multi-user hosted floor as primary product.
- Treating Office/hire agents as the *development method* for this repo (BMAD is the method; Office agents are product runtime).

## 7. Constraints

- Workspace layout: product under `app/`; BMAD at repo root.
- Integration branch `dev`; `main` is production.
- Formal planning artifacts in English under `_bmad-output/`.
- Prefer code + ARCHITECTURE.md over [`app/SPEC.md`](../../../app/SPEC.md) when they disagree (SPEC still describes early tmux terminal plane).

## 8. Success for this documentation cycle

- PRD + architecture spine committed and reviewed.
- `AGENTS.md` carries a managed product context block.
- Next feature work can open epics/stories without rediscovering planes and paths.

## 9. Open follow-ups (not in this PRD)

- Darwin `npm ci` / node-pty libc++ shim (stream A).
- GitHub Pages Actions deploy + stale `main/docs/` URLs (stream C).
- First net-new product feature epic (after this baseline is accepted).

## 10. References

- Memlog: `.memlog.md` in this folder.
- Architecture spine: `../architecture/ARCHITECTURE-SPINE.md`.
