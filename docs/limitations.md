# Limitations

RoadmapSmith is an evidence-based tool, not a mind-reader. This document is honest about what it cannot do.

## Evidence Detection

**Token matching is approximate.** The validator still uses task/file/token relationships to locate candidate code and tests. For an unchecked implementation task, those candidates are diagnostic only; they cannot mark the task complete without explicit `Evidence:` or a typed `Verify:` check.

**No semantic understanding.** The validator cannot distinguish between a real implementation, a stub that returns `null`, or a comment that mentions the feature name.

**`validate` is not yet an independent second opinion.** `validate` and `maintain` share the same
proximity inferencer, so they agree on their evaluations — including false positives. A production
audit of 0.9.33 found that 10 of 13 tasks reported as PASS by `validate` were false positives when
the cited files were read directly. A content-verification layer that checks file bodies (not just
file names) is planned as an independent module gated by `--strict-content`. See
[Phase 3](audit-remediation.md#phase-3----validate-independence-content-verification-layer)
in the remediation roadmap.

**Heuristic test matching is not behavioral proof.** A related test can help locate a candidate implementation, but UI/runtime behavior only auto-completes when its `Verify: kind=behavior` metadata matches the source, test, case, trigger, assertion, and a fresh configured test result.

## Confidence Levels

| Level | Meaning |
|-------|---------|
| `high` | Strong evidence breadth, such as code plus test |
| `medium` | One evidence type found |
| `low` | No evidence found — check is likely incorrect |

`minimumConfidence` filters visible validation results; it does not turn heuristic evidence into completion proof. Use `Verify:` or explicit `Evidence:` for an unchecked implementation task.

## File Coverage

**Generated outputs are not implementation evidence.** As of 0.9.35, generated-output directories are excluded at index time so they never enter the evidence pool. The excluded set covers: `dist-electron/`, `dist/`, `build/`, `out/`, `.next/`, `coverage/`, `.open-next/`, `.vercel/`, `.svelte-kit/`, `.parcel-cache/`, `.angular/`, `.expo/`, `.serverless/`, `.wrangler/`, `tmp/`. Additional directories can be added via `roadmap-skill.config.json`:

```json
{ "scan": { "excludeDirs": ["my-custom-build-dir"] } }
```

Per-pass guards in path-hint resolution, authoritative, and structural evidence arrays have not yet been centralized; contamination through those passes is significantly reduced but not eliminated. See [Phase 2](audit-remediation.md#phase-2----artifact-contamination-in-evidence-lists). A configured test report is read directly by its explicit path, not discovered as source evidence.

**Binary files are skipped.** Images, compiled assets, and other binaries are not inspected.

## Sync Behavior

**Sync is one-way.** The sync command reads repository state and updates ROADMAP.md. It does not create tasks or reorganize sections.

**`sync --audit` is read-only.** As of 0.9.35, `sync --audit` prints a mismatch report without writing to ROADMAP.md and exits with code 2 if mismatches are found. Plain `sync` (no flags) is still the destructive path. Use `--dry-run` to preview what a destructive sync would write.

**`sync` now reports what it changed.** After a destructive sync, the CLI prints how many tasks were newly unchecked or checked in that run, so a second consecutive sync no longer produces a misleading "0 problems" when the first run already un-checked everything.

**`mustBeStable` items are never auto-checked.** Milestone meta-declarations are explicitly excluded from automatic marking.

**Static checks have narrow syntax.** `contains`, `property`, and `endpoints` validate declared literals, values, and route coverage; they do not infer an arbitrary natural-language acceptance criterion. Use a behavioral verifier or explicit human `Evidence:` when the behavior cannot be declared deterministically.

## Escape Hatches for Non-Code Tasks

Some tasks will never have code evidence — documentation tasks, manual QA, accessibility reviews. As of 0.9.35, two marker flags in ROADMAP.md enable these tasks to be completed without triggering the strict evidence gate:

**`rs:kind=docs`** — for tasks whose completion is a documentation artifact (`.md` file):
```markdown
- [ ] Create ROADMAP.md <!-- rs:task=create-roadmap rs:kind=docs -->
```
The validator accepts a matching Markdown file as authoritative evidence. Test evidence is not required.

**`rs:verified-by=human`** — for tasks that require manual verification:
```markdown
- [ ] Verify accessibility with screen reader <!-- rs:task=verify-a11y rs:verified-by=human -->
  - Evidence: Manual VoiceOver pass on 2026-06-28 — all interactive elements announced correctly
```
The validator requires an `Evidence:` child line (free text). It passes with confidence `medium`. The `update` command accepts this without requiring code-level evidence resolution. Both flags appear in the `sync --audit` report under a separate `humanVerifiedTasks` bucket for reviewer visibility.

These flags live in the ROADMAP.md markers (not CLI flags), so they are durable, git-tracked, and code-reviewable.

## What RoadmapSmith Does Not Replace

- Code review
- Manual QA
- Security audits
- Business logic validation

It tracks evidence of implementation — not correctness of implementation.
