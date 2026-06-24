# Sync And Audit Mode

Use this mode when the repository already contains code, tests, docs, TODOs, or an existing `ROADMAP.md`.

## Recommended Path

Daily maintenance:

```bash
roadmapsmith maintain --dry-run
roadmapsmith maintain
```

Authored roadmap with task markers but no managed block:

```bash
roadmapsmith update --dry-run
roadmapsmith update
```

Intentional managed-section creation in an authored roadmap:

```bash
roadmapsmith generate --dry-run
roadmapsmith generate
```

Independent audit:

```bash
roadmapsmith maintain
roadmapsmith validate --strict --json
```

## Semantics

- `maintain`: preserve-first flow that runs generation, sync, and audit output together, but only for an existing managed block
- `sync`: advanced mutating checklist refresh
- `sync --audit`: advanced mutating summary after sync
- `validate`: default validation view with compatibility-preserving semantics
- `validate --strict`: first independent audit path

If `ROADMAP.md` is non-empty and lacks `<!-- rs:managed:start -->`, `maintain` fails fast instead of appending generated boilerplate. Use `update` for conservative inline annotations or `generate` to seed the managed section explicitly.

`validate --strict` may still use the inferencer to discover candidates, but PASS is limited to explicit `Evidence:` or passing typed `Verify:`.

## Verification Recipes

RoadmapSmith may emit `Verification recipe:` only for pending behavioral work when it can derive exactly one task-specific recipe from the task's own candidate evidence pool.

Recipes are suppressed when:

- the candidate file is not already part of that task's evidence pool
- the file path does not share a non-generic domain token with the task
- the matched pattern or immediate context does not share a non-generic task token
- more than one viable candidate exists
- the same recipe would be emitted for multiple tasks
- the task already contains explicit `Verify:` or `Evidence:`

## Evidence Hygiene

- generated outputs are excluded from heuristic evidence
- `scripts/` and auxiliary tooling paths are excluded from heuristic scoring unless explicitly referenced
- compiled/authored siblings are deduplicated in favor of the authored source file

This document absorbs the old CI audit write-up. `docs/use-cases/ci-audit.md` is intentionally removed.
