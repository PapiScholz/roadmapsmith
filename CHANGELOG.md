# Changelog

All notable changes to RoadmapSmith are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.2.0] — 2026-07-16

**Discovery pública en https://skills.sh/.**

### Added
- `skills.sh.json` en la raíz del repo con `$schema` oficial y grouping "Project Tracking" que agrupa `roadmap-init` + `roadmap-update`. Es el manifest que skills.sh consume para indexar el repo.
- `skills/roadmap-init/SKILL.md` y `skills/roadmap-update/SKILL.md` en la raíz — convención esperada por skills.sh y por `npx skills add PapiScholz/roadmapsmith` (Vercel Labs CLI).
- `scripts/sync-skills.js` — CLI con `--check` (falla si divergen) y `--fix` (copia root → nested). Root es la source de verdad.
- `.github/workflows/mirror-check.yml` — CI job que corre `--check` en cada push/PR a main. Bloquea merge si algún SKILL.md se editó en un solo lado.
- `scripts` en `package.json`: `sync-skills`, `check-skills`, `prepublishOnly` (este último bloquea `npm publish` si el mirror divergió).

### Changed
- `plugins/roadmapsmith/skills/*/SKILL.md` (bundle Codex escaneado por `.github/workflows/hol-plugin-scanner.yml`) queda como **mirror derivado** de `skills/`. Fluxo: editar `skills/<name>/SKILL.md` → `npm run sync-skills` regenera el mirror. Si te olvidás, CI y `prepublishOnly` gritan.

### Notes
- `install.js` sigue leyendo de `plugins/roadmapsmith/skills/` (source del tarball npm). Sin cambios de comportamiento para `npx roadmapsmith`.
- Version bump a `1.2.0` en `package.json`, `.codex-plugin/plugin.json`, `plugins/roadmapsmith/.codex-plugin/plugin.json`, `skills.json`.

## [1.1.0] — 2026-07-16

**Skill hardening basado en autofeedback del primer real-world run de `/roadmap-update`.**

### Added
- **Preflight modo scan (Q4):** `/roadmap-update` ahora pregunta al inicio "¿full-scan (determinístico) o short-circuit (uso contexto de sesión)?" El humano elige el trade-off token vs determinismo en cada corrida. Report incluye campo `MODE:` explícito.
- **Detección de prose stale (Q1 + Q5):** nuevo Step 2b compara la versión del `package.json` root con menciones de versión en el ROADMAP. Si hay mismatch, propone rewrite de la prose afectada como parte del diff (before/after visible, aprobación explícita).
- **Sub-sección `PROSE CHANGES` en el report template.**
- **Sub-sección `PROSE UPDATE` en el diff proposal** con before/after por cada cambio de prose.

### Changed
- **Invariante nueva:** cualquier cambio de prose (headers, versions, texto que no sea checkbox ni evidence) DEBE aparecer en el diff visible antes del OK. Cero cambios silentes — cierra la brecha del scope creep detectado en el autofeedback.
- **Invariante nueva:** al inicio SIEMPRE preguntar el modo de scan. El humano elige.
- **Invariante endurecida:** "no inventar tasks desde el chat" — ahora explícito con rationale ("la conversación es efímera, el ROADMAP es persistente"). Q2 se mantiene estricto por diseño.
- Trigger proactivo relabelado como "experimental" en el SKILL.md — el enforcement mecánico queda deferred en el ROADMAP (task `proactive-trigger-hook`).

### Notes
- Skill files: `plugins/roadmapsmith/skills/roadmap-update/SKILL.md` (165 líneas) + mirror en `.claude/skills/roadmap-update/SKILL.md`.
- `roadmap-init` sin cambios en v1.1.

## [1.0.0] — 2026-07-15

**Pivote a self-contained Claude Code skill.** El maintainer nunca quiso construir un CLI con validator y audit engine. La visión original era: una habilidad instalable con un comando, dos slashcommands, y `ROADMAP.md` mantenido verídicamente por el agente. v1.0.0 entrega esa visión.

### Breaking
- **Toda la superficie CLI** (`roadmapsmith init`, `update`, `verify`, `--strict`, `--json`, `--interactive`, etc.) se movió a `legacy/roadmap-skill/`. Ya no se instala por default. Los users que dependían del CLI pueden seguir usándolo desde `legacy/` pero no recibe desarrollo activo.
- **Nueva superficie:** dos slashcommands (`/roadmap-init` y `/roadmap-update`) definidos por SKILL.md files. El agente usa sus tools nativos (Read/Write/Edit/Bash-git) para operar sobre ROADMAP.md. Cero binarios externos requeridos.
- **Install:** `npx github:PapiScholz/roadmapsmith` reemplaza `npm install -g roadmapsmith` + `npx skills add ...`.

### Added
- `plugins/roadmapsmith/skills/roadmap-init/SKILL.md` — procedimiento self-contained para crear ROADMAP.md desde cero: 3 preguntas al user en un turno, scan del repo, generación con formato hybrid (fases + áreas), reporte estructurado.
- `plugins/roadmapsmith/skills/roadmap-update/SKILL.md` — procedimiento self-contained para actualizar ROADMAP.md: full-scan, evidence multi-signal por task (grep + file match + session context + git log), diff propuesto con espera de OK del user, invariantes explícitas (nunca `[x]` sin evidence verificable).
- `install.js` — script Node que copia los SKILL.md a `~/.claude/skills/`. Ejecutado por `npx github:PapiScholz/roadmapsmith`.
- `package.json` (root) — mínimo con `bin: ./install.js` para que `npx github:...` funcione.
- `legacy/README.md` — explica que el contenido de `legacy/` es pre-v1.0 y no recibe dev-activo.

### Moved (git mv, history preserved)
- `roadmap-skill/` → `legacy/roadmap-skill/`
- `docs/` → `legacy/docs/`
- `scripts/` → `legacy/scripts/`
- `assets/` → `legacy/assets/`
- `skills/` (top-level) → `legacy/skills/`
- `roadmap-skill.config.json` → `legacy/roadmap-skill.config.json`
- `skills.json` → `legacy/skills.json`

### Removed
- `demo-gif/` (empty untracked directory)
- Dependency on `npm install -g roadmapsmith`
- Dependency on the `skills` third-party install tool

### Changed
- Root `README.md` reescrito a ~30 líneas: install command, dos slashcommands, "personal tool" paragraph, `<details>` toggle apuntando a legacy.
- Los 3 plugin.json manifests (`.claude-plugin/`, `.codex-plugin/`, `plugins/roadmapsmith/.codex-plugin/`) bumpeados a `"version": "1.0.0"`.

## [0.14.0] — 2026-07-15

### Breaking
- **Namespace structural gate is no longer hardcoded to the maintainer's repo.**
  Prior to this release, task IDs prefixed with `cls-`, `dsg-`, `evh2-`, `cst-`,
  `uxf-`, `cfgo-`, or `doc3-` triggered a filesystem-shape gate specific to this
  repository's directory layout. The gate is now driven by
  `namespacePatterns` in `roadmap-skill.config.json`; the default is `{}`
  (gate skipped entirely). If you relied on any of those prefixes for the
  structural gate, add a `namespacePatterns` block — see
  `docs/audit-remediation.md` § "Namespace structural gate" for the migration
  snippet. **Requires a minor version bump to 0.14.0.**

### Added
- `namespacePatterns` config field: maps ID prefix → regex string. Regexes
  compile at config load time with the `i` flag; invalid regex strings throw
  with a pointer to the offending entry. Empty/missing → gate disabled.
- End-to-end smoke test (`scripts/e2e-smoke.sh`, `npm run test:e2e`, wired
  into CI). Exercises `init` → `add-task` → `audit --json` → `audit` text on
  a fresh temp repo. Extends first-hour UX bug coverage that unit tests miss.
- README audience segmentation ("Who this is for" + "When NOT to use"
  section) in both the root README and the `roadmap-skill/` package README.
- Decision log `docs/plans/markup-shape-decision.md` closing Rec 5 of the
  2026-07-15 audit at "keep status quo" per the plan's own escape hatch
  (no external opinions available; default to A).

## [0.9.35] — 2026-06-28

### Added
- `sync --audit` is now read-only: prints mismatch report, exits with code 2 on mismatches, never writes ROADMAP.md. Plain `sync` remains the destructive path.
- `sync` now prints a per-run diff summary (`Unchecked N task(s): ...`) so consecutive runs no longer produce a misleading "0 problems" after the first run already un-checked everything.
- `rs:kind=docs` marker flag: tasks whose completion is a Markdown artifact can be validated without code/test evidence. Validator accepts a matching `.md` file as authoritative.
- `rs:verified-by=human` marker flag: manual-verification tasks require an `Evidence:` child line and pass with confidence `medium`. Visible in `sync --audit` under a `humanVerifiedTasks` bucket.
- `config.scan.excludeDirs` in `roadmap-skill.config.json` lets users add project-specific directories to the scanner exclusion list.
- `auditValidation` exposes `newlyUnchecked` and `humanVerifiedTasks` buckets.

### Changed
- `readFileIndex` now skips generated-output paths at index time instead of only tagging them, closing the main artifact contamination path.
- `GENERATED_OUTPUT_PREFIXES` and `DEFAULT_IGNORED_DIRS` expanded: `.open-next/`, `.vercel/`, `.svelte-kit/`, `.parcel-cache/`, `.angular/`, `.expo/`, `.serverless/`, `.wrangler/`, `.tmp/`, `tmp/`.
- `artifactPatterns` (doc-task path) now consistent with `GENERATED_OUTPUT_PREFIXES`.
- `walkFiles` accepts `extraIgnoredDirs` option.
- `applySync` returns `{ content, changes }` instead of a plain string.
- `update` command: tasks with `rs:kind=docs` or `rs:verified-by=human` bypass the `confidence === high` gate.
- `maintain` no longer triggers the `--audit` read-only path internally.
- `docs/limitations.md` and `docs/audit-remediation.md` updated to reflect 0.9.35 changes.

### Added
- Documented the new one-command product contract around `roadmapsmith setup`, `roadmapsmith zero`, and `roadmapsmith maintain`.
- Added native Codex plugin docs for `.codex-plugin/plugin.json` and the repo-local marketplace surface at `.agents/plugins/marketplace.json`.
- Added the explicit `--full-regen` override for intentional managed-block replacement through `roadmapsmith generate` and `roadmapsmith maintain`.
- Added a broad pre-push validation gate contract with separate `QA/Regression` and `Functional/Smoke` command surfaces before any push.
- Added `docs/command-surfaces.md`, `docs/troubleshooting-host-setup.md`, and `docs/use-cases/codex-plugin.md`.
- Added `roadmapsmith validate --strict` as an additive independent audit path.

### Changed
- Release and use-case docs now treat the `roadmap-sync` skill as an optional policy layer instead of the primary end-user entrypoint.
- Zero Mode and Sync/Audit Mode documentation now match the real CLI and VS Code task flows.
- Host documentation now separates the native Codex plugin surface, the Claude skill-bundle surface, and the CLI plus VS Code fallback surface explicitly.
- `roadmapsmith doctor --json` now separates native slash surfaces (`claudeGui`, `claudeCli`, `codexGui`, `codexCli`) from the VS Code task plus Claude hook setup layer.
- `roadmapsmith status` is now the visible classic readiness command, with `roadmapsmith doctor` kept as a compatibility alias to the same inspection payload.
- `maintain` and `generate` are now documented as preserve-first updates for existing substantive managed blocks, while `/roadmap-update` replaces direct `/roadmap-sync` usage as the visible sync slash entrypoint.
- `maintain` is now documented as conservative on non-empty authored roadmaps without managed markers, `update` is documented as the inline-annotation path for those files, and `zero` now documents config-plus-flag discovery in non-interactive environments.
- The public slash namespace now prefers `/roadmap*` commands, uses `/roadmap-update` as the visible direct sync command, keeps `/roadmap-sync <action>` as the legacy root, and requires `--full-regen` before destructive regeneration.
- Release and maintainer docs now require independent subagent-owned validation passes before push, and CI reuses the same gate commands.
- Canonical, advanced, and compatibility command surfaces are now documented separately across code, skills, manifests, and docs.
- Readiness now depends on canonical native surfaces only; missing advanced VS Code tasks and duplicate legacy `/roadmap-sync` installs are warnings instead of canonical-health failures.

### Fixed
- Codex loader metadata for `skills/roadmap-sync/agents/openai.yaml` now parses cleanly instead of being ignored as invalid YAML.
- `maintain` now requires deterministic verification, explicit evidence, or fresh configured test results before it completes an unchecked implementation task; heuristic matches remain diagnostic only.
- `doctor` now detects the common duplicate-`/roadmap-sync` case where a legacy `~/.agents/skills/roadmap-sync` install coexists with the full `roadmapsmith` Codex plugin.
- Validator/sync now distinguish concrete implementation attempts from no-evidence tasks, ignore backticked HTTP/MIME/formula tokens as file paths, exempt HTTP expectation lines from standalone test requirements, and keep implicit duplicate task text deterministic via unique per-occurrence IDs.
- Verification recipes are now task-scoped, suppressed when non-specific or duplicated, and never generated when explicit `Verify:` or `Evidence:` metadata already exists.
- Heuristic evidence now excludes generated outputs, `scripts/` and auxiliary tooling paths by default, and prefers authored source files over compiled siblings.

## [0.7.0] — 2026-04-27

### Added
- **`doctor` command**: new CLI command scaffold (`roadmapsmith doctor`) for environment and config diagnostics.
- **Canonical repo file detection**: `SECURITY.md` and `LICENSE` are now recognized as artifact evidence during task validation.

### Changed
- **`customPhases` replaces `marketPhases`**: the config key for extended phases has been renamed from `marketPhases` to `customPhases` for better generality. Update your config if you use this field.
- **`evidence.heuristicArtifacts`**: heuristic artifact metadata moved from `reasons` into a dedicated `evidence.heuristicArtifacts` field in the validation result.
- **`mustBeStable` items**: `hasNote` no longer auto-checks these items — real evidence is now required.

### Fixed
- `minimumConfidence` now correctly gates sync task-marking; tasks below threshold are excluded from output and exit code.
- Confidence formula cleaned up; `CONFIDENCE_RANK` and `applyMinimumConfidence` are now exported from the public API.
- `validate --json` in CI scoped to a known-complete task to prevent false exit-1 on pending tasks.

### CI / Release
- Added `validate --json`, `sync --dry-run --audit`, `doctor`, and `npm pack --dry-run` steps to CI pipeline.
- Added GitHub issue templates (bug, feature, false-positive).

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
