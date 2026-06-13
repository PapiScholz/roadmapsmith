---
name: sync
description: Apply evidence-backed roadmap checklist synchronization through the RoadmapSmith CLI.
---

# RoadmapSmith Sync

Use this command when the user wants validation outcomes applied back into `ROADMAP.md`.

## Required behavior

1. Prefer running `roadmapsmith sync --project-root .`.
2. Treat this command as CLI-backed and mutating.
3. If the CLI is missing, explain the installation path:
   - `npm install -g roadmapsmith`
   - `npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code`
   - run `/reload-skills`
   - if RoadmapSmith was installed as a Claude plugin, also run `/reload-plugins`
4. Remind the user that sync updates checklist state based on repository evidence, not model claims.
