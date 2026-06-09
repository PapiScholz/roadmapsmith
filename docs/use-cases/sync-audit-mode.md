# Use Case: Sync/Audit Mode

## Who uses it

Developers and AI coding agents working on a repository that already has:
- Source code, modules, or CLI commands
- Tests or a detected test framework
- Docs, TODOs, FIXME markers
- An existing ROADMAP.md (even a partial one)

## When to use it

Use Sync/Audit Mode when:

- The repository has meaningful implementation files
- You want to track task completion against real code evidence
- An agent just finished work and you want to validate what actually changed
- You are resuming a multi-session workflow and need ground truth on progress

Do not use Sync/Audit Mode for an empty repository with no implementation context. Use Zero Mode instead.

## How it works

RoadmapSmith scans the repository and compares the declared task state (`[x]`) in `ROADMAP.md` against evidence found in the codebase. It does not trust the agent's self-reported completion — it requires traceable proof.

### Evidence types checked

- **File paths** — backtick-quoted paths mentioned in the task text
- **Symbol names** — identifiers referenced in the task description
- **Code token matching** — keyword frequency across source files
- **Test file matching** — test files referencing task-relevant terms
- **Artifact presence** — README, CHANGELOG, `docs/`, `dist/` entries

A task passes only when accumulated evidence exceeds the configured threshold.

## Workflow

```bash
# Rebuild the managed roadmap block from current repository context
roadmapsmith generate --project-root .

# Inspect evidence status per task (returns JSON with per-task results)
roadmapsmith validate --json

# Apply validation outcomes — mark [x] where evidence exists, warn where it does not
roadmapsmith sync

# Print a mismatch summary after sync
roadmapsmith sync --audit
```

Each command is independent. Agents typically run `sync` after completing work. Today `sync --audit` should be treated as a mutating sync plus summary, not as a dedicated read-only audit gate.

## Why it prevents hallucinated progress

An AI agent that marks a task `[x]` without calling `sync` is making an assertion without evidence. RoadmapSmith treats that as unvalidated state.

When `sync` runs:
- Tasks with passing evidence are marked `[x]`
- Tasks without evidence emit `⚠️ attempted but validation failed: <reason>` in the roadmap
- `--audit` surfaces tasks that claim completion but have no evidence, and tasks that have evidence but are still unchecked

This means a PR reviewer can run `sync --audit` and see a factual mismatch report — not just the agent's word.

## Guardrails enforced

- Tasks are never marked complete without repository evidence
- Test evidence is required for code tasks when a test framework is detected
- The managed block (`<!-- rs:managed:start/end -->`) is the only content modified — unmanaged sections are preserved
- Task IDs (`<!-- rs:task=<slug> -->`) are stable across regenerations — no phantom completions from ID churn
- Output is deterministic: same repository state always produces the same roadmap structure

## Dry run and audit flags

```bash
# Preview what sync would change without writing
roadmapsmith sync --dry-run

# Print mismatch report after running sync
roadmapsmith sync --audit
```

Use `--dry-run` before applying changes. Use `validate --json` when you need a read-only evidence inspection. Use `--audit` when you want the current post-sync summary.
