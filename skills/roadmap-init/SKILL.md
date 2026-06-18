---
name: roadmap-init
description: Create ROADMAP.md and AGENTS.md through the RoadmapSmith CLI.
---

# RoadmapSmith Init

Use this command when the governance files are missing and the user wants them created without running the full Zero Mode interview.

## Required behavior

1. Prefer the local engine inside this repository:
   - `node roadmap-skill/bin/cli.js init --project-root .`
   - on this Windows machine, prefer `C:\Program Files\nodejs\node.exe roadmap-skill/bin/cli.js init --project-root .` if `node` is not in PATH
2. Otherwise prefer `roadmapsmith init`.
3. Treat this command as CLI-backed and summarize whether files were created or skipped.
