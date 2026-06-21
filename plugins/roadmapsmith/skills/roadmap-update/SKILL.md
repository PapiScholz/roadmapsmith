---
name: roadmap-update
description: Apply evidence-backed checklist sync or complete one task with verified evidence through the RoadmapSmith CLI.
---

# RoadmapSmith Update

Use this command when the user wants the canonical public `update` surface without routing through the legacy `/roadmap-sync <action>` root.

## Required behavior

1. Prefer the local engine inside this repository:
   - `node roadmap-skill/bin/cli.js update --project-root .`
2. Otherwise prefer `roadmapsmith update --project-root .`.
3. Explain that `/roadmap-update` is the visible namespaced command for the public `update` family, while `/roadmap-sync <action>` remains deprecated compatibility only.
4. Keep the evidence-backed refresh semantics unchanged: no-argument `update` syncs the roadmap from repository evidence, and `sync` remains the advanced CLI alias for that same mutating refresh path. It is not a full regeneration path and not an independent audit engine.
5. To complete one task, run `roadmapsmith update --task <stable-id> --evidence "<single-line evidence>"`. It writes only after the supplied evidence validates at high confidence; use `--dry-run` to preview it.
