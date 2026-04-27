# Limitations

RoadmapSmith is an evidence-based tool, not a mind-reader. This document is honest about what it cannot do.

## Evidence Detection

**Token matching is approximate.** The validator tokenizes task text and searches for those tokens in your source files. A task named "Implement billing module" matches any file containing "billing" — it does not verify the implementation is correct or complete.

**No semantic understanding.** The validator cannot distinguish between a real implementation, a stub that returns `null`, or a comment that mentions the feature name.

**Test evidence uses OR logic.** A test file matches if it contains *any* meaningful token from the task text. A single shared token (like a module name) can produce a false positive.

## Confidence Levels

| Level | Meaning |
|-------|---------|
| `high` | Two or more evidence types found (code + test, etc.) |
| `medium` | One evidence type found |
| `low` | No evidence found — check is likely incorrect |

Use `minimumConfidence: "high"` in config to require both code and test evidence before sync marks a task complete.

## File Coverage

**Only files in your repository are indexed.** Generated files, build artifacts outside `dist/`, and `.gitignore`-excluded files are not visible to the validator.

**Binary files are skipped.** Images, compiled assets, and other binaries are not inspected.

## Sync Behavior

**Sync is one-way.** The sync command reads repository state and updates ROADMAP.md. It does not create tasks or reorganize sections.

**`mustBeStable` items are never auto-checked.** Milestone meta-declarations are explicitly excluded from automatic marking.

## What RoadmapSmith Does Not Replace

- Code review
- Manual QA
- Security audits
- Business logic validation

It tracks evidence of implementation — not correctness of implementation.
