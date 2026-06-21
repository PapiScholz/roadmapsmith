---
name: roadmap-setup
description: Generate RoadmapSmith host integration files through the CLI.
---

# RoadmapSmith Setup

Use this command when the user wants RoadmapSmith host integration files generated or refreshed for the current repository.

## Required behavior

1. Prefer the local engine inside this repository:
   - `node roadmap-skill/bin/cli.js setup --project-root . --hosts codex,claude`
2. Otherwise prefer `roadmapsmith setup --project-root . --hosts codex,claude`.
3. Explain that setup generates host integration files for the current repository: VS Code tasks and launcher/wrappers.
4. Do not claim that setup alone creates native host slash commands; those come from the installed bundle/plugin.
