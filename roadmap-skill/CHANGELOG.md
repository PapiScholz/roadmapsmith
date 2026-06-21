# Changelog

## Unreleased

### Fixed
- Hardened `maintain` so unchecked implementation tasks cannot complete from domain/token proximity alone; added deterministic `Verify:` checks, partial endpoint diagnostics, behavioral verification recipes, and fresh Vitest JSON report evidence.

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
