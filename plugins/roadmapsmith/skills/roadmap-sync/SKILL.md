---
name: roadmap-sync
description: Legacy namespaced root and policy guidance for RoadmapSmith slash workflows.
---

# RoadmapSmith Legacy Root

Use this skill when the host exposes or the user invokes `/roadmap-sync`, or when the agent needs the RoadmapSmith operating rules for roadmap maintenance.

## Required behavior

1. Treat bare `/roadmap-sync` as legacy palette/help, and treat `/roadmap-sync <action>` as the deprecated compatibility root.
2. Prefer the namespaced native commands for new guidance:
   - `/roadmap` for discovery
   - `/roadmap-zero`
   - `/roadmap-maintain`
   - `/roadmap-status`
   - `/roadmap-init`, `/roadmap-generate`, `/roadmap-validate`, `/roadmap-update`, `/roadmap-audit`, and `/roadmap-setup`
3. When the user explicitly invokes `/roadmap-sync <action>`, route to the matching CLI-backed action without changing semantics and mention the migration path to `/roadmap <action>` or the direct `/roadmap-*` command.
4. Preserve the operating rules for evidence-backed roadmap maintenance and checklist synchronization.
