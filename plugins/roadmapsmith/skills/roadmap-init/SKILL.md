---
name: roadmap-init
description: Initialize project governance files through the RoadmapSmith CLI.
---

# RoadmapSmith Init

Use this command when the governance files are missing and the user wants them created without running the full Zero Mode interview.

## Required behavior

1. Prefer the local engine inside this repository:
   - `node roadmap-skill/bin/cli.js init --project-root .`
2. Otherwise prefer `roadmapsmith init`.
3. Treat this command as CLI-backed and summarize whether files were created or skipped.
