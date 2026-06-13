# Release Readiness

## Current Status

Published as the `roadmapsmith` npm package. Release readiness is tracked here for future package and workflow changes.

## Canonical Checklist

The canonical release checklist is maintained in [ROADMAP.md](../ROADMAP.md).
Use this document for context and command runbook notes only.

## Product Contract To Verify

- `roadmapsmith setup` creates the visible VS Code host UX and optional Claude hook wiring.
- `roadmapsmith zero` is the one-command empty-repo flow.
- `roadmapsmith maintain` is the one-command existing-repo flow.
- `roadmap-sync` remains an optional agent policy skill; skill install alone is not full product activation.

Release work is not ready until the docs, host UX, and changelog all reflect that contract consistently.

## Naming and Install Intent

- Primary end-user install path is the CLI: `npm install -g roadmapsmith`.
- The skill install command adds agent instructions only: `npx skills add PapiScholz/roadmapsmith --skill roadmap-sync`.
- The `roadmapsmith` CLI and the `roadmap-sync` skill are versioned and updated independently.
- `roadmapsmith setup` must be rerun when the generated VS Code task layer, launcher, wrappers, or Claude hook template changes.

## Release UX Gate

Before publishing:

1. Fresh install path is understandable:
   - `npm install -g roadmapsmith`
   - `roadmapsmith setup`
   - `roadmapsmith zero` in an empty repo
   - `roadmapsmith maintain` in a repo with code
2. VS Code task surface is visible:
   - `RoadmapSmith: Status`
   - `RoadmapSmith: Zero Mode`
   - `RoadmapSmith: Maintain`
3. Failure states are actionable:
   - CLI missing
   - Node runtime missing
   - skill-only install
   - invalid host config
   - `zero` in non-interactive mode
4. Existing `.vscode/tasks.json` and `.claude/settings.json` survive additive merge.
5. Changelog entry explains the user-visible changes, not just internal refactors.

## Verification Commands

```bash
cd roadmap-skill
npm ci
node --test test/*.test.js
node bin/cli.js --help
node bin/cli.js setup --project-root .. --dry-run
node bin/cli.js zero --project-root ..   # interactive terminal required
node bin/cli.js maintain --project-root ..
node bin/cli.js doctor --project-root .. --json
npm pack --dry-run
```

On this Windows machine, prefer the absolute Node executable when PATH resolution is unreliable:

```powershell
& 'C:\Program Files\nodejs\node.exe' --test roadmap-skill\test\*.test.js
```

## Release Notes Expectations

Before publish:

- `README.md` and `roadmap-skill/README.md` must recommend `setup`, `zero`, and `maintain` first.
- `skills.json`, `.claude-plugin/plugin.json`, and `skills/roadmap-sync/agents/openai.yaml` must describe the skill as policy/governance, not as the whole product.
- `roadmap-skill/CHANGELOG.md` must include the user-visible CLI, slash, VS Code, and runtime changes for the next version.
