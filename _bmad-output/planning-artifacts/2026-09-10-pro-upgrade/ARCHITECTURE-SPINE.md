---
title: Pro Upgrade — Architecture Spine
status: final
created: 2026-09-10
---

# Architecture Spine — Pro Upgrade

Inherits as-built dual-plane AD-1..AD-5. New decisions:

### AD-6 Entitlement boundary [ADOPTED]

- **Binds:** Plan state owned by main `EntitlementStore`; renderer only via preload.
- **Prevents:** Renderer forging Pro access; payment IDs in renderer/analytics.
- **Rule:** Checkout is external URL only; refresh may pull signed/plain entitlement JSON without card fields.

### AD-7 Stapler process isolation [ADOPTED]

- **Binds:** Stapler is its own `BrowserWindow` (alwaysOnTop); destroyed when gated off or disabled.
- **Prevents:** Embedding capture UI in the floor renderer security/UX tangle.
- **Rule:** Captures land under `{harnessHome}/stapler/`; orchestrator receives paths + notes, not mandatory binary IPC blobs.

### AD-8 Pro shell as layout mode [ADOPTED]

- **Binds:** `ui.shell` switches Classic floor vs Pro compact shell in the main window.
- **Prevents:** Forking hive/PTY for a second product.
- **Rule:** Pro shell mounts existing Command Center panels; no second hive.
