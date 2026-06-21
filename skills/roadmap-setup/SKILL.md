---
name: roadmap-setup
description: Generate RoadmapSmith host integration files through the CLI.
---

# RoadmapSmith Setup

Use this command when the user wants RoadmapSmith host integration files generated or refreshed for the current repository.

## Required behavior

1. Run `roadmapsmith setup --project-root . --hosts codex,claude`.
2. Explain that setup generates VS Code task definitions for the current repository.
3. Do not claim that setup alone creates native host slash commands; those come from the installed bundle/plugin.
