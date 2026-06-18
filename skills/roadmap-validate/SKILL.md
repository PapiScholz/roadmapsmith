---
name: roadmap-validate
description: Inspect evidence-backed roadmap validation through the RoadmapSmith CLI.
---

# RoadmapSmith Validate

Use this command when the user wants per-task evidence status without mutating the roadmap.

## Required behavior

1. Prefer the local engine inside this repository:
   - `node roadmap-skill/bin/cli.js validate --json --project-root .`
   - on this Windows machine, prefer `C:\Program Files\nodejs\node.exe roadmap-skill/bin/cli.js validate --json --project-root .` if `node` is not in PATH
2. Otherwise prefer `roadmapsmith validate --json --project-root .`.
3. Treat this command as CLI-backed and non-mutating.
