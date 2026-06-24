# RoadmapSmith CLI Contract

This package owns the RoadmapSmith CLI, validator, sync engine, host setup files, and the shared command-surface contract consumed by the root bundle docs, `skills.json`, and both plugin manifests.

## Public Contract

### Canonical

- `roadmapsmith setup`
- `roadmapsmith zero`
- `roadmapsmith maintain [--dry-run]`
- `roadmapsmith status [--json]`
- `roadmapsmith validate [--json] [--strict]`
- `roadmapsmith update [--task <stable-id> --evidence "<single-line evidence>"]`

### Advanced

- `roadmapsmith init`
- `roadmapsmith generate`
- `roadmapsmith generate --full-regen`
- `roadmapsmith sync`
- `roadmapsmith sync --audit`
- `roadmapsmith sync` as the advanced alias for `roadmapsmith update`

### Compatibility only

- `roadmapsmith doctor`
- `roadmapsmith regenerate`
- `roadmapsmith /road <action>`
- `roadmapsmith /roadmap-sync <action>`
- deprecated direct aliases such as `/maintain` or `/status`

`status` is the public readiness command. `doctor` remains a compatibility alias to the same payload.

`update` is the public checklist-refresh and verified single-task completion family. `sync` remains executable as the advanced alias for the refresh path.

`generate --full-regen` is the only public destructive rebuild path. `regenerate` remains executable but prints a deprecation warning.

## Modes

### Zero Mode

Use for empty or low-context repositories. `roadmapsmith zero` runs the terminal interview when TTY is available, or consumes a complete brief from config plus flags in non-interactive environments.

Non-interactive inputs:

- `--product-name`
- `--primary-user`
- `--problem-statement`
- `--target-outcome`
- `--anti-goal` (repeatable)
- `--preferred-stack`
- `--constraint` (repeatable)
- `--done-criterion` (repeatable)

Without TTY, Zero Mode requires a complete brief from config/flags and fails clearly when required fields are missing.

### Sync/Audit Mode

Use for repositories that already contain code, tests, docs, TODOs, or an existing roadmap. `roadmapsmith maintain` is the preserve-first one-command flow for an existing managed roadmap block.

If `ROADMAP.md` is authored and non-empty but has no `<!-- rs:managed:* -->` block:

- `maintain` refuses to seed managed content implicitly
- `update` is the conservative inline-annotation path
- `generate` is the explicit managed-section creation path

For write-capable surfaces (`maintain`, `generate`, `sync`, `update`), prefer `--dry-run` first.

## Managed Block Ownership

- `maintain` owns the managed roadmap block only.
- `update` can annotate existing task lines even when no managed block exists.
- `generate` is the explicit path that creates or replaces managed roadmap content.
- Manually inserting empty `<!-- rs:managed:start -->` markers is no longer required as a workaround.

## Verification Model

RoadmapSmith separates candidate discovery from completion.

Candidate discovery may use:

- explicit path hints
- symbol matches
- code-token overlap
- task-path overlap
- test references

Unchecked implementation tasks complete only from:

- valid explicit `Evidence:`
- `Verify: kind=contains`
- `Verify: kind=property`
- `Verify: kind=endpoints`
- `Verify: kind=behavior` plus fresh configured test-report proof

Behavioral tasks without explicit proof remain warnings. When the engine can generate exactly one task-specific verification recipe, sync can render it as `Verification recipe:`. If the recipe is global, duplicated, off-domain, or otherwise non-specific, it is suppressed.

Generated outputs such as `dist-electron/`, `dist/`, `build/`, `out/`, `.next/`, and `coverage/` are excluded from heuristic evidence discovery.

Auxiliary tooling paths such as `scripts/` and `tools/` are excluded from heuristic scoring unless the task explicitly references them.

## Strict Validation

`roadmapsmith validate --strict` is the independent audit path.

In strict mode:

- candidate discovery still narrows where to look
- PASS may come only from explicit `Evidence:` or passing typed `Verify:`
- file existence, domain overlap, token proximity, and test-file presence alone never produce PASS
- preserved checked-state behavior is disabled

Recommended audit sequence:

```bash
roadmapsmith maintain
roadmapsmith validate --strict --json
```

`sync --audit` remains an advanced mutating summary, not an independent audit engine.

## Slash And Host Surfaces

Canonical native slash surfaces:

- `/roadmap`
- `/roadmap-zero`
- `/roadmap-maintain`
- `/roadmap-status`
- `/roadmap-validate`
- `/roadmap-update`
- `/roadmap-setup`

Advanced native slash surfaces:

- `/roadmap-init`
- `/roadmap-generate`
- `/roadmap-audit`

Compatibility-only slash surfaces:

- `/roadmap-sync <action>`
- `/road <action>`
- deprecated direct aliases

Native-bundle readiness is computed from canonical surfaces only. Missing advanced labels or duplicate legacy `/roadmap-sync` installs are warnings, not canonical-health failures.

## Host Setup

`roadmapsmith setup` generates:

- `.vscode/tasks.json`
- `.vscode/roadmapsmith-launcher.js`
- `.vscode/roadmapsmith-task.cmd`
- `.vscode/roadmapsmith-task.sh`
- optional Claude hook wiring

The internal hook filename remains `.claude/hooks/roadmap-sync.js`. It is a legacy internal filename, not a public command surface.

## Config

Typical config file:

```json
{
  "roadmapFile": "./ROADMAP.md",
  "agentsFile": "./AGENTS.md",
  "validation": {
    "minimumConfidence": "low",
    "recipeCommand": "npm test -- {testFile}",
    "testReports": [
      {
        "path": "test-results.json",
        "format": "vitest-json"
      }
    ]
  }
}
```

Key validation fields:

- `minimumConfidence`: output filter for validate/sync
- `recipeCommand`: optional command suffix for generated verification recipes
- `testReports`: configured behavioral proof sources

## Related Docs

- [../docs/command-surfaces.md](../docs/command-surfaces.md)
- [../docs/troubleshooting-host-setup.md](../docs/troubleshooting-host-setup.md)
- [../docs/use-cases/sync-audit-mode.md](../docs/use-cases/sync-audit-mode.md)
