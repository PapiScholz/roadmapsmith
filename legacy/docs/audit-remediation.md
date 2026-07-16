# Audit Remediation Roadmap — post-0.9.33

This document tracks the staged remediation plan derived from a production audit of RoadmapSmith
0.9.33 against a real repository (Electron + Next.js + Prisma, ~80 tasks in ROADMAP.md). It lives
here so progress can be tracked across releases without losing the technical analysis.

---

## Audit summary

### What works well in 0.9.33

- **`maintain`** — conservative contract is solid. Zero false positives observed. Pending tasks
  receive `⚠️` annotations with traceable file references rather than invented checkmarks.
- **`validate` WARN:STALE_EVIDENCE** — correctly fires when a historical annotation contradicts
  what the inferencer sees today. A concrete improvement over 0.9.28 where validate silently
  confirmed false positives without resistance.
- **`update` validation gate** — the most important addition in this version. Rejects supplied
  evidence that cannot be verified at high confidence in the repository. The tool refuses to write
  blindly what a human asserts.
- **`generate --dry-run`** — correctly rejects without `--full-regen` when a managed block exists.
- **`sync --dry-run`** — returns "No changes" when appropriate.

### Six findings

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| F0 | `doctor`/`status` exit 1 with no remediation hint after 0.9.33 upgrade | Breaking/Urgent | [ ] Fase 0 |
| F1a | `WARN:STALE_EVIDENCE` resolution path undocumented | Doc gap | [ ] Fase 1 |
| F1b | `validate --json \| command` fails on Windows | Platform gap | [ ] Fase 1 |
| F2 | Build artifacts (`dist-electron/` etc.) still appear in evidence lists | Evidence noise | [x] Parcialmente resuelto en 0.9.35 |
| F3 | `validate` shares the same inferencer as `maintain` — not an independent second opinion | Structural gap | [ ] Fase 3 |

### Additional findings resolved in 0.9.35

| # | Finding | Resolved |
|---|---------|----------|
| F4 | `sync --audit` was destructive (un-checked tasks) despite sounding read-only | [x] 0.9.35 |
| F5 | No escape hatch for doc/human-verification tasks in `update` gate | [x] 0.9.35 |
| F6 | Second `sync` reported "0 problems" after first run un-checked everything (no diff) | [x] 0.9.35 |
| F7 | No user-configurable exclude dirs for scanner | [x] 0.9.35 |

---

## Phase 0 — Breaking change in `doctor`/`status` (URGENT)

**Status:** `[ ]` pending

### Root cause

0.9.33 added `RoadmapSmith: Update` to `ROADMAPSMITH_CANONICAL_TASK_LABELS`
([host.js:28](../roadmap-skill/src/host.js)). Any installation that did not run `setup` after
upgrading is missing that task in `.vscode/tasks.json`. The consequence: `doctor` and `status`
return exit 1 with:

```
[fail] VS Code tasks incomplete: missing RoadmapSmith: Update
```

([cli.js:636](../roadmap-skill/bin/cli.js)) with no indication of what to do. The user sees FAIL on
a perfectly valid installation that simply has not been updated yet.

The hint text already exists for the Codex surface at
[host.js:1330](../roadmap-skill/src/host.js):
`'Run roadmapsmith setup to regenerate the VS Code task surface'`.

### Planned fix

In `cli.js:636`, after the `logError(...)` for the missing labels, emit a second line:

```
[fix] Run `roadmapsmith setup` to apply the latest task configuration (new task added in 0.9.33).
```

Keep `ok = false` and exit 1 — the installation genuinely needs an action — but the message is now
actionable. Do not degrade to a warning: a missing canonical task is an incomplete state.

### Planned tests

In `test/cli.test.js`: extend the `status`/`doctor` test case with a `.vscode/tasks.json` missing
the Update label, and assert that stdout includes `roadmapsmith setup`.

---

## Phase 1 — Documentation: WARN:STALE_EVIDENCE and Windows pipe (cheap)

**Status:** `[ ]` pending

### 1a. WARN:STALE_EVIDENCE resolution path

The warning is emitted in
[validator/index.js:1834](../roadmap-skill/src/validator/index.js)
when a historical `⚠️` annotation contradicts fresh repository evidence. No resolution path is
documented anywhere.

**How the warning resolves (analysis):**

The flag `staleEvidenceResolved` ([validator/index.js:2080](../roadmap-skill/src/validator/index.js))
is set to `true` when: the task is not checked AND it passes AND it was NOT confirmed by authoritative
evidence AND deterministic verification passed OR high-confidence code+test evidence exists AND no
negative signals or unique reasons remain. When `staleEvidenceResolved` is `true`, sync writes a
`Evidence:` discovery line and removes the stale annotation.

**Resolution paths for the user:**

1. Run `roadmapsmith maintain`. If the fresh evidence is strong enough (deterministic verifier or
   high-confidence code+test match with no negative signals), maintain clears the annotation and
   writes a confirmed `Evidence:` line.
2. If maintain does not clear it, the evidence is not strong enough to auto-resolve. Add an explicit
   `Evidence:` line manually pointing to the files that implement the task, then run `maintain`
   again.
3. If the annotation is known to be a historical artifact with no resolution needed, delete the
   `⚠️` line manually from ROADMAP.md.

**Planned deliverable:** Add a "Resolving WARN:STALE_EVIDENCE" section to
`skills/roadmap-validate/SKILL.md` and its mirror in
`plugins/roadmapsmith/skills/roadmap-validate/SKILL.md` describing the three paths above.

### 1b. `validate --json | command` fails on Windows

`validate --json` writes JSON to stdout ([cli.js:551](../roadmap-skill/bin/cli.js)). The audit
failure was from a consumer that reads `/dev/stdin`, which on Windows resolves to
`C:\dev\stdin` (nonexistent). This is not a bug in RoadmapSmith, but it should be documented and a
Windows-friendly escape should exist.

**Workaround (now):** Redirect to a file: `roadmapsmith validate --json > out.json`.

**Planned fix:** Add a `--out <file>` flag to `validate` that writes JSON to a file instead of
stdout, sidestepping the pipe issue entirely. Implement alongside the output block at
`cli.js:549-551`. Add a note to the skill and `--help` output documenting the limitation.

---

## Phase 2 — Artifact contamination in evidence lists

**Status:** `[x]` Partially resolved in 0.9.35 — remaining work noted below

### Root cause (confirmed)

`dist-electron/` and other build outputs are declared in `GENERATED_OUTPUT_PREFIXES`
([validator/index.js:16](../roadmap-skill/src/validator/index.js)) and each matching pass contains
`if (file.generatedOutput) continue;`. However, the guard is re-implemented per-pass and **not all
passes apply it**. The `evidence` object assembled at
[validator/index.js:1889](../roadmap-skill/src/validator/index.js)
holds ~8 file arrays:

| Array | Guard applied? |
|-------|---------------|
| `codeFiles` (via `findCodeEvidence`) | Yes |
| `testFiles` (via `findTestEvidence`) | Yes |
| `weakPathFiles` | Yes |
| `files` (via `findFilesByPathHints` / pathHintResolver) | **No** |
| `authoritativeFiles` (via `applyAuthoritativeEvidence` matchedPaths) | **No** |
| `structuralFiles` (via `checkNamespaceStructuralEvidence`) | **Not verified** |

Additionally, `artifactPatterns` ([validator/index.js:997](../roadmap-skill/src/validator/index.js))
lists `dist/` and `build/` but **not** `dist-electron/`, `.next/`, or `coverage/`, making it
inconsistent with `GENERATED_OUTPUT_PREFIXES`.

The result: build artifact paths leak into evidence display (the `⚠️` annotation and
`discoveredEvidence` lines), adding noise and potentially contributing to false proximity scores.

### Planned fix

1. Add a helper `stripNonEvidencePaths(paths, fileIndex)` that drops any path whose indexed file has
   `generatedOutput === true`.
2. Apply it to **all** arrays in the `evidence` object immediately after construction at
   ~[validator/index.js:1908](../roadmap-skill/src/validator/index.js), so no future pass can
   reintroduce generated paths. Recalculate the boolean flags `code`/`test`/`artifact` from the
   cleaned arrays so they cannot be `true` with an empty file list.
3. Complete `artifactPatterns` to match `GENERATED_OUTPUT_PREFIXES` for consistency
   (already gated by the `generatedOutput` flag in the main index scan, but the pattern list is a
   second read path).

### What was fixed in 0.9.35

- `readFileIndex` now **skips** generated-output paths at index time (instead of tagging them and relying on inconsistent per-pass guards). This closes the main contamination path.
- `GENERATED_OUTPUT_PREFIXES` expanded to include `.open-next/`, `.vercel/`, `.svelte-kit/`, `.parcel-cache/`, `.angular/`, `.expo/`, `.serverless/`, `.wrangler/`, `.tmp/`, `tmp/`.
- `io.js` `DEFAULT_IGNORED_DIRS` expanded to match.
- `artifactPatterns` (doc-task path) now includes all entries from `GENERATED_OUTPUT_PREFIXES`.
- New `config.scan.excludeDirs` field lets users add project-specific directories via `roadmap-skill.config.json`.

### Remaining work

The per-pass guards in `files`, `authoritativeFiles`, `structuralFiles` arrays were not yet centralized into a single `stripNonEvidencePaths` helper. The index-time skip (above) is the primary fix; the helper centralization and the fixture-based test remain for a future patch.

### Planned tests

A fixture with a `dist-electron/main.js` whose filename matches tokens of a task; assert that after
`validateTask`, none of the `evidence` keys (including `files`, `authoritativeFiles`,
`structuralFiles`) contain generated paths, and that `buildDiscoveredEvidenceLine` returns `null` or
a path that does not include `dist-electron/`. The existing `test/fixtures/electron-pos/` is the
right base.

---

## Phase 3 — `validate` independence: content verification layer

**Status:** `[ ]` pending (multi-sub-step; each shippable)

### Root cause (structural gap)

`validate` and `maintain` run the same proximity inferencer
([validator/index.js](../roadmap-skill/src/validator/index.js)): it scores semantic closeness of
file names to the task domain, not file content or test behavior. As a result, the two commands
agree on their evaluations — including false positives. The audit manually reviewed 13 items that
`validate` reported as PASS in prior sessions; 10 were confirmed false positives after reading the
actual test files. The inferencer is evaluating semantic proximity of file names, not behavioral
evidence.

`WARN:STALE_EVIDENCE` helps when a prior incorrect annotation exists to contradict, but does not
help on a first pass where the inferencer produces a fresh (incorrect) evaluation with no historical
annotation to challenge it.

Real independence requires a content-verification layer that reads the files the inferencer cited and
confirms the claimed evidence actually exists inside them.

### Design

New module `src/validator/contentVerifier.js` — a separate layer that does **not** touch the
proximity inferencer:

- **Input:** a task + the file paths the inferencer cited as evidence.
- **Verification:** for each cited file, confirm that the symbols/tokens from the task text appear
  in the file body (reuse `tokenize` from `src/utils.js` and `extractSymbolHints` already in the
  validator); for test files, confirm that an import reference to the unit under test exists (the
  import-matching machinery is already in `referencedPathMatches` / `findTestEvidence`).
- **Output:** an independent verdict `{ verified: bool, checkedFiles, unverifiedFiles, reason }`,
  reported **alongside** the proximity result, not replacing it.
- **Flag-gated:** new CLI flag `--strict-content` (or `validation.contentVerification: true` in
  config). Without the flag, behavior is identical to today — zero regression. With the flag, a task
  that the inferencer marks PASS but whose evidence files do not confirm the token/symbol content
  emits `WARN:UNVERIFIED_EVIDENCE` and does not count as `passed` under `--strict`.

### Precedence (from design history)

`validate --strict` with content-verification must stabilize before integrating it into the
self-audit of `maintain`. The order is: independent `validate` first, then `maintain` can consume
the layer. Do not skip this gate.

### Sub-steps (each independently mergeable)

| Step | Deliverable | Depends on |
|------|-------------|-----------|
| 3a | Spec + meta-tests for the content-verifier contract; fixtures from real audit false positives | — |
| 3b | `contentVerifier.js` implementation behind `--strict-content`, reporting only (no gating) | 3a |
| 3c | Wire verifier verdict to exit-code under `--strict`; emit `WARN:UNVERIFIED_EVIDENCE` diagnostic | 3b |
| 3d | Optional: integrate content-verifier into `maintain` self-audit once 3c is stable | 3c |

### Success criterion

The set of false-positive fixtures from the audit (tasks that the inferencer marks PASS but whose
cited files do not contain the relevant symbols/behavior) must emit `WARN:UNVERIFIED_EVIDENCE` with
`--strict-content`. Without the flag, they must still emit PASS (backward-compatibility).

---

## Namespace structural gate — configuring `namespacePatterns`

**Status:** available since v0.14.0

The validator can require, for a given task-ID namespace prefix (e.g. `cls-*`,
`evh2-*`), that at least one file in the repository match a structural pattern
before the task is allowed to pass on token overlap alone. This prevents generic
vocabulary matches in unrelated infrastructure files from validating a feature
that has no dedicated implementation directory.

### When to configure it

Configure `namespacePatterns` if **all** apply:

1. You use ID namespace prefixes (`myfeat-1`, `myfeat-2`, …) to group tasks
   that must land in a specific directory or set of files.
2. False positives from token overlap in unrelated files are a real problem.
3. You are willing to maintain the regex map when directory layout changes.

**If you do not use ID prefixes for structural grouping — leave `namespacePatterns`
empty (the default). The gate is skipped entirely.**

### Schema

```json
{
  "namespacePatterns": {
    "myfeat":  "(?:^|[/\\\\])features[/\\\\]",
    "auth":    "auth[/\\\\]|[/\\\\]auth\\.[jt]sx?$",
    "billing": "billing[/\\\\]|stripe|paypal"
  }
}
```

- Keys are ID namespace prefixes (the token before the first `-` in a task ID).
- Values are regex strings. They are compiled with the `i` (case-insensitive)
  flag and matched against normalized file paths (both `/` and `\` separators
  are supported by the `[/\\\\]` character class shown above).
- Invalid regex strings **throw at config load time** with a pointer to the
  offending entry — fail-loud, not silent skip.

### Migration from v0.13.x

Before v0.14.0, the validator carried a hardcoded map for 7 prefixes specific
to the maintainer's own repository (`cls`, `dsg`, `evh2`, `cst`, `uxf`, `cfgo`,
`doc3`). If you inherited those prefixes and relied on the gate:

```json
{
  "namespacePatterns": {
    "cls":  "classif(?:ier|y)|archetype",
    "dsg":  "generator[/\\\\](?:domain|web|landing|profiles?)|(?:domain|web|landing)[/\\\\](?:profile|generator)",
    "evh2": "[/\\\\]validator[/\\\\]",
    "cst":  "smoke|integration[-_]test|e2e",
    "uxf":  "[/\\\\]renderer[/\\\\]|renderer\\.[jt]sx?$",
    "cfgo": "config[/\\\\]|schema[/\\\\]|config\\.[jt]s$|schema\\.[jt]s$",
    "doc3": "(?:^|[/\\\\])docs[/\\\\]|readme\\.md$"
  }
}
```

Otherwise, do nothing — the empty default is the new correct baseline for
every repository except the maintainer's own.

## Cross-reference

- Known limitations: [docs/limitations.md](limitations.md)
- Command surfaces: [docs/command-surfaces.md](command-surfaces.md)
- Release readiness: [docs/release-readiness.md](release-readiness.md)
