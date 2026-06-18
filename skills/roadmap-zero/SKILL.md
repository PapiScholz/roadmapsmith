---
name: roadmap-zero
description: Run the one-command Zero Mode workflow through the RoadmapSmith CLI.
---

# RoadmapSmith Zero

Use this command when the repository is empty or low-context and the user needs the discovery interview plus first roadmap generation.

## Required behavior

1. Prefer the local engine inside this repository:
   - `node roadmap-skill/bin/cli.js zero --project-root .`
   - on this Windows machine, prefer `C:\Program Files\nodejs\node.exe roadmap-skill/bin/cli.js zero --project-root .` if `node` is not in PATH
2. Otherwise prefer `roadmapsmith zero --project-root .`.
3. Treat this command as CLI-backed and interactive.
4. If the CLI is missing, explain the install path instead of improvising the workflow manually.
