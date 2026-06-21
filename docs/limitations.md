# Limitations

RoadmapSmith is an evidence-based tool, not a mind-reader. This document is honest about what it cannot do.

## Evidence Detection

**Token matching is approximate.** The validator still uses task/file/token relationships to locate candidate code and tests. For an unchecked implementation task, those candidates are diagnostic only; they cannot mark the task complete without explicit `Evidence:` or a typed `Verify:` check.

**No semantic understanding.** The validator cannot distinguish between a real implementation, a stub that returns `null`, or a comment that mentions the feature name.

**Heuristic test matching is not behavioral proof.** A related test can help locate a candidate implementation, but UI/runtime behavior only auto-completes when its `Verify: kind=behavior` metadata matches the source, test, case, trigger, assertion, and a fresh configured test result.

## Confidence Levels

| Level | Meaning |
|-------|---------|
| `high` | Strong evidence breadth, such as code plus test |
| `medium` | One evidence type found |
| `low` | No evidence found — check is likely incorrect |

`minimumConfidence` filters visible validation results; it does not turn heuristic evidence into completion proof. Use `Verify:` or explicit `Evidence:` for an unchecked implementation task.

## File Coverage

**Generated outputs are not implementation evidence.** `dist-electron/`, `dist/`, `build/`, `out/`, `.next/`, and `coverage/` are excluded from heuristic code/test matching. A configured test report is read directly by its explicit path, not discovered as source evidence.

**Binary files are skipped.** Images, compiled assets, and other binaries are not inspected.

## Sync Behavior

**Sync is one-way.** The sync command reads repository state and updates ROADMAP.md. It does not create tasks or reorganize sections.

**`mustBeStable` items are never auto-checked.** Milestone meta-declarations are explicitly excluded from automatic marking.

**Static checks have narrow syntax.** `contains`, `property`, and `endpoints` validate declared literals, values, and route coverage; they do not infer an arbitrary natural-language acceptance criterion. Use a behavioral verifier or explicit human `Evidence:` when the behavior cannot be declared deterministically.

## What RoadmapSmith Does Not Replace

- Code review
- Manual QA
- Security audits
- Business logic validation

It tracks evidence of implementation — not correctness of implementation.
