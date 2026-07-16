# RoadmapSmith CLI Contract

**Who this is for:** solo devs and small teams that run AI coding agents (Claude Code, Codex) at least a few hours a week and want an **auditable trail** of what the agent claims it shipped vs what actually landed in the code.

**When NOT to use:**

- You already have Jira / Linear / Asana as your source of truth — a third tracker creates drift.
- You don't use AI coding agents — a plain `TODO.md` covers 95% of the value with 5% of the overhead.
- Your repo is >2 languages or a large monorepo — the evidence scanner is optimized for single-primary-language repos.

This package owns the RoadmapSmith CLI, validator, sync engine, host setup files, and the shared command-surface contract consumed by the root bundle docs, `skills.json`, and both plugin manifests.

## Public Contract

### Canonical

- `roadmapsmith setup`
- `roadmapsmith zero`
- `roadmapsmith maintain [--dry-run]`
- `roadmapsmith status [--json]`
- `roadmapsmith validate [--json] [--strict]`
- `roadmapsmith update [--task <stable-id> --evidence "<single-line evidence>"]`
- `roadmapsmith update --add-task "<text>" [--json]` — append a new task. With `--json`, stdout emits `{ action, task: { id, text, phase }, file }` so the assigned ID can be chained into a follow-up `--evidence` call: `roadmapsmith update --add-task "X" --json | jq -r .task.id | xargs -I{} roadmapsmith update --task {} --evidence …`. The ID is a deterministic slug of the task text (v0.15.0+).

### Advanced

- `roadmapsmith init [--with-phase-templates] [--interactive]` — since v0.15.0, `init` scans the repo (JS/TS/Python) and emits real tasks (`Add tests for <fn> in <file>:<line>`, `Address TODO: …`). Empty repos get a minimal "Your first tasks" shape. `--with-phase-templates` restores the v0.14.x static template byte-for-byte. `--interactive` prompts for product name, primary user, whether AI agents are used daily, and target host(s).
- `roadmapsmith generate`
- `roadmapsmith generate --full-regen`
- `roadmapsmith sync`
- `roadmapsmith sync --audit`
- `roadmapsmith sync` as the advanced alias for `roadmapsmith update`
- `roadmapsmith update --concise` — suppress ⚠️ warning lines in the emitted markdown
- `roadmapsmith verify --task <id> [--run]` — execute the `rs:verified-by` command of an `rs:kind=command` task; with `--run`, flip the checkbox on exit 0

### Compatibility only

Legacy surfaces (`doctor`, `regenerate`, `/road`, `/roadmap-sync`, direct aliases) are documented separately in [../docs/legacy-commands.md](../docs/legacy-commands.md). They stay executable but print deprecation warnings and may be removed in a future major.

`status` is the public readiness command. `doctor` remains a compatibility alias to the same payload.

`update` is the public checklist-refresh and verified single-task completion family. `sync` remains executable as the advanced alias for the refresh path.

`generate --full-regen` is the only public destructive rebuild path. `regenerate` was documented as compatibility but was never routed through the CLI; use `generate --full-regen` instead.

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

Compatibility-only slash surfaces are documented in [../docs/legacy-commands.md](../docs/legacy-commands.md). Native-bundle readiness is computed from canonical surfaces only.

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
