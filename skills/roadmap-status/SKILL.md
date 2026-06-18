---
name: roadmap-status
description: Inspect RoadmapSmith readiness through doctor JSON and summarize the result.
---

# RoadmapSmith Status

Use this command to inspect whether the shared bundle, native host surfaces, CLI, roadmap files, VS Code task UX, runtime, and Claude hook are ready.

## Required behavior

1. Prefer the local engine inside this repository:
   - `node roadmap-skill/bin/cli.js doctor --json --project-root .`
   - on this Windows machine, prefer `C:\Program Files\nodejs\node.exe roadmap-skill/bin/cli.js doctor --json --project-root .` if `node` is not in PATH
2. Otherwise prefer `roadmapsmith doctor --json --project-root .`.
3. Parse and summarize the JSON output in plain language.
4. Explicitly call out missing commands or duplicate `/roadmap-sync` registration when doctor reports them.
