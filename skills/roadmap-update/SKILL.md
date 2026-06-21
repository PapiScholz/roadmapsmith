---
name: roadmap-update
description: Apply evidence-backed checklist sync or complete one task with verified evidence through the RoadmapSmith CLI.
---

# RoadmapSmith Update

Use this command when the user wants the canonical public `update` surface without routing through the legacy `/roadmap-sync <action>` root.

## Required behavior

1. Run `roadmapsmith update --project-root .`.
2. Explain that `/roadmap-update` is the visible namespaced command for the public `update` family, while `/roadmap-sync <action>` remains deprecated compatibility only.
3. The no-argument `update` syncs the roadmap from repository evidence. The `sync` alias covers the same refresh path. It is not a full regeneration path and not an independent audit engine.
4. To mark a specific task complete, run `roadmapsmith update --task TASK-ID --evidence "description"`. The CLI validates before writing; use `--dry-run` to preview.
