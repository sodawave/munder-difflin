---
title: MQTT additive bridge — diagrams
status: final
created: 2026-09-11
---

# Architecture diagrams

## Planes

```mermaid
flowchart LR
  subgraph local [Same_machine]
    Outbox[agent_outbox]
    Router[HiveManager]
    Disk[inbox_disk]
    Nudge[existing_PTY_nudge]
    Outbox --> Router --> Disk --> Nudge
  end
  subgraph bridge [Teams_network_only]
    Seal[seal_module]
    Mqtt[MQTT_broker]
    Unseal[unseal_module]
    Send[hive_send]
  end
  Router -.->|remote_to| Seal --> Mqtt --> Unseal --> Send --> Disk
```

## Entitlement gate

```text
canNetwork == false  →  no MQTT client; local deliver only
canNetwork == true   →  local deliver unchanged; remote path may seal+publish / subscribe+unseal+hive.send
```
