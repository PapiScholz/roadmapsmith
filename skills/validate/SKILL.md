---
name: validate
description: Inspect roadmap task evidence through the RoadmapSmith validate command.
---

# RoadmapSmith Validate

Use this command when the user wants evidence-backed validation details for roadmap tasks.

## Required behavior

1. Prefer running `roadmapsmith validate --json --project-root .`.
2. Keep the JSON grounding and summarize the key pass/fail results for the user.
3. If the CLI is missing, explain the installation path:
   - `npm install -g roadmapsmith`
   - `npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code`
   - run `/reload-skills`
   - if RoadmapSmith was installed as a Claude plugin, also run `/reload-plugins`
4. Do not claim task completion without validation output.
