<!-- rs:managed:start -->
# RoadmapSmith Roadmap

## 1. Product North Star

Make every software project ship with a living, evidence-backed roadmap — zero manual maintenance.

**Primary user:** Solo developers and small teams using AI coding agents (Claude Code, Copilot, etc.).

**Target outcome:** Developers run one command and get a production-grade, evidence-validated ROADMAP.md they are proud to publish — and it stays accurate as the project evolves.

## 2. Positioning and Competitive Advantage

RoadmapSmith is a CLI tool and Claude skill that auto-generates, validates, and syncs ROADMAP.md files directly from repository evidence. Unlike static roadmap templates or project management tools, RoadmapSmith keeps the roadmap honest: tasks are only marked complete when code, tests, or artifacts back them up.

## 3. Explicit Current State

### Implemented

- [x] 31 implementation files across Go, JavaScript, Python, Rust <!-- rs:task=prof-state-impl-31-implementation-files-across-go-javascript-python-rust -->

### Scaffold / Partial

- [ ] Module "app" partially implemented — coverage unknown <!-- rs:task=prof-state-scaffold-module-app-partially-implemented-coverage-unknown -->
- [ ] Module "config" partially implemented — coverage unknown <!-- rs:task=prof-state-scaffold-module-config-partially-implemented-coverage-unknown -->
- [ ] Module "generator" partially implemented — coverage unknown <!-- rs:task=prof-state-scaffold-module-generator-partially-implemented-coverage-unknown -->
- [ ] Module "io" partially implemented — coverage unknown <!-- rs:task=prof-state-scaffold-module-io-partially-implemented-coverage-unknown -->
- [ ] Module "lib" partially implemented — coverage unknown <!-- rs:task=prof-state-scaffold-module-lib-partially-implemented-coverage-unknown -->
- [ ] Module "match" partially implemented — coverage unknown <!-- rs:task=prof-state-scaffold-module-match-partially-implemented-coverage-unknown -->

### Known Limitations

- Code-level TODO/FIXME surface: 2 TODO/FIXME markers detected

## 4. Phased Execution Roadmap

### Phase 1: Product Architecture

**Phase Priority:** `[P1]`

**Objective:** Establish the renderer architecture, model hierarchy, and config schema that power all future profiles.

#### Step 1.1: Renderer Architecture

**Step Priority:** `[P1]`
**Depends on:** None

**Objective:** Extract renderManagedBody into a dispatcher pattern supporting multiple profiles.

**Tasks:**

- [ ] `[P0]` Preserve compact backward compatibility <!-- rs:task=prof-task-preserve-compact-backward-compatibility -->
- [ ] `[P1]` Extract compact renderer to renderer/compact.js <!-- rs:task=prof-task-extract-compact-renderer -->
- [ ] `[P2]` Add renderer dispatcher (renderBody) <!-- rs:task=prof-task-add-renderer-dispatcher -->

**Exit Criteria:**

- [ ] `[P0]` Compact output remains byte-stable where expected <!-- rs:task=prof-ph1-st1-exit-compact-output-remains-byte-stable-where-expected -->
- [ ] `[P1]` Professional profile renders all 12 sections <!-- rs:task=prof-ph1-st1-exit-professional-profile-renders-all-12-sections -->

#### Step 1.2: Model Improvements

**Step Priority:** `[P0]`
**Depends on:** None

**Objective:** Add Phase→Step→Task hierarchy and task-level priority to the professional model.

**Tasks:**

- [ ] `[P0]` Add phasesDetailed model field <!-- rs:task=prof-task-add-phasesdetailed-model-field -->
- [ ] `[P1]` Filter code vs doc TODOs in Known Limitations inference <!-- rs:task=prof-task-filter-code-vs-doc-todos -->
- [ ] `[P1]` Add task-level priority rendering with [P0]/[P1] labels <!-- rs:task=prof-task-add-task-priority-rendering -->

**Exit Criteria:**

- [ ] `[P0]` A P0 task inside a P2 step renders with [P0] label in correct step position <!-- rs:task=prof-ph1-st2-exit-a-p0-task-inside-a-p2-step-renders-with-p0-label-in-correct-step-position -->
- [ ] `[P1]` Known Limitations no longer includes doc-only TODO mentions <!-- rs:task=prof-ph1-st2-exit-known-limitations-no-longer-includes-doc-only-todo-mentions -->

### Phase 2: Validation Quality

**Phase Priority:** `[P0]`

**Objective:** Harden evidence-based validation and reduce false-positive task matching.

#### Step 2.1: Evidence Validation Hardening

**Step Priority:** `[P0]`
**Depends on:** Phase 1

**Objective:** Fix false-positive validation and improve evidence scoring reliability.

**Tasks:**

- [ ] `[P0]` Fix false-positive task similarity matching on overlapping text <!-- rs:task=prof-task-fix-false-positive-task-matching -->
- [ ] `[P1]` Add fixture for doc-only TODO filtering test <!-- rs:task=prof-task-add-doc-only-todo-fixture -->
- [ ] `[P1]` Improve evidence scoring for test file coverage <!-- rs:task=prof-task-improve-evidence-scoring -->

**Exit Criteria:**

- [ ] `[P0]` All validation tests pass on node, python, go, rust fixtures <!-- rs:task=prof-ph2-st1-exit-all-validation-tests-pass-on-node-python-go-rust-fixtures -->
- [ ] `[P0]` No false-positive task merges on similar-text tasks <!-- rs:task=prof-ph2-st1-exit-no-false-positive-task-merges-on-similar-text-tasks -->

### Phase 3: Showcase and Distribution

**Phase Priority:** `[P2]`

**Objective:** Make RoadmapSmith's own generated ROADMAP.md and README a compelling showcase.

#### Step 3.1: README and Docs

**Step Priority:** `[P3]`
**Depends on:** Phase 1, Phase 2

**Objective:** Update all user-facing docs to reflect Phase→Step→Task model and professional profile.

**Tasks:**

- [ ] `[P2]` Add generated roadmap excerpt to README with Phase→Step→Task example <!-- rs:task=prof-task-add-roadmap-excerpt-to-readme -->
- [ ] `[P2]` Update SKILL.md with Phase→Step→Task documentation <!-- rs:task=prof-task-update-skill-md-phase-step-task -->
- [ ] `[P2]` Add CHANGELOG.md entry for v0.4.0 <!-- rs:task=prof-task-update-changelog-v040 -->

**Exit Criteria:**

- [ ] `[P2]` README shows real Phase→Step→Task output from ROADMAP.md <!-- rs:task=prof-ph3-st1-exit-readme-shows-real-phase-step-task-output-from-roadmap-md -->
- [ ] `[P2]` CHANGELOG.md updated through current release <!-- rs:task=prof-ph3-st1-exit-changelog-md-updated-through-current-release -->

#### Step 3.2: npm Publishing

**Step Priority:** `[P1]`
**Depends on:** Phase 1, Phase 2

**Objective:** Publish RoadmapSmith to npm with stable semver aligned with git tags.

**Tasks:**

- [ ] `[P0]` Publish stable semver to npm <!-- rs:task=prof-task-publish-stable-semver-to-npm -->
- [ ] `[P1]` Tag git release aligned with npm publish <!-- rs:task=prof-task-tag-git-release-aligned-with-npm -->
- [ ] `[P1]` Document npm global and npx install instructions <!-- rs:task=prof-task-document-npx-install-instructions -->

**Exit Criteria:**

- [ ] `[P0]` npm publish succeeds and package is installable via npx roadmapsmith <!-- rs:task=prof-ph3-st2-exit-npm-publish-succeeds-and-package-is-installable-via-npx-roadmapsmith -->
- [ ] `[P1]` Git tag matches npm version <!-- rs:task=prof-ph3-st2-exit-git-tag-matches-npm-version -->

## 5. Versioned Milestones

### v0.1

**Goal:** Foundation baseline complete

**What Must Exist:**

- [ ] `[P0]` CLI binary with init, generate, sync, validate commands <!-- rs:task=prof-ms-v0-1-exist-cli-binary-with-init-generate-sync-validate-commands -->
- [ ] `[P0]` Parser correctly extracts rs:task IDs and checked state <!-- rs:task=prof-ms-v0-1-exist-parser-correctly-extracts-rs-task-ids-and-checked-state -->
- [ ] `[P0]` Managed block preserved across regeneration <!-- rs:task=prof-ms-v0-1-exist-managed-block-preserved-across-regeneration -->

**What Must Be Stable:**

- [ ] `[P1]` rs:task ID slugification algorithm <!-- rs:task=prof-ms-v0-1-stable-rs-task-id-slugification-algorithm -->
- [ ] `[P1]` managed block start/end marker format <!-- rs:task=prof-ms-v0-1-stable-managed-block-start-end-marker-format -->

**Intentionally Out of Scope:**

- Multiple roadmap profiles
- Plugin system
- Enterprise features

### v0.2

**Goal:** Core feature coverage stabilized

**What Must Exist:**

- [ ] `[P0]` Evidence-based validation (code, test, artifact) <!-- rs:task=prof-ms-v0-2-exist-evidence-based-validation-code-test-artifact -->
- [ ] `[P0]` Plugin hook system (registerTaskDetectors, registerValidators) <!-- rs:task=prof-ms-v0-2-exist-plugin-hook-system-registertaskdetectors-registervalidators -->
- [ ] `[P0]` Multi-language fixture test suite (Node, Python, Go, Rust) <!-- rs:task=prof-ms-v0-2-exist-multi-language-fixture-test-suite-node-python-go-rust -->

**What Must Be Stable:**

- [ ] `[P1]` Validation evidence scoring algorithm <!-- rs:task=prof-ms-v0-2-stable-validation-evidence-scoring-algorithm -->
- [ ] `[P1]` Task similarity matching threshold <!-- rs:task=prof-ms-v0-2-stable-task-similarity-matching-threshold -->

**Intentionally Out of Scope:**

- Professional roadmap profile
- Product metadata config block

### v0.3

**Goal:** Professional roadmap profile and renderer architecture

**What Must Exist:**

- [ ] `[P0]` Renderer architecture with compact and professional profiles <!-- rs:task=prof-ms-v0-3-exist-renderer-architecture-with-compact-and-professional-profiles -->
- [ ] `[P0]` 12-section professional roadmap output <!-- rs:task=prof-ms-v0-3-exist-12-section-professional-roadmap-output -->
- [ ] `[P0]` roadmapProfile field in roadmap-skill.config.json <!-- rs:task=prof-ms-v0-3-exist-roadmapprofile-field-in-roadmap-skill-config-json -->
- [ ] `[P0]` product metadata block in config <!-- rs:task=prof-ms-v0-3-exist-product-metadata-block-in-config -->
- [ ] `[P0]` Sequential step model for Section 4 <!-- rs:task=prof-ms-v0-3-exist-sequential-step-model-for-section-4 -->

**What Must Be Stable:**

- [ ] `[P1]` compact profile output (backward compatible) <!-- rs:task=prof-ms-v0-3-stable-compact-profile-output-backward-compatible -->
- [ ] `[P1]` professional profile section structure <!-- rs:task=prof-ms-v0-3-stable-professional-profile-section-structure -->
- [ ] `[P1]` prof-step-N- task ID namespace <!-- rs:task=prof-ms-v0-3-stable-prof-step-n-task-id-namespace -->

**Intentionally Out of Scope:**

- Enterprise profile implementation
- AI-assisted roadmap generation beyond scan inference

### v1.0

**Goal:** Production readiness exit criteria met

**What Must Exist:**

- [ ] `[P0]` All test fixtures green across Node, Python, Go, Rust, generic <!-- rs:task=prof-ms-v1-0-exist-all-test-fixtures-green-across-node-python-go-rust-generic -->
- [ ] `[P0]` README.md showcases professional output with excerpt <!-- rs:task=prof-ms-v1-0-exist-readme-md-showcases-professional-output-with-excerpt -->
- [ ] `[P0]` SKILL.md documents profile selection <!-- rs:task=prof-ms-v1-0-exist-skill-md-documents-profile-selection -->
- [ ] `[P0]` Published to npm with stable semver <!-- rs:task=prof-ms-v1-0-exist-published-to-npm-with-stable-semver -->

**What Must Be Stable:**

- [ ] `[P1]` All CLI commands <!-- rs:task=prof-ms-v1-0-stable-all-cli-commands -->
- [ ] `[P1]` Config schema (roadmapProfile, product, milestones, phaseTemplates) <!-- rs:task=prof-ms-v1-0-stable-config-schema-roadmapprofile-product-milestones-phasetemplates -->
- [ ] `[P1]` Plugin hook signatures <!-- rs:task=prof-ms-v1-0-stable-plugin-hook-signatures -->

**Intentionally Out of Scope:**

- GUI or web interface
- Remote roadmap storage

## 6. Command-by-Command / Module-by-Module Maturity Path

### app

**Current state:** module detected in scan.

- [ ] `[P1]` Define maturity criteria and testability gates for app <!-- rs:task=prof-mat-app-define-maturity-criteria -->

### config

**Current state:** Supports roadmapProfile, product block, milestones, phaseTemplates, plugins.

- [ ] `[P1]` Add JSON schema validation for roadmap-skill.config.json <!-- rs:task=prof-mat-config-json-schema-validation -->

### generator

**Current state:** Compact and professional profiles supported; Phase→Step→Task model implemented.

- [ ] `[P0]` Improve Phase→Step→Task model inference quality <!-- rs:task=prof-mat-generator-improve-phase-step-task-inference -->
- [ ] `[P1]` Add scan-driven task suggestions per detected module <!-- rs:task=prof-mat-generator-scan-driven-task-suggestions -->

### io

**Current state:** Scans files, detects languages, test frameworks, commands, modules.

- [ ] `[P2]` Improve module detection for monorepo workspace layouts <!-- rs:task=prof-mat-io-monorepo-workspace-detection -->

### lib

**Current state:** module detected in scan.

- [ ] `[P1]` Define maturity criteria and testability gates for lib <!-- rs:task=prof-mat-lib-define-maturity-criteria -->

### match

**Current state:** Task similarity matching with edit-distance threshold.

- [ ] `[P0]` Tune similarity threshold to reduce false-positive merges <!-- rs:task=prof-mat-match-tune-similarity-threshold -->

### parser

**Current state:** Parses managed blocks, rs:task IDs, and checked state.

- [ ] `[P1]` Add parser validation for Phase→Step hierarchy markers <!-- rs:task=prof-mat-parser-phase-hierarchy-validation -->
- [ ] `[P1]` Improve section boundary detection for professional format <!-- rs:task=prof-mat-parser-professional-section-detection -->

### renderer

**Current state:** Dispatcher supports compact, professional, and enterprise (error) profiles.

- [ ] `[P0]` Add snapshot regression fixtures for compact and professional <!-- rs:task=prof-mat-renderer-snapshot-regression-fixtures -->
- [ ] `[P1]` Harden priority label rendering for edge cases <!-- rs:task=prof-mat-renderer-priority-label-edge-cases -->

## 7. Output Contract Roadmap

### Output Format

- [ ] `[P0]` Define stable public output format (stdout, files, exit codes) <!-- rs:task=prof-out-define-stable-public-output-format-stdout-files-exit-codes -->
- [ ] `[P1]` Version output format alongside package version <!-- rs:task=prof-out-version-output-format-alongside-package-version -->

### Breaking Changes

- [ ] `[P1]` Document breaking vs. non-breaking output changes <!-- rs:task=prof-out-document-breaking-vs-non-breaking-output-changes -->
- [ ] `[P1]` Add output schema validation to CI <!-- rs:task=prof-out-add-output-schema-validation-to-ci -->

## 8. Testing and Quality-Gate Roadmap

### Test Coverage

- [ ] `[P0]` Unit test coverage for all core modules <!-- rs:task=prof-test-unit-test-coverage-for-all-core-modules -->
- [ ] `[P0]` Integration tests covering the full generate → sync → validate pipeline <!-- rs:task=prof-test-integration-tests-covering-the-full-generate-sync-validate-pipeline -->
- [ ] `[P1]` Regression fixtures for compact and professional profile output <!-- rs:task=prof-test-regression-fixtures-for-compact-and-professional-profile-output -->
- [ ] `[P1]` Edge case coverage: empty repo, no config, large monorepo scan <!-- rs:task=prof-test-edge-case-coverage-empty-repo-no-config-large-monorepo-scan -->

### Quality Gates

- [ ] `[P0]` CI quality gate: tests must pass before merge <!-- rs:task=prof-test-ci-quality-gate-tests-must-pass-before-merge -->
- [ ] `[P0]` Block merge when generated roadmap loses checked state <!-- rs:task=prof-test-block-merge-when-generated-roadmap-loses-checked-state -->
- [ ] `[P1]` Add professional renderer snapshot tests <!-- rs:task=prof-test-add-professional-renderer-snapshot-tests -->

## 9. Distribution Roadmap

### npm Registry

- [ ] `[P0]` Publish to npm registry with stable semver <!-- rs:task=prof-dist-publish-to-npm-registry-with-stable-semver -->
- [ ] `[P0]` Ensure CLI binary is correctly linked in package.json `bin` <!-- rs:task=prof-dist-ensure-cli-binary-is-correctly-linked-in-package-json-bin -->

### Release Process

- [ ] `[P1]` Tag git releases aligned with npm publish <!-- rs:task=prof-dist-tag-git-releases-aligned-with-npm-publish -->
- [ ] `[P1]` Document install instructions for npm global and npx usage <!-- rs:task=prof-dist-document-install-instructions-for-npm-global-and-npx-usage -->

## 10. Documentation Roadmap

### Core Docs

- [ ] `[P0]` README.md covers install, commands, and profile selection <!-- rs:task=prof-doc-readme-md-covers-install-commands-and-profile-selection -->
- [ ] `[P0]` SKILL.md reflects current feature set and guardrails <!-- rs:task=prof-doc-skill-md-reflects-current-feature-set-and-guardrails -->
- [ ] `[P1]` CHANGELOG.md maintained for each release <!-- rs:task=prof-doc-changelog-md-maintained-for-each-release -->

### Showcase

- [ ] `[P1]` docs/ use-cases cover compact and professional profiles <!-- rs:task=prof-doc-docs-use-cases-cover-compact-and-professional-profiles -->
- [ ] `[P1]` Generated ROADMAP.md showcases professional Phase→Step→Task output <!-- rs:task=prof-doc-generated-roadmap-md-showcases-professional-phase-step-task-output -->

## 11. Risks, Constraints, and Anti-Goals

### Risks

- [ ] `[P0]` Inference quality degrades on very large monorepos (scan cap at 120 files) <!-- rs:task=prof-risk-inference-quality-degrades-on-very-large-monorepos-scan-cap-at-120-files -->
- [ ] `[P1]` Professional profile sections may feel over-structured for small hobby projects <!-- rs:task=prof-risk-professional-profile-sections-may-feel-over-structured-for-small-hobby-projects -->
- [ ] `[P1]` Task similarity matching may mis-merge tasks with overlapping language <!-- rs:task=prof-risk-task-similarity-matching-may-mis-merge-tasks-with-overlapping-language -->
- [ ] `[P1]` Roadmap drift if users edit the managed block directly instead of using the CLI <!-- rs:task=prof-risk-roadmap-drift-if-users-edit-the-managed-block-directly-instead-of-using-the-cli -->

### Anti-Goals

- Replace project management tools like Linear or Jira
- Require a backend service or database
- Generate roadmaps without real repository context
- Act as a project planning tool that replaces human judgment

## 12. 1.0 Measurable Success Criteria

- [ ] `[P0]` compact mode generates idempotent output on all fixture projects <!-- rs:task=prof-sc-compact-mode-generates-idempotent-output-on-all-fixture-projects -->
- [ ] `[P0]` professional mode renders all 12 required sections without errors <!-- rs:task=prof-sc-professional-mode-renders-all-12-required-sections-without-errors -->
- [ ] `[P0]` checked task state survives regeneration across both profiles <!-- rs:task=prof-sc-checked-task-state-survives-regeneration-across-both-profiles -->
- [ ] `[P0]` RoadmapSmith's own ROADMAP.md is generated entirely by RoadmapSmith itself <!-- rs:task=prof-sc-roadmapsmith-s-own-roadmap-md-is-generated-entirely-by-roadmapsmith-itself -->
- [ ] `[P0]` npm test passes with no failures on all fixture languages <!-- rs:task=prof-sc-npm-test-passes-with-no-failures-on-all-fixture-languages -->
<!-- rs:managed:end -->
