---
name: init
description: Create ROADMAP.md and AGENTS.md through the RoadmapSmith CLI.
---

# RoadmapSmith Init

Use this command when the governance files are missing and the user wants them created without running the full Zero Mode interview.

## Required behavior

1. Prefer running `roadmapsmith init` from the repository root.
2. Treat this command as CLI-backed.
3. If the CLI is missing, explain the installation path:
   - `npm install -g roadmapsmith`
   - `npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code`
   - run `/reload-skills`
   - if RoadmapSmith was installed as a Claude plugin, also run `/reload-plugins`
4. Summarize whether `ROADMAP.md` and `AGENTS.md` were created or skipped because they already existed.
