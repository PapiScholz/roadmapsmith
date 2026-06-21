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
3. When the user explicitly invokes `/roadmap-sync <action>`, route to the matching CLI-backed action without changing semantics and mention the migration path to the direct `/roadmap-*` command.
4. When routing `/roadmap-sync validate`, the tool uses the same validation rules as `/roadmap-validate`. Implementation tasks require an explicit `Evidence:` line or a `Verify:` check to be marked complete.
