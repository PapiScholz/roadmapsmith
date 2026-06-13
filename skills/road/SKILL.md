---
name: road
description: Show the RoadmapSmith Claude GUI command palette without side effects.
---

# RoadmapSmith Palette

Use this command as the native Claude GUI discovery entrypoint for RoadmapSmith.

## Required behavior

1. Treat `/road` as a no-side-effects palette. Do not run mutating commands from this skill.
2. If the `roadmapsmith` CLI is available, you may run `roadmapsmith /road` from the project root and use that output directly.
3. If the CLI is missing, provide the palette manually and explain the installation path:
   - `npm install -g roadmapsmith`
   - `npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code`
   - run `/reload-skills`
   - if RoadmapSmith was installed as a Claude plugin, also run `/reload-plugins`
4. Explain the preferred native Claude GUI entrypoints:
   - `/zero` for empty or low-context repositories
   - `/maintain` for existing repositories
   - `/status` for readiness checks
   - `/init`, `/generate`, `/validate`, `/sync`, `/audit`, and `/setup` for advanced/manual control
5. Mention that `/roadmap-sync` remains valid as the legacy/namespaced RoadmapSmith skill.

## Output contract

- Show what each command does in one sentence.
- Include both native Claude examples and CLI equivalents.
- Do not modify files or generate a roadmap from this command alone.
