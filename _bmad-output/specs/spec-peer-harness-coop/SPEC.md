---
id: SPEC-peer-harness-coop
title: Peer Harness Coop (cycle-1)
status: verified
created: 2026-09-12
updated: 2026-09-12
companions:
  - conventions.md
  - architecture-diagrams.md
  - epics.md
  - ../../planning-artifacts/2026-09-12-peer-harness-coop/ARCHITECTURE-SPINE.md
  - ../../planning-artifacts/2026-09-12-peer-harness-coop/ANALYSIS.md
  - ../../planning-artifacts/2026-09-11-mqtt-relay/ARCHITECTURE-SPINE.md
sources:
  - ../../planning-artifacts/2026-09-12-peer-harness-coop/.memlog.md
---

> **Canonical contract.** This SPEC and `companions:` define what to build for cycle-1. Spine AD-9..AD-19 are read-only constraints.

# Peer Harness Coop (cycle-1)

## Why

Two or three harnesses (e.g. a **dev** office and a **VPS/prod** office) need to cooperate without hosting the Electron app as a multi-user agent runtime. The sealed MQTT bridge already moves opaque envelopes. Cycle-1 adds a **Sync screen** (add-remote-harness workflow), **knowhow cards** for agents the operator marks to sync, **tinted remote presence**, and **god/operator mail** that lands in the remote agent’s **local** inbox — while keeping every agent **machine-anchored**.

## Primary workflow — Sync screen (add remote harness)

This is the product path for pairing, not a hidden API step.

```text
┌─ Sync / Remote harness ─────────────────────────────────────┐
│  This harness (boss) MQTT address     [ Copy card ]         │
│  mqtt://…  deviceId …  pubs …  envLabel                     │
│                                                             │
│  Peer harness address                 [ Paste / Import ]    │
│  ……………………………………………………………………………                      │
│                                                             │
│  Share my agents (publish knowhow)                          │
│  ☑ god   ☑ deploy-bot   ☐ research-…                        │
│                                                             │
│  Follow peer agents (into my UI)      (after peer roster)   │
│  ☑ god@prod-vps   ☑ ops-…   ☐ …     ← tint by device        │
│                                                             │
│  [ Connected ]  Send mail to followed remote…               │
└─────────────────────────────────────────────────────────────┘
```

1. Operator opens **Sync** (Settings or dedicated panel).
2. Copies **boss MQTT address card** to give the other harness (or pastes theirs).
3. Marks which **local** agents to **publish** (sync out).
4. After peer connects / roster arrives, marks which **remote** agents to **follow** (sync into representation with tint).
5. Mail / orders go only to destinations that exist as followed remotes (or explicit send to a published peer agent id once paired).

## Capabilities

- **CAP-1 Sync screen + pair**
  - **intent:** Operator adds a remote harness via the Sync screen: show/copy this boss address card; paste/import peer card; persist peer + sync selection under `network/peers.json` (or equivalent).
  - **success:** After mutual import on A and B (shared LAN broker), both have the other’s `deviceId` + pubs; Sync screen shows connection state.

- **CAP-2 Knowhow / roster sync (selected agents only)**
  - **intent:** Publish capability **cards** only for local agents **checked to share**; consume peer roster and adopt only agents **checked to follow** into the remote-agent view model.
  - **success:** Unchecked local agents never appear on the peer’s roster; unchecked remote agents do not appear in local UI; followed cards show `agentId`, `name`, `role`, `caps`, `isGod`, `peerLabel` / tint — **without** copying disk mailboxes.

- **CAP-3 Remote presence tint**
  - **intent:** Followed remote agents appear in Sync / list / Command Center with a **per-device color differential**.
  - **success:** Operator can tell local vs remote (and which peer) without Pixi remote avatars.

- **CAP-4 God/operator → remote agent mail**
  - **intent:** From UI, god or human operator sends a hive message to `(peerDeviceId, agentId)` for a paired peer; bridge seals → `…/agents/{agentId}/inbox` → `hive.send` → disk → nudge.
  - **success:** Inbox file under recipient `hive/agents/<agentId>/inbox/`; no dual-file on duplicate id; same-machine mail never uses MQTT (AD-11).

- **CAP-5 God ↔ god**
  - **intent:** CAP-4 with peer god selected in follow/share lists (default on unless unchecked).
  - **success:** God on A can message god on B and receive a sealed reply into A’s god inbox.

- **CAP-6 Gate unchanged**
  - **intent:** Without `canNetwork`, Sync screen does not open MQTT coop I/O (may still show locked/empty state).
  - **success:** Community/pro without network never connects roster/mail topics for coop.

## Constraints

- Obey AD-9..AD-13 and AD-14..AD-19.
- Product code under `app/`; prefer additive work in `app/src/main/network/` + thin renderer Sync UI.
- `lanNs` cycle-1 default: `local`. No absolute `harnessHome` on the wire.
- Seal per device; envelope `to` authoritative for materialization.
- Outbound remote send: god/operator only (AD-18).
- Diffs to hive router / nudge cores empty or trivial.

## Non-goals (cycle-1)

- Teams seats, console, hosted Teams UX, billing.
- Headless `munder serve` / agent-cli (cycle-2).
- Hosted production broker (LAN broker OK).
- Pixi floor remote avatars.
- Full hive / memory / identity filesystem sync.
- Auto-publish all agents without Sync checkboxes.
- Auto-relay of arbitrary local worker outbox to remotes.
- Hosted multi-tenant control of an unanchored agent.

## Success signal

Two Electron harnesses on a LAN broker: each opens Sync → exchange boss MQTT cards → mark agents to share/follow → tinted remote list → operator on A sends mail to a followed agent on B → B’s agent inbox gains a normal hive JSON and existing nudge can wake it.

## Assumptions

- Existing Teams/`canNetwork` unlock is enough to exercise the feature in dev.
- Card `caps` may start as optional tags from role/name.
- Default selection: god checked for share/follow; other agents unchecked until operator marks them (safer than sharing everyone).
- Legacy device inbox topic may remain until migrated.

## Open Questions

- Exact tint token mapping — hash palette of `deviceId` unless DESIGN.md dictates.
- Sync screen host: Settings tab vs Command Center panel — either OK if CAP-1 workflow holds.
- Whether “follow” is required before CAP-4 send, or send allows any id on a paired device — prefer **followed-only** in cycle-1 for clarity.
