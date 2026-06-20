---
name: roadmap-update
description: Apply evidence-backed checklist sync or complete one task with verified evidence through the RoadmapSmith CLI.
---

# RoadmapSmith Update

Use this command when the user wants the direct sync surface without routing through the legacy `/roadmap-sync <action>` root.

## Required behavior

1. Prefer the local engine inside this repository:
   - `node roadmap-skill/bin/cli.js update --project-root .`
   - on this Windows machine, prefer `C:\Program Files\nodejs\node.exe roadmap-skill/bin/cli.js update --project-root .` if `node` is not in PATH
2. Otherwise prefer `roadmapsmith update --project-root .`. If that global shim fails because `node` is not in PATH, run `& "C:\Program Files\nodejs\node.exe" "$env:APPDATA\npm\node_modules\roadmapsmith\bin\cli.js" update --project-root .`.
3. Explain that `/roadmap-update` is the visible namespaced sync command, while `/roadmap-sync <action>` remains legacy compatibility.
4. Keep the evidence-backed sync semantics unchanged: no-argument update syncs the roadmap from repository evidence; it is not a full regeneration path.
5. To complete one task, run `roadmapsmith update --task <stable-id> --evidence "<single-line evidence>"`. It writes only after the supplied evidence validates at high confidence; use `--dry-run` to preview it.
