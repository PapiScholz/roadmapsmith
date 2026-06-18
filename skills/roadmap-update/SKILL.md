---
name: roadmap-update
description: Apply evidence-backed checklist sync through the RoadmapSmith CLI.
---

# RoadmapSmith Update

Use this command when the user wants the direct sync surface without routing through the legacy `/roadmap-sync <action>` root.

## Required behavior

1. Prefer the local engine inside this repository:
   - `node roadmap-skill/bin/cli.js sync --project-root .`
   - on this Windows machine, prefer `C:\Program Files\nodejs\node.exe roadmap-skill/bin/cli.js sync --project-root .` if `node` is not in PATH
2. Otherwise prefer `roadmapsmith sync --project-root .`.
3. Explain that `/roadmap-update` is the visible namespaced sync command, while `/roadmap-sync <action>` remains legacy compatibility.
4. Keep the evidence-backed sync semantics unchanged: sync updates checklist state from repository evidence; it is not a full regeneration path.
