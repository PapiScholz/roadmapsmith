---
name: setup
description: Generate RoadmapSmith host integration files through the CLI.
---

# RoadmapSmith Setup

Use this command when the user wants RoadmapSmith host integration files generated or refreshed for the current repository.

## Required behavior

1. Prefer running `roadmapsmith setup --project-root . --hosts codex,claude`.
2. Explain that setup affects the repository host layer: VS Code tasks, launcher/wrappers, and the optional repo-local Claude hook.
3. Do not claim that setup alone creates native Claude GUI slash commands; those come from the installed RoadmapSmith skill bundle.
4. If the CLI is missing, explain the installation path:
   - `npm install -g roadmapsmith`
   - `npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code`
   - run `/reload-skills`
   - if RoadmapSmith was installed as a Claude plugin, also run `/reload-plugins`
