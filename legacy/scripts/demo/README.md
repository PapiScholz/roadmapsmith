# Dogfood demo: what does ROADMAP.md actually change for claude-code?

This directory scripts an A/B run of `claude-code` against two identical
worktrees of roadmapsmith. Session A can see `ROADMAP.md`; Session B can't.
The driver measures each session's evidence trail, audit result, test result,
and files touched.

## Requirements

- `claude` CLI on PATH (`claude --version` works)
- bash + git (Git Bash on Windows is fine)
- `cd roadmap-skill && npm install` run at least once

## Run

```bash
bash scripts/demo/run.sh
```

Output lands in `scripts/demo/out-<timestamp>/`:

- `transcript-with-roadmap.txt`
- `transcript-without-roadmap.txt`
- `summary.md`

## What to look for

Session A produces a diff against `ROADMAP.md`:

- 3 tasks flipped `[ ] → [x]`
- Each with `Evidence:` sub-bullets pointing at real files
- Audit ends `0 checked-without-evidence, 0 ready-but-unchecked`

Session B produces code diffs but no roadmap trail. The audit line is
unchanged from baseline — you cannot ask "what did claude close in this
session?" and get a straight answer.

That is the value roadmapsmith adds: not smarter code, but an **auditable
trail** of what an AI agent claimed to do and evidence to back it.

## Honest caveats

- Claude sessions are non-deterministic. Two runs of the same prompt can
  differ. Run the driver 3 times and look at the range.
- Session B may produce excellent code that Session A missed. The demo does
  NOT claim ROADMAP.md makes claude better at writing code.
- The claim is narrower and defensible: **ROADMAP.md makes claude's output
  auditable**. Session A leaves a validated evidence log; Session B does not.
- If your first run has Session A failing to close 3 tasks, that is real
  data — either the tool needs work or the prompt needs tightening. Do not
  hide it.

## Cost

Each run is roughly 2 × (small autonomous claude-code session). Budget a few
dollars per run at current claude-opus pricing.

## Empirical results (2026-07-12)

First real run of this demo against roadmapsmith itself. Both sessions worked
on the same worktree base at commit `de08fd4` (v0.12.0).

| Metric | Session A (with ROADMAP.md) | Session B (without) |
|--------|-----------------------------|---------------------|
| Tasks flipped `[ ]→[x]` | **4** | 0 |
| `Evidence:` bullets added | 8 | 0 |
| Audit result | `0 checked-without-evidence, 0 ready-but-unchecked` | `Ready but unchecked: [P0 release, P1 changelog, ...]` |
| Tests state | 264 pass (+9 new) / 1 skip / 0 fail | 278 pass (+24 new) / 0 skip / 1 fail (pre-existing WIP) |
| Files touched | 10 (aligned with planned work) | 7 (unrelated improvements) |
| Approximate cost | ~$18 | ~$15 |

**Session A did**: bumped `roadmap-skill/package.json` → 0.12.1, ran
`sync-bundle-metadata`, wrote `docs/rs-kind-rollup.md`, added a CHANGELOG
entry, exported renderer helpers + wrote 9 unit tests. All 4 tasks closed
with `Evidence:` bullets pointing at real files. Audit passed via
legitimate validation — no escape hatch.

**Session B did**: fixed a regex bug in `src/addTask.js` (`PHASE_LABEL_RE`),
added 10 tests for `parseArgv`, added 13 tests for the `match` module. Its
transcript explicitly noted it saw the WIP files under
`src/renderer/professional.js` and `src/validator/index.js` and **chose to
skip them** — no way to know they were intentional in-progress work.

**Interpretation**: Both sessions produced valuable code. The difference is
not quality — it is **trackability**. Session A's output is auditable end
to end; you can ask "what did claude close in this session?" and get a
concrete answer with links to files. Session B's output is a plain code
diff with no trail. That is the value roadmapsmith adds.

**Coordination cost the demo also surfaced**: Session B declined to touch
WIP files because it lacked context. Session A, which had ROADMAP.md as
context, closed exactly the planned work (`release-0-12-1`,
`doc-rs-kind-rollup`, `changelog-0-12-1`, `test-taskline-helpers`).
