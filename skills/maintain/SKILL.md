---
name: maintain
description: Run the one-command existing-repository maintenance workflow through the RoadmapSmith CLI.
---

# RoadmapSmith Maintain

Use this command when the repository already has code, tests, docs, or an existing roadmap and the user wants the default maintenance flow.

## Required behavior

1. Prefer running `roadmapsmith maintain --project-root .` from the repository root.
2. Treat this command as CLI-backed. Do not silently replace it with manual generate/sync reasoning when the CLI is unavailable.
3. If the CLI is missing, explain the installation path:
   - `npm install -g roadmapsmith`
   - `npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code`
   - run `/reload-skills`
   - if RoadmapSmith was installed as a Claude plugin, also run `/reload-plugins`
4. Mention that this workflow runs generate, sync, and audit in one invocation.

## Success criteria

- The command uses the CLI-backed maintain flow.
- The response summarizes the resulting roadmap/audit outcome.
