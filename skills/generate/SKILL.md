---
name: generate
description: Rebuild the managed roadmap block from repository context through the RoadmapSmith CLI.
---

# RoadmapSmith Generate

Use this command when the user wants the roadmap regenerated from repository evidence without running the full maintain shortcut.

## Required behavior

1. Prefer running `roadmapsmith generate --project-root .`.
2. Treat this command as CLI-backed.
3. If the CLI is missing, explain the installation path:
   - `npm install -g roadmapsmith`
   - `npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code`
   - run `/reload-skills`
   - if RoadmapSmith was installed as a Claude plugin, also run `/reload-plugins`
4. Summarize whether the roadmap changed and mention audit output if the user requested it separately.
