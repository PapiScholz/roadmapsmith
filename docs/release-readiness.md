# Release Readiness

## Current Status

Published as the `roadmapsmith` npm package. Every successful push to `main` now advances toward a new patch release automatically, including docs-only merges, through a protected-branch-safe release PR flow.

## Canonical Checklist

The canonical release checklist is maintained in [ROADMAP.md](../ROADMAP.md).
Use this document for context and command runbook notes only.

## Product Contract To Verify

- `roadmapsmith setup` creates the visible VS Code host UX and optional Claude hook wiring.
- `roadmapsmith zero` is the one-command empty-repo flow.
- `roadmapsmith maintain` is the one-command existing-repo flow.
- `roadmapsmith update --task <id> --evidence <text>` is the verified high-confidence single-task completion flow.
- Native Codex plugin support comes from `.codex-plugin/plugin.json` plus the repo-local marketplace at `.agents/plugins/marketplace.json`.
- Native Claude GUI slash commands come from the full skill bundle: `/roadmap`, `/roadmap-zero`, `/roadmap-maintain`, `/roadmap-status`, `/roadmap-init`, `/roadmap-generate`, `/roadmap-validate`, `/roadmap-update`, `/roadmap-audit`, and `/roadmap-setup`.
- `roadmap-sync` is a deprecated legacy/namespaced compatibility skill; installing only that skill is not full product activation.
- Published npm/plugin artifacts must carry the same shared bundle files as the GitHub-source install path: `skills.json`, `skills/*`, `.codex-plugin/plugin.json`, `.claude-plugin/plugin.json`, and the Codex manifest assets they reference.

Release work is not ready until the docs, host UX, and changelog all reflect that contract consistently.

## Naming and Install Intent

- Primary end-user install path is the CLI: `npm install -g roadmapsmith`.
- Native Codex install/enable flows use the plugin directory and the repo-local marketplace surface; for this checkout, the repo-root verification path is `codex plugin marketplace add .`.
- Recommended Claude install path is the full bundle: `npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code`.
- Installing only `npx skills add PapiScholz/roadmapsmith --skill roadmap-sync` exposes only the legacy `/roadmap-sync` root.
- Patch versions advance on every successful push to `main`, regardless of whether the merged change was code, docs, or release-ops only.
- Because `main` is PR-only, the release workflow writes that version back through an automated `release/vX.Y.Z` PR that squashes into `main` as `chore(release): vX.Y.Z`.
- If GitHub blocks `GITHUB_TOKEN` from creating or merging PRs, the workflow must use a dedicated secret such as `RELEASE_BOT_TOKEN` with `repo` scope.
- `roadmapsmith status --json` must report `claudeGui`, `claudeCli`, `codexGui`, and `codexCli` separately from the VS Code task/hook layer. `doctor --json` remains a compatibility alias.
- If a legacy `~/.agents/skills/roadmap-sync` install coexists with the `roadmapsmith` Codex plugin, `doctor` should flag `/roadmap-sync` as a duplicate instead of silently calling the surface healthy.
- The published `roadmapsmith` package now mirrors the shared Codex and Claude bundle files for downstream plugin/distribution surfaces, but CLI install alone still does not auto-register either host surface.
- `roadmapsmith setup` must be rerun when the generated VS Code task layer, launcher, wrappers, or Claude hook template changes.
- Before any push from this repo, run the broad pre-push validation gate through two independent subagents:
  - `QA/Regression`: `npm run validate:qa-regression`
  - `Functional/Smoke`: `npm run validate:functional-smoke`
  - do not push until both results are reconciled back into the main workspace

## Release UX Gate

Before merging to `main`:

1. Fresh install path is understandable:
   - `npm install -g roadmapsmith`
   - from repo root: `codex plugin marketplace add .`
   - `npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code`
   - install/enable RoadmapSmith from the Codex plugin directory
   - `/reload-skills` and, if applicable, `/reload-plugins`
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
- global npm CLI shim cannot resolve Node from PATH, with the explicit PowerShell node-and-cli fallback documented
   - skill-only legacy install (`/roadmap-sync` root only)
   - invalid host config
   - `zero` in non-interactive mode
4. Existing `.vscode/tasks.json` and `.claude/settings.json` survive additive merge.
5. Commit subjects are ready for CI-managed changelog generation; versioned sections are no longer maintained by hand, and the protected-branch release PR is allowed to merge after checks pass.
6. Packed artifact is self-consistent:
   - `npm run verify-pack-surface`
   - extract the tarball and confirm `package/skills.json`, `package/.codex-plugin/plugin.json`, `package/.claude-plugin/plugin.json`, every manifest-listed `package/skills/<name>/SKILL.md`, and the Codex manifest assets exist
7. Native Codex plugin discovery works:
   - the repo-local marketplace exposes RoadmapSmith in Codex
   - the installed plugin resolves the shared `skills/` bundle
8. Pre-push validation is green before git transport:
   - one subagent owns `QA/Regression` and runs `npm run validate:qa-regression`
   - one subagent owns `Functional/Smoke` and runs `npm run validate:functional-smoke`
   - neither push nor publish proceeds while either gate is red or ambiguous

## Verification Commands

```bash
cd roadmap-skill
npm ci
npm run validate:qa-regression
npm run validate:functional-smoke
node bin/cli.js --help
codex plugin marketplace add ..
node bin/cli.js setup --project-root .. --dry-run
node bin/cli.js zero --project-root ..   # interactive terminal required
node bin/cli.js maintain --project-root ..
node bin/cli.js doctor --project-root .. --json
npm pack --json
```

On this Windows machine, prefer the absolute Node executable when PATH resolution is unreliable:

```powershell
& 'C:\Program Files\nodejs\node.exe' scripts\pre-push-gate.js qa-regression
& 'C:\Program Files\nodejs\node.exe' scripts\pre-push-gate.js functional-smoke
```

## Release Notes Expectations

Before merging to `main`:

- `README.md` and `roadmap-skill/README.md` must recommend `setup`, `zero`, and `maintain` first.
- `.codex-plugin/plugin.json`, `.claude-plugin/plugin.json`, and `skills.json` must stay aligned on shared metadata and the full bundle surface, while `skills/roadmap-sync/agents/openai.yaml` stays aligned on the policy/governance layer.
- The packed npm artifact must contain the same Codex and Claude bundle files advertised in those manifests.
- `roadmap-skill/CHANGELOG.md` must keep `## Unreleased` present with its empty placeholder so CI can generate the next `## vX.Y.Z - YYYY-MM-DD` section automatically when the automated release PR is prepared.
