---
name: roadmap-status
description: Inspect RoadmapSmith readiness through status JSON and summarize the result.
---

# RoadmapSmith Status

Use this command to inspect whether the shared bundle, native host surfaces, CLI, roadmap files, VS Code task UX, runtime, and Claude hook are ready.

## Required behavior

1. Run `roadmapsmith status --json --project-root .`.
2. Treat `roadmapsmith doctor --json` as compatibility-only output for existing automation, not as the primary recommendation.
4. Parse and summarize the JSON output in plain language.
5. Explicitly call out missing canonical commands, duplicate legacy `/roadmap-sync` registration, and any missing advanced VS Code labels as warnings rather than canonical-readiness failures.
