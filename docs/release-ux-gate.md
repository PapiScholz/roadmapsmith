# Release UX Gate

Use this document before merging a change that will publish the next `roadmapsmith` version.

The goal is simple: a new user must understand how to start, recover from common failures, and avoid damaging existing workspace config.

Every successful push to `main` now prepares a new patch release automatically, including docs-only merges, by opening or refreshing an automated `release/vX.Y.Z` PR. When that PR passes checks it merges back into `main`, and the follow-up `main` run publishes npm plus the GitHub Release in repair mode.

## Required User Contract

The public entrypoints must stay consistent across CLI help, VS Code tasks, launcher output, README text, and release notes:

- `roadmapsmith setup`
- `roadmapsmith zero`
- `roadmapsmith maintain`
- `roadmapsmith update --task <id> --evidence <text>`
- `roadmapsmith /roadmap`
- Native Codex plugin install/discovery via `.codex-plugin/plugin.json` and `.agents/plugins/marketplace.json`
- Native Claude GUI slash commands: `/roadmap`, `/roadmap-zero`, `/roadmap-maintain`, `/roadmap-status`, `/roadmap-init`, `/roadmap-generate`, `/roadmap-validate`, `/roadmap-update`, `/roadmap-audit`, `/roadmap-setup`

The skill bundle remains a GUI/policy layer distinct from the CLI:

- from repo root: `codex plugin marketplace add .`
- `npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code`
- `npx skills add PapiScholz/roadmapsmith --skill roadmap-sync` is a deprecated compatibility path

Skill installation alone must never be described as full activation of the product.

## Pass Criteria

### 1. Fresh install, empty repo

Expected flow:

```bash
npm install -g roadmapsmith
roadmapsmith setup
roadmapsmith zero
```

Pass when:

- The user understands that `zero` is the first command for an empty repository.
- The terminal interview is clear and finite.
- `ROADMAP.md` and `AGENTS.md` are created when missing.
- The generated roadmap reflects the answers given in the interview.

### 2. Fresh install, existing repo

Expected flow:

```bash
npm install -g roadmapsmith
roadmapsmith setup
roadmapsmith maintain
```

Pass when:

- The user understands that `maintain` is the default existing-repo flow.
- The command updates the roadmap and prints the mismatch summary.
- The user is not forced to know `generate`, `sync`, and `audit` up front.

### 3. VS Code discoverability

Pass when `Tasks: Run Task` shows at least:

- `RoadmapSmith: Status`
- `RoadmapSmith: Zero Mode`
- `RoadmapSmith: Maintain`

And when `RoadmapSmith: Status` explains:

- CLI ready or missing
- Node runtime ready or missing
- tasks/config ready or missing
- skill install alone does not expose CLI behavior

Pass when Codex plugin discovery shows at least:

- the repo-local marketplace named `RoadmapSmith Local Plugins`
- a `roadmapsmith` plugin entry that installs from the repo-local Codex plugin mirror
- a resolved shared `skills/` bundle after install

Pass when Claude GUI slash discovery shows at least:

- `/roadmap`
- `/roadmap-zero`
- `/roadmap-maintain`
- `/roadmap-status`
- `/roadmap-init`
- `/roadmap-generate`
- `/roadmap-validate`
- `/roadmap-update`
- `/roadmap-audit`
- `/roadmap-setup`

### 4. Failure clarity

These cases must be tested:

- CLI missing
- Node runtime missing
- invalid `.vscode/tasks.json`
- invalid `.claude/settings.json`
- `roadmapsmith zero` in non-interactive mode
- user installed only the skill
- user installed only the legacy `roadmap-sync` skill
- global npm CLI shim cannot resolve `node`, with the documented explicit PowerShell fallback

Pass when each case tells the user:

- what is missing
- why the command cannot continue
- how to recover
- what command to run next

### 5. Config safety

Pass when:

- unrelated VS Code tasks are preserved
- unrelated Claude hooks/settings are preserved
- invalid host config causes a hard failure
- invalid host config leaves no partial writes behind
- `roadmapsmith status --json` separates `claudeGui`, `claudeCli`, `codexGui`, and `codexCli` (`doctor --json` remains a compatibility alias)
- `roadmapsmith status --json` reports `/roadmap-sync` as duplicated when a legacy `~/.agents/skills/roadmap-sync` install coexists with the Codex plugin

### 6. Docs and release notes

Pass when:

- `README.md` recommends `setup`, `zero`, and `maintain` first
- `roadmap-skill/README.md` matches the same contract
- Codex docs explain that native plugin install/enable is separate from the VS Code task fallback
- Claude docs explain that native GUI slash commands come from the installed skill bundle, not from the CLI slash router alone
- `docs/release-readiness.md` matches the actual release workflow
- `roadmap-skill/CHANGELOG.md` keeps the CI-managed `## Unreleased` placeholder intact so the workflow can generate the next version section
- the repo documents the dual pre-push subagent gate and the same command surfaces used by CI

## Evidence To Capture

For each release candidate, capture:

- terminal transcript or screenshots of the empty-repo flow
- terminal transcript or screenshots of the existing-repo flow
- screenshot of the VS Code task list
- screenshot or log of Codex plugin marketplace discovery/install
- screenshot or log of the friendly Node-runtime failure message
- result of the package test suite
- separate outputs for the `QA/Regression` and `Functional/Smoke` subagent gates

## Recommended Verification Commands

```bash
cd roadmap-skill
npm ci
npm run validate:qa-regression
npm run validate:functional-smoke
codex plugin marketplace add ..
node bin/cli.js --help
node bin/cli.js setup --project-root .. --dry-run
node bin/cli.js maintain --project-root ..
node bin/cli.js doctor --project-root .. --json
```

On Windows, use the absolute Node path when PATH resolution is unreliable:

```powershell
& 'C:\Program Files\nodejs\node.exe' scripts\pre-push-gate.js qa-regression
& 'C:\Program Files\nodejs\node.exe' scripts\pre-push-gate.js functional-smoke
```
