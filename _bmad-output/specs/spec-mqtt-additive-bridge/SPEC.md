---
id: SPEC-mqtt-additive-bridge
title: MQTT Additive Sealed Bridge
status: verified
created: 2026-09-11
companions:
  - conventions.md
  - architecture-diagrams.md
  - epics.md
  - ../../planning-artifacts/2026-09-11-mqtt-relay/ARCHITECTURE-SPINE.md
  - ../../planning-artifacts/2026-09-11-mqtt-relay/ANALYSIS.md
sources:
  - ../../planning-artifacts/2026-09-11-mqtt-relay/.memlog.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete contract for what to build, test, and validate. Adopted companions (spine/analysis) are read-only constraints.

# MQTT Additive Sealed Bridge

## Why

**Opportunity + mandate to stay merge-friendly:** Teams unlocks a Private Network so clone nodes on different machines can exchange mail without putting code or keys in the cloud. The product already gates `canNetwork`; transport is missing. The force is to add a **thin sealed MQTT bridge** without rewriting the local on-disk hive — so community/Pro stay unchanged and merges from upstream remain cheap.

## Capabilities

- **CAP-1**
  - **intent:** With Teams network entitlement, the install can send a sealed hive message to a remote peer over MQTT.
  - **success:** A second process/node subscribed to the peer topic receives a ciphertext payload and, after unseal, obtains a valid `HiveMessage` with the same `id`/body the sender sealed.

- **CAP-2**
  - **intent:** With Teams network entitlement, the install can receive sealed MQTT payloads, unseal them, dedupe by message `id`, and materialize them into the local hive inbox via existing `hive.send` / `deliver`.
  - **success:** After inbound, a JSON file exists under the target agent’s `inbox/`; the existing nudge path can wake that agent; duplicate QoS-1 delivery does not create a second pending file for the same `id`.

- **CAP-3**
  - **intent:** Without network entitlement (community / pro / trial, or `networkEnabled` false), the app never opens MQTT publish/subscribe for this bridge and local hive mail behaves as today.
  - **success:** Automated or manual checklist: disk-only Pam→Jim delivery works; no MQTT client connection attempts when `canNetwork` is false.

- **CAP-4**
  - **intent:** Engineers can verify seal/unseal and “broker sees ciphertext only” with focused tests / a local broker spike before any hosted broker.
  - **success:** `npm run test:focused` (or documented spike commands) includes seal roundtrip coverage; broker capture/log review shows no plaintext `subject`/`body`.

## Constraints

- Must obey architecture spine AD-9..AD-13 (additive modules, `hive.send` inbound, no same-machine MQTT, merge-friendly surface, sealed opaque relay).
- Gate all bridge I/O on `plan === 'teams'` and `canUse('network')` / `canNetwork`.
- Local hive contract unchanged: agents Read/mv `inbox/`, `.done/`; nudge text and wake loops stay as-built.
- MQTT: QoS 1, retain **off**; topics must not embed PII (prefer org/device opaque ids).
- Product code under `app/`; new code preferred under `app/src/main/network/` (or equivalent new tree).
- Diffs to `hive.ts` / `hiveNudge.ts` / `useHive.ts` / `workerWake.ts` empty or trivial (optional thin hook or explicit outbound API only).

## Non-goals

- Replacing local inbox/outbox with MQTT.
- Invasive InboxMaterializer rewriting `routeMessage` / `deliver`.
- Fat-nudge, Stop-hook mail force-continue, or agent poll-every-X wake redesign.
- Hosted production broker, seat ACL console, mobile client.
- Switching the wire to Nostr (or other) in this cycle.
- Changing Teams **license** entitlements model (already shipped).

## Success signal

Two harnesses (or one harness + a second Node peer) with Teams network on exchange one sealed message over a local MQTT broker; the recipient’s agent inbox gains a normal hive JSON file and can be woken by the **existing** nudge — while a community build still never touches MQTT.

## Assumptions

- Local Mosquitto (or equivalent) is enough for MVP verification; production broker is a later cycle.
- MVP outbound may use an explicit “send to remote peer” API / org addressing rather than fully rewriting outbox `to=` resolution in the router.

## Open Questions

- Final topic namespace and device-key distribution / rotation UX (document in epic or follow-on spine before production).
- Whether outbound hooks a 5-line optional callback inside `deliver` vs only an explicit IPC/API (either OK if AD-12 holds).
