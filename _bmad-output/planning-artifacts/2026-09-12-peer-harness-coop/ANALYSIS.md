---
title: Peer Harness Coop — Analysis
status: final
created: 2026-09-12
companion: ARCHITECTURE-SPINE.md
---

# Analysis — Peer harness coop

## Problem

The sealed MQTT bridge (AD-9..AD-13) proves cross-machine **transport**. Product intent is not “host the office in the cloud,” but **coop between harnesses**: e.g. a predominately-dev laptop office and a VPS/prod office coordinating deploy and error reports. Operators need to **know who exists on the other harness** and **send mail that lands in the remote agent’s local inbox**.

## As-built constraints

- Bridge lives under `app/src/main/network/`; inbound already materializes via `hive.send`.
- Topics today are device-level `md/{org}/dev/{deviceId}/inbox` (`topics.cjs`); coop needs per-agent delivery topics and a roster channel.
- `canNetwork` requires Teams plan + `networkEnabled` — reuse as unlock; do not build Teams seats/console in this cycle.
- Hive layout (`app/HIVE.md`): `agents/<id>/{inbox,outbox,…}` is the real mailbox vocabulary.

## Debate outcomes (summary)

1. Hosting the **application** as multi-user agent control is the wrong model; optional host is a **dumb broker** only.
2. Agents are **machine-anchored**; LLM cloud ≠ shareable paths.
3. Knowhow sync = **capability cards**, not disk replication; operator **marks** which agents share/follow on the **Sync screen**.
4. **Sync screen** is the add-remote-harness workflow: boss MQTT address ↔ peer paste ↔ agent checklists.
5. Headless serve is the right shape for VPS, but **cycle-2**.
6. Cycle-1 UI after sync = list/CC + tint; outbound = god/operator only.

## Merge / risk notes

- Keep changes additive in `network/` + thin renderer for peers/roster/tint.
- Do not rewrite hive router for remote `to=` resolution in cycle-1 (explicit `sendRemote` is enough).
- Topic migration: support agent inbox topics without breaking existing device-inbox tests until SPEC says otherwise.
