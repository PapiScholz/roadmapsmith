---
name: roadmap
description: Show the RoadmapSmith native slash palette without side effects.
---

# RoadmapSmith Palette

Use this command as the native discovery entrypoint for the shared RoadmapSmith slash bundle.

## Required behavior

1. Treat `/roadmap` as a no-side-effects palette. Do not run mutating commands from this skill.
2. When working inside the RoadmapSmith repository itself and `roadmap-skill/bin/cli.js` exists, prefer the local engine:
   - `node roadmap-skill/bin/cli.js /roadmap`
   - on this Windows machine, prefer `C:\Program Files\nodejs\node.exe roadmap-skill/bin/cli.js /roadmap` if `node` is not in PATH
3. Otherwise, if the `roadmapsmith` CLI is available, you may run `roadmapsmith /roadmap` from the project root and use that output directly.
4. If the CLI is missing, provide the palette manually and explain the install path:
   - `npm install -g roadmapsmith`
   - `npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code`
   - run `/reload-skills`
   - if RoadmapSmith was installed as a Claude plugin, also run `/reload-plugins`
5. Explain the preferred native host entrypoints:
   - `/roadmap-zero`
   - `/roadmap-maintain`
   - `/roadmap-status`
   - `/roadmap-init`, `/roadmap-generate`, `/roadmap-validate`, `/roadmap-update`, `/roadmap-audit`, and `/roadmap-setup`
6. Mention that `/roadmap-sync <action>` remains a deprecated legacy CLI compatibility root, and `/road` plus `/road <action>` remain deprecated CLI compatibility aliases.

## Output contract

- Show what each command does in one sentence.
- Include namespaced slash examples plus CLI equivalents.
- Do not modify files or generate a roadmap from this command alone.
