---
name: roadmap-sync
description: DEPRECATED legacy root for RoadmapSmith slash workflows; use roadmap-maintain or roadmap-update.
---

# RoadmapSmith Legacy Root (Deprecated)

Use this skill only when the host exposes or the user explicitly invokes `/roadmap-sync`. For new work, use `/roadmap-maintain` for the daily flow or `/roadmap-update` for evidence-backed completion.

## Required behavior

1. Treat bare `/roadmap-sync` as legacy palette/help, and treat `/roadmap-sync <action>` as the deprecated compatibility root.
2. Prefer the namespaced native commands for new guidance:
   - `/roadmap` for discovery
   - `/roadmap-zero`
   - `/roadmap-maintain`
   - `/roadmap-status`
   - `/roadmap-init`, `/roadmap-generate`, `/roadmap-validate`, `/roadmap-update`, `/roadmap-audit`, and `/roadmap-setup`
3. When the user explicitly invokes `/roadmap-sync <action>`, route to the matching CLI-backed action without changing semantics and mention the migration path to `/roadmap <action>` or the direct `/roadmap-*` command.
4. Preserve the operating rules for evidence-backed roadmap maintenance and checklist synchronization: heuristic file/token matches may diagnose candidates, but only explicit `Evidence:` or typed `Verify:` checks may complete an unchecked implementation task. Never claim a behavioral task is complete without fresh test evidence or human verification.
