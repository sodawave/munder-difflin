---
title: MQTT Additive Bridge — Architecture Spine
status: final
created: 2026-09-11
updated: 2026-09-11
altitude: feature
inherits: 2026-09-10-munder-as-built AD-1..AD-5; 2026-09-10-pro-upgrade AD-6..AD-8; Teams license cycle (entitlements/network gate)
---

# Architecture Spine — MQTT Additive Bridge (Private Network prep)

Inherits dual-plane as-built and Pro entitlement boundary. This spine records **cross-node messaging** decisions only. Rationale lives in `.memlog.md`.

## Paradigm

**Additive sealed bridge:** the local hive (disk mailboxes, router, PTY nudge) stays the same-machine coordination plane. A **new** MQTT + seal module carries opaque envelopes between installs when Teams network is unlocked; the peer **materializes** into the existing `hive.send` / `deliver` path so agent read/wake behavior is unchanged.

```text
Local outbox → HiveManager router → deliver (disk)     [always, same machine]
                    │
                    └─(Teams + remote to=)→ seal → MQTT → peer unseal → hive.send → disk → existing nudge
```

## Inherited invariants (read-only)

- AD-1 Dual planes — do not collapse terminal and hive into one bus.
- AD-2 Workspace product boundary — product under `app/`; BMAD at repo root.
- AD-6 Entitlement boundary — plan/network gates in main; no payment IDs in-app.

## Architectural decisions

### AD-9 Additive MQTT bridge only [ADOPTED]

- **Binds:** Cross-device Private Network traffic uses a **new** module tree (e.g. `app/src/main/network/`), gated by `plan === 'teams'` and `canUse('network')` / `canNetwork`.
- **Prevents:** Rewriting `hive.ts` router core, `hiveNudge.ts`, `useHive` wake loops, or PROTOCOL as part of “adding MQTT”; installing a parallel product messaging stack that bypasses entitlements.
- **Rule:** Community / Pro / trial paths must remain byte-compatible with today’s on-disk hive (no broker required).

### AD-10 Inbound lands on existing hive.send [ADOPTED]

- **Binds:** After unseal + validate + dedupe by message `id`, inbound remote mail calls existing `HiveManager.send` / `deliver` (same shape as webhook injection).
- **Prevents:** Agents speaking MQTT; a second inbox format; renderer-side decrypt; skipping `.done` / nudge semantics.
- **Rule:** Peer agents still only Read/mv files under `agents/<id>/inbox/`.

### AD-11 Same-machine never uses MQTT [ADOPTED]

- **Binds:** If `to` resolves to an agent on **this** harness, delivery is local disk only.
- **Prevents:** Forcing Mosquitto/broker/crypto on solo or same-laptop multi-agent work; offline laptop breakage.
- **Rule:** Even under Teams, Pam→Jim on one machine stays `deliver` to disk.

### AD-12 Merge-friendly surface [ADOPTED]

- **Binds:** Prefer new files + minimal hooks (optional thin callback or explicit outbound API). Diffs to `hive.ts` / nudge / `useHive` / `workerWake` must be empty or trivial.
- **Prevents:** Forking upstream mail design so merges from `chaitanyagiri/munder-difflin` become painful.
- **Rule:** If a change requires redesigning the mailbox contract, stop and open a new spine — do not “fix forward” inside this feature.

### AD-13 Sealed opaque relay [ADOPTED]

- **Binds:** On the wire: sealed boxes (product intent: Ed25519 + X25519 sealed box + XChaCha20); broker must not need plaintext. MQTT QoS 1, **retain off**, topic design without PII.
- **Prevents:** Plaintext hive JSON on the broker; retained sealed blobs; treating the broker as a trusted app server that reads mail.
- **Rule:** Spike/implementation proves ciphertext-only on the broker before any production host.

## Deferred / rejected (do not implement in this cycle)

| Item | Status | Why blocked |
|------|--------|-------------|
| Replace local inbox/outbox with MQTT | **Rejected** | Breaks PROTOCOL, tools, nudge/`inbox-nonempty`, local-first |
| Invasive InboxMaterializer rewriting `routeMessage`/`deliver` | **Rejected** | Merge hazard; AD-9/AD-12 |
| Fat-nudge / inject full body into PTY | **Deferred** | Wake latency debate; separate cycle; changes messaging structure |
| Stop-hook force-continue mail drain as default | **Deferred** | As-built Stop path does not block-on-mail; redesign ≠ bridge |
| Agent polls inbox every X instead of nudge | **Rejected** (as sole wake) | Idle TUI still needs harness wake; empty polls cost tokens |
| Hosted production broker / seat ACL console | **Deferred** | After spine → spec; license console is separate |
| Mobile client | **Deferred** | Marketed “coming”; not this bridge MVP |
| Nostr or other relay instead of MQTT | **Deferred** | MQTT locked for cross-node spike/spec unless a later spine overturns AD-9 |

## Next process step

Author a BMAD **spec** (or epics/stories) from this spine before product implementation. Optional learning spike only after spec acceptance, still obeying AD-9..AD-13.
