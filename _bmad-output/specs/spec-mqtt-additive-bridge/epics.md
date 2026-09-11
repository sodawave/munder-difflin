---
title: MQTT additive bridge — Epics & Stories
status: ready
created: 2026-09-11
spec: SPEC.md
---

# Epics & Stories

Branch prefix suggestion: `feat/mqtt-additive-bridge` or `spec/2026-09-11-mqtt-additive-bridge`.

## Epic M1 — Seal module + tests

- **M1-S1:** Device keypair generate/load under harness or userData (not in git); Ed25519 + X25519 material as needed for sealed box
- **M1-S2:** `seal(plaintext, recipientPub) → blob` / `unseal(blob) → plaintext` roundtrip unit tests
- **M1-S3:** Document that plaintext never logged; test helper asserts JSON subject/body absent from “wire” buffer

## Epic M2 — MQTT client behind canNetwork

- **M2-S1:** Config for broker URL (env/dev default `mqtt://127.0.0.1:1883`); retain forced off; QoS 1 publish
- **M2-S2:** Start subscribe only when `canNetwork`; stop on revoke / plan downgrade
- **M2-S3:** Topic helper using opaque org/device ids (no email/path PII)

## Epic M3 — Bridge inbound → hive.send

- **M3-S1:** On message: unseal → parse `HiveMessage` → dedupe by `id` → `hive.send` / `deliver` to local target (default god if unspecified)
- **M3-S2:** Verify existing nudge can observe new inbox file (manual or focused harness test)
- **M3-S3:** Duplicate publish (QoS 1 redelivery) does not dual-file pending inbox

## Epic M4 — Bridge outbound (MVP)

- **M4-S1:** Explicit main API (and optional preload IPC) to send sealed message to remote device id
- **M4-S2:** Gate API with `canNetwork`; clear error when gated off
- **M4-S3:** Optional: thin Settings/org affordance or dev-only trigger to exercise send (no full peer directory UX required)

## Epic M5 — Verify + merge hygiene

- **M5-S1:** `npm run typecheck` + focused tests green from `app/`
- **M5-S2:** Checklist: community path no MQTT; Teams sim + local Mosquitto end-to-end
- **M5-S3:** PR diff review: `hive.ts` / nudge / `useHive` / `workerWake` empty or trivial only

## Out of epic scope (spine Deferred/Rejected)

Fat-nudge, Stop drain redesign, mailbox replacement, hosted broker, mobile, Nostr.
