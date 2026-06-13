---
name: status
description: Inspect RoadmapSmith readiness through doctor JSON and summarize the result.
---

# RoadmapSmith Status

Use this command to inspect whether the CLI, roadmap files, VS Code task UX, runtime, and Claude hook are ready.

## Required behavior

1. Prefer running `roadmapsmith doctor --json --project-root .` from the repository root.
2. Parse and summarize the JSON output for the user in plain language.
3. If the CLI is missing, explain the installation path instead of fabricating a status result:
   - `npm install -g roadmapsmith`
   - `npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code`
   - run `/reload-skills`
   - if RoadmapSmith was installed as a Claude plugin, also run `/reload-plugins`
4. Highlight whether Claude GUI skills, CLI resolution, and task/runtime readiness are healthy or not.

## Success criteria

- The command is grounded in doctor JSON, not a guess.
- The response clearly distinguishes missing CLI vs missing host wiring.
