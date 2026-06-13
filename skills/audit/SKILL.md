---
name: audit
description: Run the current RoadmapSmith sync-plus-audit workflow through the CLI.
---

# RoadmapSmith Audit

Use this command when the user wants the current audit workflow from Claude GUI.

## Required behavior

1. Prefer running `roadmapsmith sync --audit --project-root .`.
2. Be explicit that today's audit behavior is the mutating sync path plus a mismatch summary, not a read-only audit mode.
3. If the CLI is missing, explain the installation path:
   - `npm install -g roadmapsmith`
   - `npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code`
   - run `/reload-skills`
   - if RoadmapSmith was installed as a Claude plugin, also run `/reload-plugins`
4. Summarize both the sync result and the audit summary.
