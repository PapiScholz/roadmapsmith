---
name: roadmap-maintain
description: Run the preserve-first existing-repository maintenance workflow through the RoadmapSmith CLI.
---

# RoadmapSmith Maintain

Use this command when the repository already has code, tests, docs, or an existing roadmap and the user wants the default maintenance flow.

## Required behavior

1. Prefer the local engine inside this repository:
   - `node roadmap-skill/bin/cli.js maintain --project-root .`
   - on this Windows machine, prefer `C:\Program Files\nodejs\node.exe roadmap-skill/bin/cli.js maintain --project-root .` if `node` is not in PATH
2. Otherwise prefer `roadmapsmith maintain --project-root .`. If that global shim fails because `node` is not in PATH, run `& "C:\Program Files\nodejs\node.exe" "$env:APPDATA\npm\node_modules\roadmapsmith\bin\cli.js" maintain --project-root .`.
3. Treat this command as CLI-backed. Do not silently replace it with manual reasoning when the CLI is unavailable.
4. Mention that maintain runs preserve-first generate, sync, and audit in one invocation.
5. After a successful maintain cycle, do not propose generate, sync, or audit separately unless the user needs manual control or inspection.
6. Mention that `roadmapsmith maintain --full-regen` or `roadmapsmith generate --full-regen` is the explicit destructive rebuild path when the user truly wants a full managed-block replacement.
7. When the user wants stale or outdated warning annotations to be recomputed from scratch (including annotations that were written by a prior maintain run or an external agent), use `roadmapsmith maintain --refresh-annotations`. This forces all existing warning text to be replaced with the current deterministic result rather than preserved. It is distinct from `--full-regen` (which rebuilds the managed block structure) — `--refresh-annotations` only affects warning annotations on still-failing tasks.
