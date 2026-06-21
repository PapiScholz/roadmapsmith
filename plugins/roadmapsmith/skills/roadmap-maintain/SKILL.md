---
name: roadmap-maintain
description: Run the preserve-first existing-repository maintenance workflow through the RoadmapSmith CLI.
---

# RoadmapSmith Maintain

Use this command when the repository already has code, tests, docs, or an existing roadmap and the user wants the default maintenance flow.

## Required behavior

1. Prefer the local engine inside this repository:
   - `node roadmap-skill/bin/cli.js maintain --project-root .`
2. Otherwise prefer `roadmapsmith maintain --project-root .`.
3. Treat this command as CLI-backed. Do not silently replace it with manual reasoning when the CLI is unavailable.
4. Mention that maintain runs preserve-first generate, sync, and audit in one invocation.
5. Mention that `roadmapsmith maintain --full-regen` or `roadmapsmith generate --full-regen` is the explicit destructive rebuild path when the user truly wants a full managed-block replacement.
