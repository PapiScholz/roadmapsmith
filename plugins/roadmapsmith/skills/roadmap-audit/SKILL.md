---
name: roadmap-audit
description: Run the sync-plus-audit workflow through the RoadmapSmith CLI.
---

# RoadmapSmith Audit

Use this command when the user wants the post-sync mismatch summary after applying evidence-backed checklist updates.

## Required behavior

1. Prefer the local engine inside this repository:
   - `node roadmap-skill/bin/cli.js sync --audit --project-root .`
2. Otherwise prefer `roadmapsmith sync --audit --project-root .`.
3. Explain that this is the current sync-plus-audit flow, not a standalone read-only audit engine.
