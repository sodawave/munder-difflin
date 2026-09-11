---
title: MQTT bridge — as-built hive analysis + merge constraints
status: final
created: 2026-09-11
related_spine: ARCHITECTURE-SPINE.md
---

# Analysis — Local hive vs additive MQTT bridge

## As-built same-machine mail (preserve)

1. Agent writes FIPA-lite JSON to `agents/<id>/outbox/`.
2. Main `HiveManager` polls (~1.5s), `routeMessage` → atomic `deliver` to recipient `inbox/<id>.json`, archives outbox to `.sent/`, appends `log.jsonl`, main-only git commit where applicable.
3. Wake: `inboxNudgeText` typed into the PTY when idle (renderer `useHive` + main `WorkerWakeWatchdog`) — **not** the message body.
4. Agent reads inbox with tools, acts, moves files to `inbox/.done/`.
5. External inject already: webhook → `hive.send` (inbox). Slack → PTY queue (not inbox). Org trigger → UI/persistence only (no transport).

Key files: `app/src/main/hive.ts`, `app/src/shared/hiveNudge.ts`, `app/src/renderer/src/hooks/useHive.ts`, `app/src/main/workerWake.ts`, `app/HIVE.md`.

## Why MQTT (for remote only)

- Recipient may be another machine (Teams / future mobile).
- Pub/sub + QoS 1 fits opaque sealed envelopes; broker need not open boxes (product Private Network promise).
- **Non-goal of MQTT:** making local agent turns faster. Dual-channel nudge vs body latency is a **separate** wake design debate (see Deferred on the spine).

## Merge constraints (upstream)

- Upstream open tree keeps file mailboxes; 0.5.x sealed network is binaries-only.
- This fork should **add** a bridge, not replace mail, so merging `chaitanyagiri/munder-difflin` stays low-conflict on `hive.ts` / nudge paths.
- Teams **license** (`canNetwork`) already exists; this cycle is architecture for the network plane, not a second entitlement rewrite.

## Process

Debate → this ANALYSIS + `.memlog.md` + `ARCHITECTURE-SPINE.md` → **bmad-spec / epics** → implement. Do not skip to a large hive refactor because an agent “sees” MQTT or latency.
