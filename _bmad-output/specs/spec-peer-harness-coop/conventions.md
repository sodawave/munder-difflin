---
title: Peer harness coop — conventions
status: final
created: 2026-09-12
---

# Conventions (implementation hints)

HOW detail. WHAT remains in SPEC.md.

## Module layout

- Extend `app/src/main/network/`: topics helpers, peers store, roster publish/subscribe, `sendRemote` targeting `(deviceId, agentId)`.
- Renderer: thin Settings or Command Center peers/roster + tint; no BMAD under `app/`.
- Tests: extend `npm run test:network-spec` / focused network tests from `app/`.

## Sync screen (add remote harness)

Primary UI for CAP-1/CAP-2. Layout sketch (not pixel-perfect):

1. **Boss address** — read-only card + Copy (this install’s `mqttUrl`, `deviceId`, pubs, `envLabel`).
2. **Peer address** — paste/import; validate `v` + pubs; save peer.
3. **Share my agents** — checklist bound to local registry; persists `publishAgentIds[]` per peer or global publish set (global publish set is enough in cycle-1 if only 2–3 machines).
4. **Follow peer agents** — checklist from last roster payload; persists `followAgentIds[]` keyed by `peerDeviceId`.
5. Connection status + link to send-mail for followed remotes.

DESIGN tokens: follow [`app/DESIGN.md`](../../../app/DESIGN.md); tint from `deviceId` hash → palette index.

## Topics

```text
md/{lanNs}/dev/{deviceId}/agents/{agentId}/inbox   # delivery
md/{lanNs}/dev/{deviceId}/roster                   # knowhow cards JSON
```

- `lanNs` = `local` in cycle-1 (`sanitizeId` as today).
- Subscribe own inbox: `md/local/dev/{myDevice}/agents/+/inbox` (or explicit agent list).
- Subscribe peer rosters after pair.
- QoS 1, retain **false**. No absolute paths / emails in topics.

## Peer address card (export/import)

```json
{
  "v": 1,
  "mqttUrl": "mqtt://192.168.1.10:1883",
  "deviceId": "…",
  "x25519PublicKey": "…",
  "ed25519PublicKey": "…",
  "envLabel": "prod-vps"
}
```

Persist under harness home `network/peers.json`. Include sync selection, e.g.:

```json
{
  "peers": [
    {
      "deviceId": "…",
      "mqttUrl": "…",
      "x25519PublicKey": "…",
      "ed25519PublicKey": "…",
      "envLabel": "prod-vps",
      "followAgentIds": ["god", "deploy-bot"]
    }
  ],
  "publishAgentIds": ["god", "deploy-bot"]
}
```

## Knowhow card (roster entry)

```json
{
  "agentId": "deploy-bot",
  "name": "Deploy",
  "role": "ops",
  "caps": ["deploy", "logs"],
  "isGod": false,
  "deviceId": "…",
  "peerLabel": "prod-vps"
}
```

Roster payload = `{ "v": 1, "deviceId", "envLabel", "agents": [ /* cards for publishAgentIds only */ ] }` published by the owning harness.

## UI tint

- Derive a stable accent from `deviceId` (e.g. hash → DESIGN token / palette index).
- Remote rows in list/CC show tint + `envLabel` / peer name; no remote PTY.

## Outbound

- IPC/API: `sendRemote({ peerDeviceId, agentId, message })` gated by `canNetwork`.
- Do not auto-forward local worker outbox in cycle-1.

## Entitlement

- Reuse `canNetwork`; do not build Teams product surfaces for this SPEC.
