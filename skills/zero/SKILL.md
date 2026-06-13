---
name: zero
description: Run the one-command Zero Mode workflow through the RoadmapSmith CLI.
---

# RoadmapSmith Zero Mode

Use this command when the repository is empty or low-context and the user wants the first roadmap.

## Required behavior

1. Prefer running `roadmapsmith zero --project-root .` from the repository root.
2. Treat this command as CLI-backed. Do not replace it with a handcrafted discovery interview unless the user explicitly asks to work without the CLI.
3. If the CLI is missing, stop and explain the required setup:
   - `npm install -g roadmapsmith`
   - `npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code`
   - run `/reload-skills`
   - if RoadmapSmith was installed as a Claude plugin, also run `/reload-plugins`
4. Mention that `/roadmap-sync` remains valid, but `/zero` is the preferred Claude GUI entrypoint for this workflow.

## Success criteria

- The command runs the actual Zero Mode CLI flow.
- The response summarizes that Zero Mode covers discovery, governance-file creation, and roadmap generation.
