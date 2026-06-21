---
name: roadmap-maintain
description: Run the preserve-first existing-repository maintenance workflow through the RoadmapSmith CLI.
---

# RoadmapSmith Maintain

Use this command when the repository already has code, tests, docs, or an existing roadmap and the user wants the default maintenance flow.

## Required behavior

1. Run `roadmapsmith maintain --project-root .`.
2. Treat this command as CLI-backed. Do not silently replace it with manual reasoning when the CLI is unavailable.
3. Mention that maintain runs preserve-first generate, sync, and audit in one invocation.
4. After a successful maintain cycle, do not propose generate, sync, or audit separately unless the user needs manual control or inspection.
