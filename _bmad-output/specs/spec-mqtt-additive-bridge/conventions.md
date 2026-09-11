---
title: MQTT additive bridge — conventions
status: final
created: 2026-09-11
---

# Conventions (implementation hints)

HOW detail for implementers. WHAT remains in SPEC.md.

## Module layout

- Prefer `app/src/main/network/` (seal, mqtt client, bridge orchestration).
- No BMAD or broker config under `app/` product UI trees beyond Settings gates already used for Teams.
- Tests: `app/test/*network*` or `*seal*` via `npm run test:focused` from `app/`.

## Crypto (product intent)

- Seal for recipient device: X25519 sealed box + XChaCha20-Poly1305; sign with Ed25519 (align marketing Private Network).
- Keys never leave the machine; broker never decrypts.

## MQTT

- QoS 1, clean session policy TBD in epic; **retain must be false** for sealed traffic.
- Topic sketch (non-binding until Open Question closed): `md/{orgId}/dev/{deviceId}/inbox`.

## Entitlement

- Subscribe/publish only when `canNetwork` is true; tear down client when revoked.
- Use existing Teams sim / entitlements; do not invent a second license plane.

## Outbound MVP

- Explicit API acceptable: e.g. main method `sendRemoteHiveMessage(peerDeviceId, HiveMessage)` used from org/settings or a thin IPC — avoids router rewrite.
- If touching `deliver`, keep to optional callback ≤ few lines when `to` resolves remote.
