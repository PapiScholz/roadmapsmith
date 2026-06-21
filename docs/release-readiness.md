# Release Readiness

Use this document for maintainer and release workflow checks.

## Contract Checks

Before release, verify that these surfaces agree:

- `README.md`
- `roadmap-skill/README.md`
- `docs/command-surfaces.md`
- `skills.json`
- `.codex-plugin/plugin.json`
- `.claude-plugin/plugin.json`
- `skills/roadmap-status`
- `skills/roadmap-sync`
- `skills/roadmap-update`
- `plugins/roadmapsmith/skills/...` mirrors

Required taxonomy:

- canonical: `setup`, `zero`, `maintain`, `status`, `validate`, `update`
- advanced: `init`, `generate`, `generate --full-regen`, `sync`, `sync --audit`
- compatibility: `doctor`, `regenerate`, `/road <action>`, `/roadmap-sync <action>`, deprecated direct aliases

## Validator And Audit Checks

Release only when all of the following are true:

- verification recipes are task-scoped and duplicate-generated recipes are suppressed
- generated outputs are excluded from heuristic evidence
- `scripts/` and auxiliary tooling paths are excluded from heuristic scoring unless explicitly referenced
- authored source files beat compiled siblings in heuristic evidence
- `validate --strict` is additive and does not change default `validate` semantics
- `sync --audit` is still documented as an advanced mutating summary, not an independent audit engine

## Host Readiness Checks

- `roadmapsmith status --json` is the public readiness command
- `roadmapsmith doctor --json` remains a compatibility alias
- `roadmapsmith status --json` and `doctor --json` expose the structured readiness summary fields: `workspaceReady`, `codexReady`, `claudeReady`, `canonicalSurfaceReady`, `advancedSurfaceWarnings`
- canonical readiness is computed from canonical native slash surfaces only
- duplicate legacy `/roadmap-sync` installs are warnings or findings, not canonical-surface failures
- missing advanced VS Code labels do not fail overall VS Code readiness

## Documentation Ownership

- `README.md`: onboarding, install, quick start, daily flow
- `roadmap-skill/README.md`: CLI and package contract
- `docs/release-readiness.md`: release workflow
- `docs/use-cases/sync-audit-mode.md`: maintain, sync, audit semantics
- `docs/use-cases/claude-code.md`: Claude install and hook behavior
- `docs/use-cases/codex-plugin.md`: Codex plugin workflow
- `docs/troubleshooting-host-setup.md`: runtime and host troubleshooting

This document absorbs the old release UX gate material. `docs/release-ux-gate.md` is intentionally removed.

## Validation Gates

Run before release:

```bash
npm test
npm run validate:qa-regression
npm run validate:functional-smoke
```

`main` remains PR-only. A successful protected-branch release flow should still go through the automated `release/vX.Y.Z` PR path before publish completes.

When public command contract changes land, update changelog entries in both `CHANGELOG.md` files in the same pass.
