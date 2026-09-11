---
title: Peer harness coop — Epics & Stories
status: verified
created: 2026-09-12
spec: SPEC.md
---

# Epics & Stories

Branch (when implementing): `feat/peer-harness-coop`.

## Epic C1 — Topics + peers store

- **C1-S1:** Topic helpers: `agentInboxTopic(lanNs, deviceId, agentId)`, `rosterTopic(lanNs, deviceId)`; keep legacy `peerInboxTopic` for compatibility tests
- **C1-S2:** Load/save `network/peers.json`; import/export address card validation (`v`, mqttUrl, deviceId, pubs)
- **C1-S3:** Focused unit tests for sanitize + topic shape (no PII paths)

## Epic C2 — Roster / knowhow sync

- **C2-S1:** Build cards from local registry for `publishAgentIds` only (id, name, role, caps stub, isGod) + envLabel
- **C2-S2:** Publish roster when `canNetwork` and on selection/registry churn; subscribe to paired peers’ roster topics
- **C2-S3:** Apply `followAgentIds` filter; expose followed remotes view model to renderer via thin IPC

## Epic C3 — Per-agent inbound delivery

- **C3-S1:** Subscribe `…/agents/+/inbox` (or live agent set); unseal → dedupe → `hive.send` with envelope `to`
- **C3-S2:** `sendRemote` publishes to peer agent inbox topic (seal to peer device pub); cycle-1 UI restricts targets to followed agents
- **C3-S3:** Tests: inbound materializes under correct `agents/<id>/inbox/`; mismatch/drop policy documented

## Epic C4 — Sync screen UI

- **C4-S1:** Sync screen: show/copy boss MQTT address card; paste/import peer; connection status
- **C4-S2:** Checklists — share local agents / follow remote agents; persist selection in peers store
- **C4-S3:** Followed remotes list with per-device tint + send-mail affordance (operator/god only)

## Epic C5 — Verify + hygiene

- **C5-S1:** `npm run typecheck` + network-spec extensions for roster + agent topic
- **C5-S2:** Two-node or in-process Aedes: Sync pair → share/follow selection → roster filtered → remote inbox file
- **C5-S3:** PR hygiene: no hive router rewrite; AD-11 same-machine path untouched

## Out of epic scope

Headless serve, hosted broker, Teams product, Pixi remote avatars, memory/disk sync, worker auto-relay.
