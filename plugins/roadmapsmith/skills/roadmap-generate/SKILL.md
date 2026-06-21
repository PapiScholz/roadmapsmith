---
name: roadmap-generate
description: Run the preserve-first roadmap update flow through the RoadmapSmith CLI.
---

# RoadmapSmith Generate

Use this command when the user wants the managed roadmap block updated from repository evidence without replacing substantive existing domain content.

## Required behavior

1. Prefer the local engine inside this repository:
   - `node roadmap-skill/bin/cli.js generate --project-root .`
2. Otherwise prefer `roadmapsmith generate --project-root .`.
3. Explain that `generate` is preserve-first when a substantive managed block already exists.
4. When the user explicitly wants the destructive path, use `roadmapsmith generate --project-root . --full-regen`.
5. Summarize what stayed preserved, whether generation refused, and what new additions, if any, were inserted.
