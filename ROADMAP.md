<!-- rs:managed:start -->
# RoadmapSmith Roadmap

## 1. Product North Star

Make every software project ship with a living, evidence-backed roadmap — zero manual maintenance.

**Primary user:** Solo developers and small teams using AI coding agents, especially Claude Code today, with manual CLI workflows on Codex/Codex CLI and other hosts.

**Target outcome:** Developers run one command and get a production-grade, evidence-validated ROADMAP.md they are proud to publish — and it stays accurate as the project evolves.

## 2. Positioning and Competitive Advantage

RoadmapSmith is a CLI tool and agent skill that auto-generates, validates, and syncs ROADMAP.md files directly from repository evidence. Claude Code has the clearest automation story today; other hosts currently rely on the manual CLI workflow. Unlike static roadmap templates or project management tools, RoadmapSmith keeps the roadmap honest: tasks are only marked complete when code, tests, or artifacts back them up.

## 3. Explicit Current State

### Implemented

- [x] 60 implementation files across Go, JavaScript, Python, Rust <!-- rs:task=prof-state-impl-60-implementation-files-across-go-javascript-python-rust -->

### Scaffold / Partial

- [ ] Module "classifier" partially implemented — coverage unknown <!-- rs:task=prof-state-scaffold-module-classifier-partially-implemented-coverage-unknown -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] Module "config" partially implemented — coverage unknown <!-- rs:task=prof-state-scaffold-module-config-partially-implemented-coverage-unknown -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] Module "generator" partially implemented — coverage unknown <!-- rs:task=prof-state-scaffold-module-generator-partially-implemented-coverage-unknown -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] Module "host" partially implemented — coverage unknown <!-- rs:task=prof-state-scaffold-module-host-partially-implemented-coverage-unknown -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] Module "io" partially implemented — coverage unknown <!-- rs:task=prof-state-scaffold-module-io-partially-implemented-coverage-unknown -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] Module "match" partially implemented — coverage unknown <!-- rs:task=prof-state-scaffold-module-match-partially-implemented-coverage-unknown -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence

### Known Limitations

- Code-level TODO/FIXME surface: 2 TODO/FIXME markers detected

## 4. Phased Execution Roadmap

### Phase 1: Product Architecture

**Phase Priority:** `[P1]`

**Objective:** Establish the renderer architecture, model hierarchy, and config schema that power all future profiles.

#### Step 1.1: Renderer Architecture

**Step Priority:** `[P1]`
**Depends on:** None

**Objective:** Renderer architecture with compact and professional profiles dispatched via renderBody.

**Tasks:**

- [ ] `[P0]` Preserve compact backward compatibility <!-- rs:task=prof-task-preserve-compact-backward-compatibility -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` Extract compact renderer to renderer/compact.js <!-- rs:task=prof-task-extract-compact-renderer -->
  - ⚠️ no implementation evidence found yet: missing referenced file(s): renderer/compact.js; no code, test, or artifact evidence found
- [ ] `[P2]` Add renderer dispatcher (renderBody) <!-- rs:task=prof-task-add-renderer-dispatcher -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence

**Exit Criteria:**

- [ ] `[P0]` Compact output remains byte-stable where expected <!-- rs:task=prof-ph1-st1-exit-compact-output-remains-byte-stable-where-expected -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` Professional profile renders all 12 sections <!-- rs:task=prof-ph1-st1-exit-professional-profile-renders-all-12-sections -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found

#### Step 1.2: Model Improvements

**Step Priority:** `[P0]`
**Depends on:** None

**Objective:** Add Phase→Step→Task hierarchy and task-level priority to the professional model.

**Tasks:**

- [ ] `[P0]` Add phasesDetailed model field <!-- rs:task=prof-task-add-phasesdetailed-model-field -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P1]` Filter code vs doc TODOs in Known Limitations inference <!-- rs:task=prof-task-filter-code-vs-doc-todos -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match
- [ ] `[P1]` Add task-level priority rendering with [P0]/[P1] labels <!-- rs:task=prof-task-add-task-priority-rendering -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence

**Exit Criteria:**

- [ ] `[P0]` A P0 task inside a P2 step renders with [P0] label in correct step position <!-- rs:task=prof-ph1-st2-exit-a-p0-task-inside-a-p2-step-renders-with-p0-label-in-correct-step-position -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` Known Limitations no longer includes doc-only TODO mentions <!-- rs:task=prof-ph1-st2-exit-known-limitations-no-longer-includes-doc-only-todo-mentions -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match

### Phase 2: Validation Quality

**Phase Priority:** `[P0]`

**Objective:** Harden evidence-based validation and reduce false-positive task matching.

#### Step 2.1: Evidence Validation Hardening

**Step Priority:** `[P0]`
**Depends on:** Phase 1

**Objective:** Fix false-positive validation and improve evidence scoring reliability.

**Tasks:**

- [ ] `[P0]` Fix false-positive task similarity matching on overlapping text <!-- rs:task=prof-task-fix-false-positive-task-matching -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P1]` Add fixture for doc-only TODO filtering test <!-- rs:task=prof-task-add-doc-only-todo-fixture -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P1]` Improve evidence scoring for test file coverage <!-- rs:task=prof-task-improve-evidence-scoring -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found

**Exit Criteria:**

- [ ] `[P0]` All validation tests pass on node, python, go, rust fixtures <!-- rs:task=prof-ph2-st1-exit-all-validation-tests-pass-on-node-python-go-rust-fixtures -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P0]` No false-positive task merges on similar-text tasks <!-- rs:task=prof-ph2-st1-exit-no-false-positive-task-merges-on-similar-text-tasks -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found

### Phase 3: Showcase and Distribution

**Phase Priority:** `[P2]`

**Objective:** Make RoadmapSmith's own generated ROADMAP.md and README a compelling showcase.

#### Step 3.1: README and Docs

**Step Priority:** `[P3]`
**Depends on:** Phase 1, Phase 2

**Objective:** Update all user-facing docs to reflect Phase→Step→Task model and professional profile.

**Tasks:**

- [x] `[P2]` Add generated roadmap excerpt to README with Phase→Step→Task example <!-- rs:task=prof-task-add-roadmap-excerpt-to-readme -->
- [x] `[P2]` Update SKILL.md with Phase→Step→Task documentation <!-- rs:task=prof-task-update-skill-md-phase-step-task -->
- [x] `[P2]` Add CHANGELOG.md entry for v0.4.0 <!-- rs:task=prof-task-update-changelog-v040 -->

**Exit Criteria:**

- [x] `[P2]` README shows real Phase→Step→Task output from ROADMAP.md <!-- rs:task=prof-ph3-st1-exit-readme-shows-real-phase-step-task-output-from-roadmap-md -->
- [x] `[P2]` CHANGELOG.md updated through current release <!-- rs:task=prof-ph3-st1-exit-changelog-md-updated-through-current-release -->

#### Step 3.2: npm Publishing

**Step Priority:** `[P1]`
**Depends on:** Phase 1, Phase 2

**Objective:** Publish RoadmapSmith to npm with stable semver aligned with git tags.

**Tasks:**

- [ ] `[P0]` Publish stable semver to npm <!-- rs:task=prof-task-publish-stable-semver-to-npm -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` Tag git release aligned with npm publish <!-- rs:task=prof-task-tag-git-release-aligned-with-npm -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match
- [ ] `[P1]` Document npm global and npx install instructions <!-- rs:task=prof-task-document-npx-install-instructions -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match

**Exit Criteria:**

- [ ] `[P0]` npm publish succeeds and package is installable via npx roadmapsmith <!-- rs:task=prof-ph3-st2-exit-npm-publish-succeeds-and-package-is-installable-via-npx-roadmapsmith -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match
- [ ] `[P1]` Git tag matches npm version <!-- rs:task=prof-ph3-st2-exit-git-tag-matches-npm-version -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found

## 5. Versioned Milestones

### v0.1

**Goal:** Foundation baseline complete

**What Must Exist:**

- [ ] `[P0]` CLI binary with init, generate, sync, validate commands <!-- rs:task=prof-ms-v0-1-exist-cli-binary-with-init-generate-sync-validate-commands -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match; missing test evidence
- [ ] `[P0]` Parser correctly extracts rs:task IDs and checked state <!-- rs:task=prof-ms-v0-1-exist-parser-correctly-extracts-rs-task-ids-and-checked-state -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P0]` Managed block preserved across regeneration <!-- rs:task=prof-ms-v0-1-exist-managed-block-preserved-across-regeneration -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found

**What Must Be Stable:**

- [ ] `[P1]` rs:task ID slugification algorithm — _Stable as of v0.5.1 — locked by test/utils.test.js. Meta-declaration: not evidence-scannable by sync._ <!-- rs:task=prof-ms-v0-1-stable-rs-task-id-slugification-algorithm -->
  - ⚠️ no implementation evidence found yet: missing referenced file(s): test/utils.test.js; no code, test, or artifact evidence found
- [ ] `[P1]` managed block start/end marker format <!-- rs:task=prof-ms-v0-1-stable-managed-block-start-end-marker-format -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found

**Intentionally Out of Scope:**

- Multiple roadmap profiles
- Plugin system
- Enterprise features

### v0.2

**Goal:** Core feature coverage stabilized

**What Must Exist:**

- [ ] `[P0]` Evidence-based validation (code, test, artifact) <!-- rs:task=prof-ms-v0-2-exist-evidence-based-validation-code-test-artifact -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P0]` Plugin hook system (registerTaskDetectors, registerValidators) <!-- rs:task=prof-ms-v0-2-exist-plugin-hook-system-registertaskdetectors-registervalidators -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match
- [ ] `[P0]` Multi-language fixture test suite (Node, Python, Go, Rust) <!-- rs:task=prof-ms-v0-2-exist-multi-language-fixture-test-suite-node-python-go-rust -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence

**What Must Be Stable:**

- [ ] `[P1]` Validation evidence scoring algorithm <!-- rs:task=prof-ms-v0-2-stable-validation-evidence-scoring-algorithm -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` Task similarity matching threshold <!-- rs:task=prof-ms-v0-2-stable-task-similarity-matching-threshold -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found

**Intentionally Out of Scope:**

- Professional roadmap profile
- Product metadata config block

### v0.3

**Goal:** Professional roadmap profile and renderer architecture

**What Must Exist:**

- [ ] `[P0]` Renderer architecture with compact and professional profiles <!-- rs:task=prof-ms-v0-3-exist-renderer-architecture-with-compact-and-professional-profiles -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P0]` 12-section professional roadmap output <!-- rs:task=prof-ms-v0-3-exist-12-section-professional-roadmap-output -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P0]` roadmapProfile field in roadmap-skill.config.json <!-- rs:task=prof-ms-v0-3-exist-roadmapprofile-field-in-roadmap-skill-config-json -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P0]` product metadata block in config <!-- rs:task=prof-ms-v0-3-exist-product-metadata-block-in-config -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P0]` Sequential step model for Section 4 <!-- rs:task=prof-ms-v0-3-exist-sequential-step-model-for-section-4 -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found

**What Must Be Stable:**

- [ ] `[P1]` compact profile output (backward compatible) <!-- rs:task=prof-ms-v0-3-stable-compact-profile-output-backward-compatible -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` professional profile section structure <!-- rs:task=prof-ms-v0-3-stable-professional-profile-section-structure -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` prof-step-N- task ID namespace — _Stable as of v0.5.1 — locked by exit criteria ID format and checked-state roundtrip tests in generator.test.js. Meta-declaration: not evidence-scannable by sync._ <!-- rs:task=prof-ms-v0-3-stable-prof-step-n-task-id-namespace -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found

**Intentionally Out of Scope:**

- Enterprise profile implementation
- AI-assisted roadmap generation beyond scan inference

### v1.0

**Goal:** Production readiness exit criteria met

**What Must Exist:**

- [ ] `[P0]` All test fixtures green across Node, Python, Go, Rust, generic <!-- rs:task=prof-ms-v1-0-exist-all-test-fixtures-green-across-node-python-go-rust-generic -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [x] `[P0]` README.md showcases professional output with excerpt <!-- rs:task=prof-ms-v1-0-exist-readme-md-showcases-professional-output-with-excerpt -->
- [ ] `[P0]` SKILL.md documents profile selection <!-- rs:task=prof-ms-v1-0-exist-skill-md-documents-profile-selection -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P0]` Published to npm with stable semver <!-- rs:task=prof-ms-v1-0-exist-published-to-npm-with-stable-semver -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found

**What Must Be Stable:**

- [ ] `[P1]` All CLI commands <!-- rs:task=prof-ms-v1-0-stable-all-cli-commands -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P1]` Config schema (roadmapProfile, product, milestones, phaseTemplates) <!-- rs:task=prof-ms-v1-0-stable-config-schema-roadmapprofile-product-milestones-phasetemplates -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` Plugin hook signatures <!-- rs:task=prof-ms-v1-0-stable-plugin-hook-signatures -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match

**Intentionally Out of Scope:**

- GUI or web interface
- Remote roadmap storage

## 6. Command-by-Command / Module-by-Module Maturity Path

### classifier

**Current state:** module detected in scan.

- [ ] `[P1]` Define maturity criteria and testability gates for classifier <!-- rs:task=prof-mat-classifier-define-maturity-criteria -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found

### config

**Current state:** Supports roadmapProfile, product block, milestones, phaseTemplates, plugins.

- [ ] `[P1]` Add JSON schema validation for roadmap-skill.config.json <!-- rs:task=prof-mat-config-json-schema-validation -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P0]` Add init --professional or init --with-config bootstrap flow <!-- rs:task=prof-mat-config-add-init-with-config-bootstrap-flow -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P1]` Honor versioned roadmap config instead of regenerating from defaults <!-- rs:task=prof-mat-config-honor-versioned-config-before-defaults -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` Define manual-to-managed migration flow and drift warnings between skill and CLI guidance <!-- rs:task=prof-mat-config-define-manual-to-managed-migration-and-drift-warnings -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found

### generator

**Current state:** Compact and professional profiles supported; Phase→Step→Task model implemented.

- [ ] `[P0]` Improve Phase→Step→Task model inference quality <!-- rs:task=prof-mat-generator-improve-phase-step-task-inference -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` Add scan-driven task suggestions per detected module <!-- rs:task=prof-mat-generator-scan-driven-task-suggestions -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence

### host

**Current state:** module detected in scan.

- [ ] `[P1]` Define maturity criteria and testability gates for host <!-- rs:task=prof-mat-host-define-maturity-criteria -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found

### io

**Current state:** Scans files, detects languages, test frameworks, commands, modules.

- [ ] `[P2]` Improve module detection for monorepo workspace layouts <!-- rs:task=prof-mat-io-monorepo-workspace-detection -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence

### match

**Current state:** Task similarity matching with edit-distance threshold.

- [ ] `[P0]` Tune similarity threshold to reduce false-positive merges <!-- rs:task=prof-mat-match-tune-similarity-threshold -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found

### parser

**Current state:** Parses managed blocks, rs:task IDs, and checked state.

- [ ] `[P1]` Add parser validation for Phase→Step hierarchy markers <!-- rs:task=prof-mat-parser-phase-hierarchy-validation -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P1]` Improve section boundary detection for professional format <!-- rs:task=prof-mat-parser-professional-section-detection -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found

### renderer

**Current state:** Dispatcher supports compact, professional, and enterprise (error) profiles.

- [ ] `[P0]` Add snapshot regression fixtures for compact and professional <!-- rs:task=prof-mat-renderer-snapshot-regression-fixtures -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P1]` Harden priority label rendering for edge cases <!-- rs:task=prof-mat-renderer-priority-label-edge-cases -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found

## 7. Output Contract Roadmap

### Output Format

- [ ] `[P0]` Define stable public output format (stdout, files, exit codes) <!-- rs:task=prof-out-define-stable-public-output-format-stdout-files-exit-codes -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` Version output format alongside package version <!-- rs:task=prof-out-version-output-format-alongside-package-version -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P0]` Define explicit contract for sync, sync --audit, and future promote-only flows <!-- rs:task=prof-out-define-explicit-contract-for-sync-sync-audit-and-future-promote-only-flows -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` Document current gap: sync --audit is not yet a dedicated read-only audit command <!-- rs:task=prof-out-document-current-gap-sync-audit-is-not-yet-a-dedicated-read-only-audit-command -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P1]` Add machine-readable audit output (JSON) <!-- rs:task=prof-out-add-machine-readable-audit-output-json -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P1]` Add audit summary-only output mode <!-- rs:task=prof-out-add-audit-summary-only-output-mode -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P0]` Define explicit exit-code semantics for sync and audit commands <!-- rs:task=prof-out-define-explicit-exit-code-semantics-for-sync-and-audit-commands -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence

### Breaking Changes

- [ ] `[P1]` Document breaking vs. non-breaking output changes <!-- rs:task=prof-out-document-breaking-vs-non-breaking-output-changes -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` Add output schema validation to CI <!-- rs:task=prof-out-add-output-schema-validation-to-ci -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P0]` Separate mutating sync behavior from future read-only audit mode <!-- rs:task=prof-out-separate-mutating-sync-behavior-from-future-read-only-audit-mode -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` Expose weak-evidence, documentation-only, and structural-mismatch findings in audit output <!-- rs:task=prof-out-expose-weak-evidence-documentation-only-and-structural-mismatch-findings-in-audit-output -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found

## 8. Testing and Quality-Gate Roadmap

### Test Coverage

- [ ] `[P0]` Unit test coverage for all core modules <!-- rs:task=prof-test-unit-test-coverage-for-all-core-modules -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P0]` Integration tests covering the full generate → sync → validate pipeline <!-- rs:task=prof-test-integration-tests-covering-the-full-generate-sync-validate-pipeline -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match
- [ ] `[P1]` Regression fixtures for compact and professional profile output <!-- rs:task=prof-test-regression-fixtures-for-compact-and-professional-profile-output -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P1]` Edge case coverage: empty repo, no config, large monorepo scan <!-- rs:task=prof-test-edge-case-coverage-empty-repo-no-config-large-monorepo-scan -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` Add direct tests for .claude/hooks/roadmap-sync.js payload parsing <!-- rs:task=prof-test-add-direct-tests-for-claude-hooks-roadmap-sync-js-payload-parsing -->
  - ⚠️ no implementation evidence found yet: missing referenced file(s): .claude/hooks/roadmap-sync.js; no code, test, or artifact evidence found; missing test evidence
- [ ] `[P1]` Add direct tests for ROADMAP.md self-edit skip behavior <!-- rs:task=prof-test-add-direct-tests-for-roadmap-md-self-edit-skip-behavior -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P1]` Add direct tests for lock-file reentry guard <!-- rs:task=prof-test-add-direct-tests-for-lock-file-reentry-guard -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P0]` Add direct tests for sync failure surfacing when the child process cannot be spawned <!-- rs:task=prof-test-add-direct-tests-for-sync-failure-surfacing-when-the-child-process-cannot-be-spawned -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P0]` Add regression coverage for environments where node is not available on PATH <!-- rs:task=prof-test-add-regression-coverage-for-environments-where-node-is-not-available-on-path -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P1]` Add integration coverage for pre-commit sync using the absolute Node path <!-- rs:task=prof-test-add-integration-coverage-for-pre-commit-sync-using-the-absolute-node-path -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence

### Quality Gates

- [ ] `[P0]` CI quality gate: tests must pass before merge <!-- rs:task=prof-test-ci-quality-gate-tests-must-pass-before-merge -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P0]` Block merge when generated roadmap loses checked state <!-- rs:task=prof-test-block-merge-when-generated-roadmap-loses-checked-state -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` Add professional renderer snapshot tests <!-- rs:task=prof-test-add-professional-renderer-snapshot-tests -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence

## 9. Distribution Roadmap

### npm Registry

- [ ] `[P0]` Publish to npm registry with stable semver <!-- rs:task=prof-dist-publish-to-npm-registry-with-stable-semver -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P0]` Ensure CLI binary is correctly linked in package.json `bin` <!-- rs:task=prof-dist-ensure-cli-binary-is-correctly-linked-in-package-json-bin -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found

### Release Process

- [ ] `[P1]` Tag git releases aligned with npm publish <!-- rs:task=prof-dist-tag-git-releases-aligned-with-npm-publish -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` Document install instructions for npm global and npx usage <!-- rs:task=prof-dist-document-install-instructions-for-npm-global-and-npx-usage -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match

## 10. Documentation Roadmap

### Core Docs

- [ ] `[P0]` README.md covers install, commands, and profile selection <!-- rs:task=prof-doc-readme-md-covers-install-commands-and-profile-selection -->
  - ⚠️ no implementation evidence found yet: missing test evidence
- [ ] `[P0]` SKILL.md reflects current feature set and guardrails <!-- rs:task=prof-doc-skill-md-reflects-current-feature-set-and-guardrails -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [x] `[P1]` CHANGELOG.md maintained for each release <!-- rs:task=prof-doc-changelog-md-maintained-for-each-release -->
- [ ] `[P0]` README.md documents current sync --audit semantics without claiming read-only behavior <!-- rs:task=prof-doc-readme-md-documents-current-sync-audit-semantics-without-claiming-read-only-behavior -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` README.md includes host matrix for Claude Code, Codex/Codex CLI, CI, and manual workflows <!-- rs:task=prof-doc-readme-md-includes-host-matrix-for-claude-code-codex-codex-cli-ci-and-manual-workflows -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match
- [ ] `[P1]` Document distinction between supported Claude hooks and manual workflows on other hosts <!-- rs:task=prof-doc-document-distinction-between-supported-claude-hooks-and-manual-workflows-on-other-hosts -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match
- [ ] `[P1]` Document Codex/Codex CLI manual fallback workflow <!-- rs:task=prof-doc-document-codex-codex-cli-manual-fallback-workflow -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` Document Windows shell caveats: roadmapsmith.cmd, npm.cmd, and PowerShell policy differences <!-- rs:task=prof-doc-document-windows-shell-caveats-roadmapsmith-cmd-npm-cmd-and-powershell-policy-differences -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match
- [ ] `[P1]` Skill instructions require extending existing phases before adding new ones <!-- rs:task=prof-doc-skill-instructions-require-extending-existing-phases-before-adding-new-ones -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match; missing test evidence
- [ ] `[P1]` Document that Claude write-time autoupdate currently depends on Node resolution in the hook environment <!-- rs:task=prof-doc-document-that-claude-write-time-autoupdate-currently-depends-on-node-resolution-in-the-hook-environment -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match
- [ ] `[P1]` Document the difference between the Claude PostToolUse hook and the git pre-commit hook <!-- rs:task=prof-doc-document-the-difference-between-the-claude-posttooluse-hook-and-the-git-pre-commit-hook -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match
- [ ] `[P1]` Document current autoupdate reliability boundaries: write-time hook is best-effort, pre-commit is stricter <!-- rs:task=prof-doc-document-current-autoupdate-reliability-boundaries-write-time-hook-is-best-effort-pre-commit-is-stricter -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` Document troubleshooting for hook failure when node is missing from PATH <!-- rs:task=prof-doc-document-troubleshooting-for-hook-failure-when-node-is-missing-from-path -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match
- [ ] `[P1]` Document that Codex/Codex CLI remains manual and does not share the Claude repo-local hook path <!-- rs:task=prof-doc-document-that-codex-codex-cli-remains-manual-and-does-not-share-the-claude-repo-local-hook-path -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match

### Showcase

- [ ] `[P1]` docs/ use-cases cover compact and professional profiles <!-- rs:task=prof-doc-docs-use-cases-cover-compact-and-professional-profiles -->
  - ⚠️ no implementation evidence found yet: missing referenced file(s): docs/; weak path-only evidence lacks content-specific token match
- [ ] `[P1]` Generated ROADMAP.md showcases professional Phase→Step→Task output <!-- rs:task=prof-doc-generated-roadmap-md-showcases-professional-phase-step-task-output -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found

## 11. Risks, Constraints, and Anti-Goals

### Risks

- [ ] `[P0]` Inference quality degrades on very large monorepos (scan cap at 120 files) <!-- rs:task=prof-risk-inference-quality-degrades-on-very-large-monorepos-scan-cap-at-120-files -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` Professional profile sections may feel over-structured for small hobby projects <!-- rs:task=prof-risk-professional-profile-sections-may-feel-over-structured-for-small-hobby-projects -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` Task similarity matching may mis-merge tasks with overlapping language <!-- rs:task=prof-risk-task-similarity-matching-may-mis-merge-tasks-with-overlapping-language -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` Roadmap drift if users edit the managed block directly instead of using the CLI <!-- rs:task=prof-risk-roadmap-drift-if-users-edit-the-managed-block-directly-instead-of-using-the-cli -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found

### Anti-Goals

- Replace project management tools like Linear or Jira
- Require a backend service or database
- Generate roadmaps without real repository context
- Act as a project planning tool that replaces human judgment

## 12. 1.0 Measurable Success Criteria

- [ ] `[P0]` compact mode generates idempotent output on all fixture projects <!-- rs:task=prof-sc-compact-mode-generates-idempotent-output-on-all-fixture-projects -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P0]` professional mode renders all 12 required sections without errors <!-- rs:task=prof-sc-professional-mode-renders-all-12-required-sections-without-errors -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P0]` checked task state survives regeneration across both profiles <!-- rs:task=prof-sc-checked-task-state-survives-regeneration-across-both-profiles -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P0]` RoadmapSmith's own ROADMAP.md is generated entirely by RoadmapSmith itself <!-- rs:task=prof-sc-roadmapsmith-s-own-roadmap-md-is-generated-entirely-by-roadmapsmith-itself -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match
- [ ] `[P0]` npm test passes with no failures on all fixture languages <!-- rs:task=prof-sc-npm-test-passes-with-no-failures-on-all-fixture-languages -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence

## 13. Extended Phases

### Phase 4: Launch Preparation

**Phase Priority:** `[P1]`
**Objective:** Prepare repository for public release and initial adoption.

#### Step 4.1: Repository Polish

**Step Priority:** `[P1]`
**Depends on:** Phase 3

**Objective:** Align metadata, improve discoverability, and add visual assets.

**Tasks:**

- [ ] `[P0]` Align versions across package.json, skills.json, plugin.json <!-- rs:task=mkt-p0-align-versions-package-skills-plugin -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P0]` Improve package.json keywords and description for discoverability <!-- rs:task=mkt-p0-improve-package-json-keywords-description -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [x] `[P1]` Add demo.gif or placeholder to README <!-- rs:task=mkt-p0-add-demo-gif-placeholder -->
- [ ] `[P1]` Move Quick Start section to top of README <!-- rs:task=mkt-p0-move-quick-start-to-top-readme -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match
- [x] `[P1]` Add badges (npm version, CI status, license) to README <!-- rs:task=mkt-p0-add-badges-npm-ci-license -->
- [x] `[P1]` Add comparison table (vs TODO.md, GitHub Issues, etc.) to README <!-- rs:task=mkt-p0-add-comparison-table -->
- [ ] `[P2]` Add GitHub Actions audit template example <!-- rs:task=mkt-p0-add-github-actions-audit-template -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match; missing test evidence
- [ ] `[P2]` Add SECURITY.md <!-- rs:task=mkt-p0-add-security-md -->
  - ⚠️ no implementation evidence found yet: missing test evidence

**Exit Criteria:**

- [ ] `[P0]` All version strings match across package.json, skills.json, plugin.json <!-- rs:task=mkt-ph4-st1-exit-version-strings-aligned -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` README Quick Start is the first user-facing section <!-- rs:task=mkt-ph4-st1-exit-quick-start-at-top -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match

### Phase 5: Reliability Hardening

**Phase Priority:** `[P0]`
**Objective:** Improve validation trust and operational robustness.

#### Step 5.1: Validation Confidence

**Step Priority:** `[P0]`
**Depends on:** Phase 4

**Objective:** Design and expose confidence levels to reduce false-positive validation.

**Tasks:**

- [ ] `[P0]` Add validation confidence levels (design or scaffold if not implemented) <!-- rs:task=mkt-p1-add-validation-confidence-levels -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P0]` Add config option: validation.minimumConfidence <!-- rs:task=mkt-p1-add-config-validation-minimum-confidence -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P1]` Add `roadmapsmith doctor` command (scaffold or planned) <!-- rs:task=mkt-p1-add-roadmapsmith-doctor-command -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match; missing test evidence
- [ ] `[P1]` Add docs/use-cases/ci-audit.md <!-- rs:task=mkt-p1-add-docs-use-cases-ci-audit -->
  - ⚠️ no implementation evidence found yet: missing referenced file(s): docs/use-cases/ci-audit.md; no code, test, or artifact evidence found; missing test evidence
- [ ] `[P1]` Add docs/use-cases/claude-code.md <!-- rs:task=mkt-p1-add-docs-use-cases-claude-code -->
  - ⚠️ attempted but validation failed: file reference shows implementation location, not confirmed completion
- [ ] `[P2]` Add docs/limitations.md (consolidate existing known limitations) <!-- rs:task=mkt-p1-add-docs-limitations -->
  - ⚠️ attempted but validation failed: file reference shows implementation location, not confirmed completion

**Exit Criteria:**

- [ ] `[P0]` validation.minimumConfidence config field accepted without errors <!-- rs:task=mkt-ph5-st1-exit-minimum-confidence-config-accepted -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` roadmapsmith doctor exits 0 on a healthy repo <!-- rs:task=mkt-ph5-st1-exit-doctor-exits-zero-healthy-repo -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match

### Phase 6: Distribution

**Phase Priority:** `[P1]`
**Objective:** Publish and distribute the tool across ecosystems.

#### Step 6.1: Release and Channels

**Step Priority:** `[P0]`
**Depends on:** Phase 4, Phase 5

**Objective:** Cut v0.6.0 release and publish to all relevant channels.

**Tasks:**

- [ ] `[P0]` Prepare and cut GitHub release v0.6.0 <!-- rs:task=mkt-p2-github-release-v060 -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match
- [ ] `[P0]` Publish npm release v0.6.0 <!-- rs:task=mkt-p2-npm-release-v060 -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match
- [ ] `[P1]` Update GitHub Actions workflow actions for Node 24 runner compatibility <!-- rs:task=mkt-p2-update-github-actions-node24-compat -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match
- [ ] `[P1]` Publish or update skills.sh entry <!-- rs:task=mkt-p2-publish-skills-sh-entry -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P1]` Evaluate MCP Market and skill.fish publishing <!-- rs:task=mkt-p2-evaluate-mcp-market-skill-fish -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match
- [ ] `[P2]` Create launch post (LinkedIn) <!-- rs:task=mkt-p2-create-launch-post-linkedin -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found; missing test evidence
- [ ] `[P2]` Add GitHub issue templates (bug, feature, false-positive) <!-- rs:task=mkt-p2-add-issue-templates -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match; missing test evidence

**Exit Criteria:**

- [ ] `[P0]` npm install -g roadmapsmith@0.6.0 succeeds <!-- rs:task=mkt-ph6-st1-exit-npm-install-v060-succeeds -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found
- [ ] `[P0]` GitHub release v0.6.0 published with release notes <!-- rs:task=mkt-ph6-st1-exit-github-release-v060-published -->
  - ⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match
- [ ] `[P1]` skills.sh entry updated or submitted <!-- rs:task=mkt-ph6-st1-exit-skills-sh-entry-updated -->
  - ⚠️ no implementation evidence found yet: no code, test, or artifact evidence found

## Detected Project Profile
- **Type:** landing-site
- **Confidence:** medium
- **Evidence:** directory: assets, config: next.config.js, config: tailwind.config.js, CSS files present, landing/service routes: 4

### Phase 7: Post-0.9.33 Audit Remediation

**Phase Priority:** `[P0]`

**Objective:** Address the six findings from the production audit of 0.9.33. Full diagnosis and fix specifications in [docs/audit-remediation.md](docs/audit-remediation.md).

#### Step 7.1: Breaking change and documentation

**Step Priority:** `[P0]`
**Depends on:** None

**Tasks:**

- [ ] `[P0]` Add `[fix]` remediation hint to `doctor`/`status` when canonical VS Code tasks are missing after upgrade <!-- rs:task=audit-p0-doctor-status-setup-hint -->
- [ ] `[P1]` Document `WARN:STALE_EVIDENCE` resolution paths in roadmap-validate skill <!-- rs:task=audit-p1a-stale-evidence-docs -->
- [ ] `[P1]` Document `validate --json` Windows pipe limitation and add `--out <file>` flag <!-- rs:task=audit-p1b-validate-json-windows -->

#### Step 7.2: Artifact contamination fix

**Step Priority:** `[P0]`
**Depends on:** None

**Tasks:**

- [ ] `[P0]` Centralize generated-output filtering into `stripNonEvidencePaths()` applied after evidence assembly <!-- rs:task=audit-p2-artifact-filter-centralize -->

#### Step 7.3: Validate independence — content verification layer

**Step Priority:** `[P1]`
**Depends on:** Step 7.2

**Tasks:**

- [ ] `[P1]` Spec and meta-tests for `contentVerifier.js` contract using real false-positive fixtures from audit <!-- rs:task=audit-p3a-content-verifier-spec -->
- [ ] `[P1]` Implement `src/validator/contentVerifier.js` behind `--strict-content` flag, report-only mode <!-- rs:task=audit-p3b-content-verifier-impl -->
- [ ] `[P1]` Wire content verifier to exit-code and `WARN:UNVERIFIED_EVIDENCE` diagnostic under `--strict` <!-- rs:task=audit-p3c-content-verifier-gating -->
- [ ] `[P2]` Integrate content verifier into `maintain` self-audit once `validate --strict-content` is stable <!-- rs:task=audit-p3d-content-verifier-maintain -->

<!-- rs:managed:end -->
