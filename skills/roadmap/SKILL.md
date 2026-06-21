---
name: roadmap
description: Show the RoadmapSmith native slash palette without side effects.
---

# RoadmapSmith Palette

Use this command as the native discovery entrypoint for the shared RoadmapSmith slash bundle.

## Required behavior

1. Treat `/roadmap` as a no-side-effects palette. Do not run mutating commands from this skill.
2. If the `roadmapsmith` CLI is available, run `roadmapsmith /roadmap` from the project root and use that output directly.
3. If the CLI is missing, direct the user to the official repository README for installation instructions.
4. Explain the preferred native host entrypoints:
   - `/roadmap-zero`
   - `/roadmap-maintain`
   - `/roadmap-status`
   - `/roadmap-init`, `/roadmap-generate`, `/roadmap-validate`, `/roadmap-update`, `/roadmap-audit`, and `/roadmap-setup`
5. Mention that `/roadmap-sync <action>` remains a deprecated legacy CLI compatibility root, and `/road` plus `/road <action>` remain deprecated CLI compatibility aliases.

## Output contract

- Show what each command does in one sentence.
- Include namespaced slash examples plus CLI equivalents.
- Do not modify files or generate a roadmap from this command alone.
