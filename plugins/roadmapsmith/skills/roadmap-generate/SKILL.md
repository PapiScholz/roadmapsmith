---
name: roadmap-generate
description: Run the preserve-first roadmap update flow through the RoadmapSmith CLI.
---

# RoadmapSmith Generate

Use this command when the user wants the managed roadmap block updated from repository evidence without replacing substantive existing domain content.

## Required behavior

1. Run `roadmapsmith generate --project-root .`.
2. Explain that `generate` is preserve-first when a substantive managed block already exists.
3. To allow full roadmap regeneration, add `--full-regen`: `roadmapsmith generate --project-root . --full-regen`.
4. Summarize what stayed preserved, whether generation refused, and what new additions, if any, were inserted.
