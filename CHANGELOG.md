# Changelog

All notable changes to RoadmapSmith are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.6.0] — 2026-04-26

### Added
- **Validation confidence levels**: `validateTask()` now returns a `confidence` field (`'high' | 'medium' | 'low'`) based on evidence breadth — `high` when 2+ evidence types (code, test, artifact) are found, `medium` for single-source evidence or tasks with path/symbol hints, `low` when no evidence is detected.
- **`validation.minimumConfidence` config option**: tasks below the configured confidence threshold are excluded from `roadmapsmith validate` output and do not contribute to the exit code. Defaults to `'low'` (no filtering). Set to `'medium'` or `'high'` to suppress low-confidence results and reduce false-positive CI failures.

### Changed
- **Version alignment**: `skills.json` and `.claude-plugin/plugin.json` bumped to match `roadmap-skill/package.json` (all at `0.6.0`).
- **`roadmap-skill/package.json` keywords**: expanded from 5 generic terms to 13 targeted keywords (`validation`, `sync`, `task-tracking`, `evidence-based`, `deterministic`, `monorepo`, `claude-code`, `ai-agent`, `project-management`) for improved npm discoverability.

## [0.5.1] — 2026-04-26

### Added
- **`test/utils.test.js`**: 8 tests that lock in the `slugify` algorithm — one per transform step (lowercase, non-alphanumeric collapse, leading/trailing hyphen strip, interior hyphen collapse) plus fallbacks for empty string and `null`. Fulfills v0.1 stability requirement for the rs:task ID slugification algorithm.
- **Exit criteria ID stability tests** in `generator.test.js`: asserts the exact `prof-ph{N}-st{N}-exit-{slug}` format for auto-generated exit criteria IDs, and verifies that checked state survives regeneration via those IDs. Fulfills v0.3 stability requirement for the `prof-step-N-` task ID namespace.

### Changed
- **ROADMAP.md**: all P1 items marked complete — roadmap is 100% done.

## [0.5.0] — 2026-04-26

### Added
- **`detectWorkspaces(projectRoot, files)`** in `io.js`: detects workspace package roots from `package.json` `workspaces` field (npm/yarn, supports `prefix/*` and `prefix/**`) and physical scan of `packages/*/`, `apps/*/`, `tools/*/`. Exported and wired into `scanProject`.
- **Workspace packages** surfaced in `currentState` and rendered in professional profile Section 3 ("Workspace Packages") when detected.
- **Monorepo test fixture** at `test/fixtures/monorepo/`: root `package.json` with `workspaces`, `packages/auth/` and `packages/core/` each with `src/` and `tests/`.
- **4 new validator tests**: natural-language slash pairs, unquoted path recognition, trailing punctuation stripping, `detectWorkspaces` detection, and validator test-evidence inside workspace packages.

### Fixed
- **`extractExplicitPaths` false positive**: unquoted `word/word` tokens (e.g. `start/end`, `input/output`, `read/write`) were incorrectly treated as file paths, causing spurious `missing referenced file(s): start/end` validation failures. Now filtered through `isLikelyPath()` which requires a real path signal (known root prefix, file extension, rooted path, or 3+ segments). Trailing punctuation (`.`, `,`, `)`, `:`) is stripped before the check.
- **`detectModules` nested prefix depth**: nested prefix search (`/src/`, `/packages/`, etc.) is now limited to paths where the prefix appears within the first two path segments, preventing test fixture directories from polluting the module list of the project under scan.
- Require comment prefix context (`//`, `#`, `*`) for TODO/FIXME markers to eliminate false positives from string literals.
- Exclude scanner implementation code from Known Limitations; detect nested `src/` modules correctly.

### Changed
- Regenerate root `ROADMAP.md`: `managed block start/end marker format` and `Improve module detection for monorepo workspace layouts` now validated and checked.

### Removed
- Dead `renderManagedBody` function and its local `taskLine`/`checkedState` helpers from generator.

## [0.4.0] — 2026-04-26

### Added
- **Phase → Step → Task** three-level hierarchy for professional roadmap Section 4. Each Phase has `phaseNumber`, `title`, `priority`, `objective`, and `steps[]`. Each Step has `stepNumber`, `title`, `priority`, `dependsOn`, `objective`, `tasks[]`, `exitCriteria[]`, `risks[]`. Each Task has `id`, `text`, `priority`, `checked`.
- **Task-level priority** rendered inline as `` `[P0]` ``, `` `[P1]` ``, etc. before task text. Step and task priorities are fully independent.
- **`product.phases`** config field: explicitly define phases/steps/tasks in `roadmap-skill.config.json`. When omitted, phases are inferred from P0/P1/P2 task groups.
- **`phasesDetailed`** model field passed through `createRoadmapModel` and the professional renderer.
- **`collectCodeTodoHints`**: separate from `collectTodoHints`, scans only `.js/.ts/.tsx/.py/.go/.rs` files. Known Limitations now uses code-only TODOs, eliminating doc-file noise.
- **`priorityLabel(priority)`** helper in `renderer/helpers.js`.
- **Structured sections 5–12**: each actionable item now carries a priority label. Sections 7–10 are grouped under named subsections (`### Output Format`, `### Quality Gates`, etc.).
- **Module/Command Maturity** (Section 6): known RoadmapSmith modules (`generator`, `parser`, `renderer`, `validator`, `match`, `config`, `io`) render with current state and concrete next tasks. Generic projects render detected modules with named subsections.
- **`MODULE_METADATA`** static map in `professional.js` for known module descriptions and suggested tasks.
- **9 new generator tests**: Phase→Step→Task hierarchy, task-level priority, priority independence (P0 task in P2 step), phase numeric ordering, doc-only TODO filtering, module maturity with real modules, priority label survival across regeneration, sections 5–12 priority labels.
- **5 showcase tests** in `roadmap.showcase.test.js`: managed markers, 12 sections, `prof-` IDs, Phase→Step hierarchy, `[P0]` priority labels.

### Changed
- `roadmap-skill.config.json` (root): added `product.phases` with 3 explicit phases demonstrating that phase order and priority are independent — Phase 2 (Validation Quality) carries `P0` priority but renders second; Step 1.2 (Model Improvements) carries `P0` priority inside a `P1` phase; Phase 3 Step 2 (npm Publishing) carries `P1` priority inside a `P2` phase.
- Root `ROADMAP.md` regenerated: now uses Phase → Step → Task format, task-level `[P0]`/`[P1]` labels, and structured subsections in sections 6–12.
- `DEFAULT_CONFIG.product` extended with `phases: []`.
- `mergeConfig()` passes `product.phases` through without item-by-item merging.
- `scanProject()` now returns both `todos` (all files, for backlog candidates) and `codeTodos` (code files only, for Known Limitations).

## [0.3.0] — 2026-04-25 *(development checkpoint — no git tag; superseded by v0.4.0)*

### Added
- Renderer architecture: `src/renderer/` module with `compact.js`, `professional.js`, `helpers.js`, and `index.js` dispatcher.
- `professional` roadmap profile: 12-section structured output with product north star, positioning, current state (Implemented / Scaffold / Known Limitations), phased execution roadmap with sequential steps, versioned milestones (mustExist / mustBeStable / outOfScope), module maturity path, output contract, testing, distribution, documentation, risks, and success criteria roadmaps.
- `roadmapProfile` config field (`compact` | `professional`). Defaults to `compact` for backward compatibility.
- `product` metadata block in `roadmap-skill.config.json`: `name`, `northStar`, `positioning`, `primaryUser`, `targetOutcome`, `antiGoals`, `risks`, `successCriteria`, `steps`.
- Sequential step model for Section 4: steps sorted by `stepNumber`, priority is a label only (not a sort key).
- Default exit criteria per step: each inferred step carries measurable exit conditions generating `prof-step-N-exit-` IDs.
- `enterprise` profile as a clean extension point: throws a descriptive error directing to the plugin registry.
- `roadmap-skill.config.json` at repository root configures RoadmapSmith to generate its own professional roadmap.
- `scanProject` now includes `projectRoot` in its return value for downstream `inferProjectName` use.
- Tests: 9 new generator tests (profile correctness, step ordering, state preservation, ID namespacing, enterprise error) and 4 showcase tests asserting the root `ROADMAP.md` meets professional output standards.

### Changed
- `createModel` extended with `product`, `steps`, `successCriteria`, and improved `currentState` (separate `implemented`, `scaffold`, `knownLimitations` arrays from real scan data).
- `createRoadmapModel` in `model.js` passes through `product`, `steps`, `successCriteria`, and `checkedById`.
- Config `mergeConfig` now deep-merges the `product` block.
- `DEFAULT_CONFIG` gains `roadmapProfile: 'compact'` and an empty `product` block.
- Root `ROADMAP.md` regenerated using the `professional` profile as a living showcase of RoadmapSmith output.
- `README.md` updated with a "Roadmap Profiles" section: profile comparison table, config example, output excerpt, and note that this repository's own ROADMAP.md is generated by RoadmapSmith.
- `SKILL.md` updated with a "Profile Selection" section documenting `roadmapProfile` and `product` config fields.

## [0.2.0] — 2026-04-25

### Added
- Two-mode product model: Zero Mode (empty repo discovery) and Sync/Audit Mode (existing repo validation).
- Zero Mode documentation: discovery interview contract, 8 discovery questions, north star definition flow.
- Sync/Audit Mode explicitly documented as the existing repository-backed validation workflow — not deprecated.
- Updated product north star in ROADMAP.md to reflect two-mode operating system.
- Updated skill instructions (SKILL.md) with mode selection rules and Zero Mode guardrails.
- Updated AGENTS.md with RoadmapSmith Mode Rule for agent decision-making.
- Use-case docs: `docs/use-cases/zero-mode-discovery.md` and `docs/use-cases/sync-audit-mode.md`.
- Forward-compatible discovery config fields (`northStar`, `targetUser`, `problemStatement`, `v1Outcome`, `antiGoals`, `risks`, `exitCriteria`) documented in `roadmap-skill.config.json` example.

## [0.1.0] — 2026-04-24

### Added
- `roadmap-sync` agent skill for skills.sh, agentskill.sh, and aitmpl.com/skills.
- CLI commands: `init`, `generate`, `sync`, `validate` with `--dry-run`, `--audit`, `--json` flags.
- Evidence-based task completion validation against repository file and symbol presence.
- Deterministic managed-block generation with phase ordering (P0 / P1 / P2) and release milestones.
- Template system for Node, Python, Go, Rust, and generic project types.
- Plugin loader for custom task matchers and validators via `roadmap-skill.config.json`.
- Full test suite covering parser, generator, validator, sync engine, and CLI integration.
- GitHub Actions CI workflow running tests and CLI smoke checks on Node 20.
