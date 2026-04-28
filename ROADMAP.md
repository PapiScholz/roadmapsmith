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

- [x] 38 implementation files across Go, JavaScript, Python, Rust <!-- rs:task=prof-state-impl-38-implementation-files-across-go-javascript-python-rust -->

### Scaffold / Partial

- [x] Module "config" partially implemented — coverage unknown <!-- rs:task=prof-state-scaffold-module-config-partially-implemented-coverage-unknown -->
- [x] Module "generator" partially implemented — coverage unknown <!-- rs:task=prof-state-scaffold-module-generator-partially-implemented-coverage-unknown -->
- [x] Module "io" partially implemented — coverage unknown <!-- rs:task=prof-state-scaffold-module-io-partially-implemented-coverage-unknown -->
- [x] Module "match" partially implemented — coverage unknown <!-- rs:task=prof-state-scaffold-module-match-partially-implemented-coverage-unknown -->
- [x] Module "parser" partially implemented — coverage unknown <!-- rs:task=prof-state-scaffold-module-parser-partially-implemented-coverage-unknown -->
- [x] Module "renderer" partially implemented — coverage unknown <!-- rs:task=prof-state-scaffold-module-renderer-partially-implemented-coverage-unknown -->

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

- [x] `[P0]` Preserve compact backward compatibility <!-- rs:task=prof-task-preserve-compact-backward-compatibility -->
- [x] `[P1]` Extract compact renderer to renderer/compact.js <!-- rs:task=prof-task-extract-compact-renderer -->
- [x] `[P2]` Add renderer dispatcher (renderBody) <!-- rs:task=prof-task-add-renderer-dispatcher -->

**Exit Criteria:**

- [x] `[P0]` Compact output remains byte-stable where expected <!-- rs:task=prof-ph1-st1-exit-compact-output-remains-byte-stable-where-expected -->
- [x] `[P1]` Professional profile renders all 12 sections <!-- rs:task=prof-ph1-st1-exit-professional-profile-renders-all-12-sections -->

#### Step 1.2: Model Improvements

**Step Priority:** `[P0]`
**Depends on:** None

**Objective:** Add Phase→Step→Task hierarchy and task-level priority to the professional model.

**Tasks:**

- [x] `[P0]` Add phasesDetailed model field <!-- rs:task=prof-task-add-phasesdetailed-model-field -->
- [x] `[P1]` Filter code vs doc TODOs in Known Limitations inference <!-- rs:task=prof-task-filter-code-vs-doc-todos -->
- [x] `[P1]` Add task-level priority rendering with [P0]/[P1] labels <!-- rs:task=prof-task-add-task-priority-rendering -->

**Exit Criteria:**

- [x] `[P0]` A P0 task inside a P2 step renders with [P0] label in correct step position <!-- rs:task=prof-ph1-st2-exit-a-p0-task-inside-a-p2-step-renders-with-p0-label-in-correct-step-position -->
- [x] `[P1]` Known Limitations no longer includes doc-only TODO mentions <!-- rs:task=prof-ph1-st2-exit-known-limitations-no-longer-includes-doc-only-todo-mentions -->

### Phase 2: Validation Quality

**Phase Priority:** `[P0]`

**Objective:** Harden evidence-based validation and reduce false-positive task matching.

#### Step 2.1: Evidence Validation Hardening

**Step Priority:** `[P0]`
**Depends on:** Phase 1

**Objective:** Fix false-positive validation and improve evidence scoring reliability.

**Tasks:**

- [x] `[P0]` Fix false-positive task similarity matching on overlapping text <!-- rs:task=prof-task-fix-false-positive-task-matching -->
- [x] `[P1]` Add fixture for doc-only TODO filtering test <!-- rs:task=prof-task-add-doc-only-todo-fixture -->
- [x] `[P1]` Improve evidence scoring for test file coverage <!-- rs:task=prof-task-improve-evidence-scoring -->

**Exit Criteria:**

- [x] `[P0]` All validation tests pass on node, python, go, rust fixtures <!-- rs:task=prof-ph2-st1-exit-all-validation-tests-pass-on-node-python-go-rust-fixtures -->
- [x] `[P0]` No false-positive task merges on similar-text tasks <!-- rs:task=prof-ph2-st1-exit-no-false-positive-task-merges-on-similar-text-tasks -->

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

- [x] `[P0]` Publish stable semver to npm <!-- rs:task=prof-task-publish-stable-semver-to-npm -->
- [x] `[P1]` Tag git release aligned with npm publish <!-- rs:task=prof-task-tag-git-release-aligned-with-npm -->
- [x] `[P1]` Document npm global and npx install instructions <!-- rs:task=prof-task-document-npx-install-instructions -->

**Exit Criteria:**

- [x] `[P0]` npm publish succeeds and package is installable via npx roadmapsmith <!-- rs:task=prof-ph3-st2-exit-npm-publish-succeeds-and-package-is-installable-via-npx-roadmapsmith -->
- [x] `[P1]` Git tag matches npm version <!-- rs:task=prof-ph3-st2-exit-git-tag-matches-npm-version -->

## 5. Versioned Milestones

### v0.1

**Goal:** Foundation baseline complete

**What Must Exist:**

- [x] `[P0]` CLI binary with init, generate, sync, validate commands <!-- rs:task=prof-ms-v0-1-exist-cli-binary-with-init-generate-sync-validate-commands -->
- [x] `[P0]` Parser correctly extracts rs:task IDs and checked state <!-- rs:task=prof-ms-v0-1-exist-parser-correctly-extracts-rs-task-ids-and-checked-state -->
- [x] `[P0]` Managed block preserved across regeneration <!-- rs:task=prof-ms-v0-1-exist-managed-block-preserved-across-regeneration -->

**What Must Be Stable:**

- [x] `[P1]` rs:task ID slugification algorithm — _Stable as of v0.5.1 — locked by test/utils.test.js. Meta-declaration: not evidence-scannable by sync._ <!-- rs:task=prof-ms-v0-1-stable-rs-task-id-slugification-algorithm -->
- [x] `[P1]` managed block start/end marker format <!-- rs:task=prof-ms-v0-1-stable-managed-block-start-end-marker-format -->

**Intentionally Out of Scope:**

- Multiple roadmap profiles
- Plugin system
- Enterprise features

### v0.2

**Goal:** Core feature coverage stabilized

**What Must Exist:**

- [x] `[P0]` Evidence-based validation (code, test, artifact) <!-- rs:task=prof-ms-v0-2-exist-evidence-based-validation-code-test-artifact -->
- [x] `[P0]` Plugin hook system (registerTaskDetectors, registerValidators) <!-- rs:task=prof-ms-v0-2-exist-plugin-hook-system-registertaskdetectors-registervalidators -->
- [x] `[P0]` Multi-language fixture test suite (Node, Python, Go, Rust) <!-- rs:task=prof-ms-v0-2-exist-multi-language-fixture-test-suite-node-python-go-rust -->

**What Must Be Stable:**

- [x] `[P1]` Validation evidence scoring algorithm <!-- rs:task=prof-ms-v0-2-stable-validation-evidence-scoring-algorithm -->
- [x] `[P1]` Task similarity matching threshold <!-- rs:task=prof-ms-v0-2-stable-task-similarity-matching-threshold -->

**Intentionally Out of Scope:**

- Professional roadmap profile
- Product metadata config block

### v0.3

**Goal:** Professional roadmap profile and renderer architecture

**What Must Exist:**

- [x] `[P0]` Renderer architecture with compact and professional profiles <!-- rs:task=prof-ms-v0-3-exist-renderer-architecture-with-compact-and-professional-profiles -->
- [x] `[P0]` 12-section professional roadmap output <!-- rs:task=prof-ms-v0-3-exist-12-section-professional-roadmap-output -->
- [x] `[P0]` roadmapProfile field in roadmap-skill.config.json <!-- rs:task=prof-ms-v0-3-exist-roadmapprofile-field-in-roadmap-skill-config-json -->
- [x] `[P0]` product metadata block in config <!-- rs:task=prof-ms-v0-3-exist-product-metadata-block-in-config -->
- [x] `[P0]` Sequential step model for Section 4 <!-- rs:task=prof-ms-v0-3-exist-sequential-step-model-for-section-4 -->

**What Must Be Stable:**

- [x] `[P1]` compact profile output (backward compatible) <!-- rs:task=prof-ms-v0-3-stable-compact-profile-output-backward-compatible -->
- [x] `[P1]` professional profile section structure <!-- rs:task=prof-ms-v0-3-stable-professional-profile-section-structure -->
- [x] `[P1]` prof-step-N- task ID namespace — _Stable as of v0.5.1 — locked by exit criteria ID format and checked-state roundtrip tests in generator.test.js. Meta-declaration: not evidence-scannable by sync._ <!-- rs:task=prof-ms-v0-3-stable-prof-step-n-task-id-namespace -->

**Intentionally Out of Scope:**

- Enterprise profile implementation
- AI-assisted roadmap generation beyond scan inference

### v1.0

**Goal:** Production readiness exit criteria met

**What Must Exist:**

- [x] `[P0]` All test fixtures green across Node, Python, Go, Rust, generic <!-- rs:task=prof-ms-v1-0-exist-all-test-fixtures-green-across-node-python-go-rust-generic -->
- [x] `[P0]` README.md showcases professional output with excerpt <!-- rs:task=prof-ms-v1-0-exist-readme-md-showcases-professional-output-with-excerpt -->
- [x] `[P0]` SKILL.md documents profile selection <!-- rs:task=prof-ms-v1-0-exist-skill-md-documents-profile-selection -->
- [x] `[P0]` Published to npm with stable semver <!-- rs:task=prof-ms-v1-0-exist-published-to-npm-with-stable-semver -->

**What Must Be Stable:**

- [x] `[P1]` All CLI commands <!-- rs:task=prof-ms-v1-0-stable-all-cli-commands -->
- [x] `[P1]` Config schema (roadmapProfile, product, milestones, phaseTemplates) <!-- rs:task=prof-ms-v1-0-stable-config-schema-roadmapprofile-product-milestones-phasetemplates -->
- [x] `[P1]` Plugin hook signatures <!-- rs:task=prof-ms-v1-0-stable-plugin-hook-signatures -->

**Intentionally Out of Scope:**

- GUI or web interface
- Remote roadmap storage

### v0.8

**Goal:** Project Intelligence — useful output for real-world repositories

**What Must Exist:**

- [x] `[P0]` Repository classifier engine with confidence scoring <!-- rs:task=prof-ms-v0-8-exist-classifier-engine-with-confidence-scoring -->
- [x] `[P0]` Domain-specific roadmap profile: web/landing (generates SEO, metadata, responsive, performance, contact, deployment tasks) <!-- rs:task=prof-ms-v0-8-exist-web-landing-domain-profile -->
- [ ] `[P0]` Explicit path extractor rejects conceptual slash-phrases (start/end, code/test/artifact, input/output, etc.) <!-- rs:task=prof-ms-v0-8-exist-path-extractor-rejects-conceptual-phrases -->
  - ⚠️ attempted but validation failed: missing referenced file(s): code/test/artifact
- [x] `[P0]` Customer fixture: website/landing repo with smoke test assertions <!-- rs:task=prof-ms-v0-8-exist-website-customer-fixture -->
- [x] `[P1]` "Detected Project Profile" section in generated ROADMAP.md <!-- rs:task=prof-ms-v0-8-exist-detected-project-profile-section -->
- [x] `[P1]` projectType override in roadmap-skill.config.json <!-- rs:task=prof-ms-v0-8-exist-project-type-override-config -->

**What Must Be Stable:**

- [x] `[P1]` Existing compact and professional profiles unchanged — _must not regress_ <!-- rs:task=prof-ms-v0-8-stable-compact-professional-profiles-unchanged -->
- [x] `[P1]` Evidence-backed philosophy unchanged; repository remains the authority — _no AI-guessed classification_ <!-- rs:task=prof-ms-v0-8-stable-evidence-backed-philosophy -->

**Intentionally Out of Scope:**

- AI-assisted project classification (all detection must be filesystem-evidence-based)
- GUI or visual project inspector

## 6. Command-by-Command / Module-by-Module Maturity Path

### config

**Current state:** Supports roadmapProfile, product block, milestones, phaseTemplates, plugins.

- [x] `[P1]` Add JSON schema validation for roadmap-skill.config.json <!-- rs:task=prof-mat-config-json-schema-validation -->

### generator

**Current state:** Compact and professional profiles supported; Phase→Step→Task model implemented.

- [x] `[P0]` Improve Phase→Step→Task model inference quality <!-- rs:task=prof-mat-generator-improve-phase-step-task-inference -->
- [x] `[P1]` Add scan-driven task suggestions per detected module <!-- rs:task=prof-mat-generator-scan-driven-task-suggestions -->

### io

**Current state:** Scans files, detects languages, test frameworks, commands, modules.

- [x] `[P2]` Improve module detection for monorepo workspace layouts <!-- rs:task=prof-mat-io-monorepo-workspace-detection -->

### match

**Current state:** Task similarity matching with edit-distance threshold.

- [x] `[P0]` Tune similarity threshold to reduce false-positive merges <!-- rs:task=prof-mat-match-tune-similarity-threshold -->

### parser

**Current state:** Parses managed blocks, rs:task IDs, and checked state.

- [x] `[P1]` Add parser validation for Phase→Step hierarchy markers <!-- rs:task=prof-mat-parser-phase-hierarchy-validation -->
- [x] `[P1]` Improve section boundary detection for professional format <!-- rs:task=prof-mat-parser-professional-section-detection -->

### renderer

**Current state:** Dispatcher supports compact, professional, and enterprise (error) profiles.

- [x] `[P0]` Add snapshot regression fixtures for compact and professional <!-- rs:task=prof-mat-renderer-snapshot-regression-fixtures -->
- [x] `[P1]` Harden priority label rendering for edge cases <!-- rs:task=prof-mat-renderer-priority-label-edge-cases -->

### sync

**Current state:** module detected in scan.

- [x] `[P1]` Define maturity criteria and testability gates for sync <!-- rs:task=prof-mat-sync-define-maturity-criteria -->

### classifier

**Current state:** not yet implemented — required for Project Intelligence (v0.8).

- [x] `[P0]` Implement archetype detection from filesystem, package.json, and config evidence <!-- rs:task=prof-mat-classifier-implement-archetype-detection -->
- [x] `[P0]` Support initial archetypes: frontend-web, landing-site, docs-site, cli-tool, npm-package, python-package, monorepo, api-service, unknown-generic <!-- rs:task=prof-mat-classifier-support-initial-archetypes -->
- [x] `[P0]` Add confidence scoring; fall back to unknown-generic when confidence is low <!-- rs:task=prof-mat-classifier-confidence-scoring -->
- [x] `[P1]` Expose detected archetype in generated roadmap "Detected Project Profile" section <!-- rs:task=prof-mat-classifier-expose-archetype-in-roadmap -->

### templates

**Current state:** module detected in scan.

- [x] `[P1]` Define maturity criteria and testability gates for templates <!-- rs:task=prof-mat-templates-define-maturity-criteria -->

## 7. Output Contract Roadmap

### Output Format

- [x] `[P0]` Define stable public output format (stdout, files, exit codes) <!-- rs:task=prof-out-define-stable-public-output-format-stdout-files-exit-codes -->
- [x] `[P1]` Version output format alongside package version <!-- rs:task=prof-out-version-output-format-alongside-package-version -->

### Breaking Changes

- [x] `[P1]` Document breaking vs. non-breaking output changes <!-- rs:task=prof-out-document-breaking-vs-non-breaking-output-changes -->
- [x] `[P1]` Add output schema validation to CI <!-- rs:task=prof-out-add-output-schema-validation-to-ci -->

## 8. Testing and Quality-Gate Roadmap

### Test Coverage

- [x] `[P0]` Unit test coverage for all core modules <!-- rs:task=prof-test-unit-test-coverage-for-all-core-modules -->
- [x] `[P0]` Integration tests covering the full generate → sync → validate pipeline <!-- rs:task=prof-test-integration-tests-covering-the-full-generate-sync-validate-pipeline -->
- [x] `[P1]` Regression fixtures for compact and professional profile output <!-- rs:task=prof-test-regression-fixtures-for-compact-and-professional-profile-output -->
- [x] `[P1]` Edge case coverage: empty repo, no config, large monorepo scan <!-- rs:task=prof-test-edge-case-coverage-empty-repo-no-config-large-monorepo-scan -->
- [x] `[P0]` Customer smoke tests: website/landing fixture → generate → validate --json → sync --audit <!-- rs:task=prof-test-customer-smoke-tests-website-fixture -->
- [ ] `[P0]` Regression tests: conceptual slash-phrases never produce missing-file warnings — covers start/end, code/test/artifact, input/output, read/write, client/server, request/response, build/test/deploy, filesystem/package/config, main/exports/files <!-- rs:task=prof-test-conceptual-phrase-regression-tests -->
  - ⚠️ attempted but validation failed: missing referenced file(s): build/test/deploy, code/test/artifact, filesystem/package/config, main/exports/files
- [x] `[P1]` Assertion: website fixture ROADMAP.md contains SEO, metadata, responsive/mobile, performance, contact, deployment terms <!-- rs:task=prof-test-website-fixture-contains-domain-terms -->

### Quality Gates

- [x] `[P0]` CI quality gate: tests must pass before merge <!-- rs:task=prof-test-ci-quality-gate-tests-must-pass-before-merge -->
- [x] `[P0]` Block merge when generated roadmap loses checked state <!-- rs:task=prof-test-block-merge-when-generated-roadmap-loses-checked-state -->
- [x] `[P1]` Add professional renderer snapshot tests <!-- rs:task=prof-test-add-professional-renderer-snapshot-tests -->
- [x] `[P0]` Block merge when website fixture produces false missing-file warnings for conceptual slash-phrases <!-- rs:task=prof-test-block-merge-website-false-path-warnings -->
- [x] `[P1]` Block merge when website fixture ROADMAP.md lacks web-specific terms (SEO, responsive, performance, deployment) <!-- rs:task=prof-test-block-merge-website-missing-domain-terms -->

## 9. Distribution Roadmap

### npm Registry

- [x] `[P0]` Publish to npm registry with stable semver <!-- rs:task=prof-dist-publish-to-npm-registry-with-stable-semver -->
- [x] `[P0]` Ensure CLI binary is correctly linked in package.json `bin` <!-- rs:task=prof-dist-ensure-cli-binary-is-correctly-linked-in-package-json-bin -->

### Release Process

- [x] `[P1]` Tag git releases aligned with npm publish <!-- rs:task=prof-dist-tag-git-releases-aligned-with-npm-publish -->
- [x] `[P1]` Document install instructions for npm global and npx usage <!-- rs:task=prof-dist-document-install-instructions-for-npm-global-and-npx-usage -->

## 10. Documentation Roadmap

### Core Docs

- [x] `[P0]` README.md covers install, commands, and profile selection <!-- rs:task=prof-doc-readme-md-covers-install-commands-and-profile-selection -->
- [x] `[P0]` SKILL.md reflects current feature set and guardrails <!-- rs:task=prof-doc-skill-md-reflects-current-feature-set-and-guardrails -->
- [x] `[P1]` CHANGELOG.md maintained for each release <!-- rs:task=prof-doc-changelog-md-maintained-for-each-release -->

### Showcase

- [x] `[P1]` docs/ use-cases cover compact and professional profiles <!-- rs:task=prof-doc-docs-use-cases-cover-compact-and-professional-profiles -->
- [x] `[P1]` Generated ROADMAP.md showcases professional Phase→Step→Task output <!-- rs:task=prof-doc-generated-roadmap-md-showcases-professional-phase-step-task-output -->

## 11. Risks, Constraints, and Anti-Goals

### Risks

- [x] `[P0]` Inference quality degrades on very large monorepos (scan cap at 120 files) <!-- rs:task=prof-risk-inference-quality-degrades-on-very-large-monorepos-scan-cap-at-120-files -->
- [x] `[P1]` Professional profile sections may feel over-structured for small hobby projects <!-- rs:task=prof-risk-professional-profile-sections-may-feel-over-structured-for-small-hobby-projects -->
- [x] `[P1]` Task similarity matching may mis-merge tasks with overlapping language <!-- rs:task=prof-risk-task-similarity-matching-may-mis-merge-tasks-with-overlapping-language -->
- [x] `[P1]` Roadmap drift if users edit the managed block directly instead of using the CLI <!-- rs:task=prof-risk-roadmap-drift-if-users-edit-the-managed-block-directly-instead-of-using-the-cli -->

### Anti-Goals

- Replace project management tools like Linear or Jira
- Require a backend service or database
- Generate roadmaps without real repository context
- Act as a project planning tool that replaces human judgment

## 12. 1.0 Measurable Success Criteria

- [x] `[P0]` compact mode generates idempotent output on all fixture projects <!-- rs:task=prof-sc-compact-mode-generates-idempotent-output-on-all-fixture-projects -->
- [x] `[P0]` professional mode renders all 12 required sections without errors <!-- rs:task=prof-sc-professional-mode-renders-all-12-required-sections-without-errors -->
- [x] `[P0]` checked task state survives regeneration across both profiles <!-- rs:task=prof-sc-checked-task-state-survives-regeneration-across-both-profiles -->
- [x] `[P0]` RoadmapSmith's own ROADMAP.md is generated entirely by RoadmapSmith itself <!-- rs:task=prof-sc-roadmapsmith-s-own-roadmap-md-is-generated-entirely-by-roadmapsmith-itself -->
- [x] `[P0]` npm test passes with no failures on all fixture languages <!-- rs:task=prof-sc-npm-test-passes-with-no-failures-on-all-fixture-languages -->
- [x] `[P0]` Running on a website repo produces ≥5 project-specific web/landing tasks <!-- rs:task=prof-sc-website-repo-produces-web-specific-tasks -->
- [ ] `[P0]` Validation never emits "missing referenced file(s): code/test/artifact" <!-- rs:task=prof-sc-no-code-test-artifact-false-positive -->
  - ⚠️ attempted but validation failed: missing referenced file(s): code/test/artifact
- [ ] `[P0]` Validation never emits missing-file warnings for conceptual slash-phrases: start/end, input/output, read/write, client/server, request/response, build/test/deploy, filesystem/package/config, main/exports/files <!-- rs:task=prof-sc-no-conceptual-phrase-false-positives -->
  - ⚠️ attempted but validation failed: missing referenced file(s): build/test/deploy, filesystem/package/config, main/exports/files
- [x] `[P1]` Generated ROADMAP.md for website repo contains: SEO, metadata, OpenGraph, responsive/mobile, performance, contact, deployment/hosting terms <!-- rs:task=prof-sc-website-roadmap-contains-domain-terms -->
- [x] `[P1]` roadmapsmith validate --json produces explainable evidence results on all fixture types including website <!-- rs:task=prof-sc-validate-json-explainable-all-fixtures -->
- [x] `[P1]` roadmapsmith sync --audit reports real mismatches only — no conceptual-phrase false positives <!-- rs:task=prof-sc-sync-audit-no-false-mismatches -->
- [x] `[P0]` roadmapsmith sync --audit on this roadmap does not auto-complete classifier or domain-generation tasks until actual source code and tests exist <!-- rs:task=prof-sc-no-self-referential-autocomplete -->
- [x] `[P0]` The classifier module is not considered complete unless source code and tests exist — ROADMAP.md text alone is not evidence <!-- rs:task=prof-sc-classifier-requires-code-evidence -->
- [x] `[P0]` The web/landing domain profile is not considered complete unless generation code and fixture tests exist — documentation alone is not evidence <!-- rs:task=prof-sc-web-profile-requires-code-evidence -->
- [x] `[P0]` ROADMAP.md text, README content, and documentation files alone never satisfy implementation evidence for any task <!-- rs:task=prof-sc-roadmap-text-not-evidence -->

## 13. Market Readiness Roadmap

### Phase 4: Launch Preparation

**Phase Priority:** `[P1]`
**Objective:** Prepare repository for public release and initial adoption.

#### Step 4.1: Repository Polish

**Step Priority:** `[P1]`
**Depends on:** Phase 3

**Objective:** Align metadata, improve discoverability, and add visual assets.

**Tasks:**

- [x] `[P0]` Align versions across package.json, skills.json, plugin.json <!-- rs:task=mkt-p0-align-versions-package-skills-plugin -->
- [x] `[P0]` Improve package.json keywords and description for discoverability <!-- rs:task=mkt-p0-improve-package-json-keywords-description -->
- [x] `[P1]` Add demo.gif or placeholder to README <!-- rs:task=mkt-p0-add-demo-gif-placeholder -->
- [x] `[P1]` Move Quick Start section to top of README <!-- rs:task=mkt-p0-move-quick-start-to-top-readme -->
- [x] `[P1]` Add badges (npm version, CI status, license) to README <!-- rs:task=mkt-p0-add-badges-npm-ci-license -->
- [x] `[P1]` Add comparison table (vs TODO.md, GitHub Issues, etc.) to README <!-- rs:task=mkt-p0-add-comparison-table -->
- [x] `[P2]` Add GitHub Actions audit template example <!-- rs:task=mkt-p0-add-github-actions-audit-template -->
- [x] `[P2]` Add SECURITY.md <!-- rs:task=mkt-p0-add-security-md -->

**Exit Criteria:**

- [x] `[P0]` All version strings match across package.json, skills.json, plugin.json <!-- rs:task=mkt-ph4-st1-exit-version-strings-aligned -->
- [x] `[P1]` README Quick Start is the first user-facing section <!-- rs:task=mkt-ph4-st1-exit-quick-start-at-top -->

### Phase 5: Reliability Hardening

**Phase Priority:** `[P0]`
**Objective:** Improve validation trust and operational robustness.

#### Step 5.1: Validation Confidence

**Step Priority:** `[P0]`
**Depends on:** Phase 4

**Objective:** Design and expose confidence levels to reduce false-positive validation.

**Tasks:**

- [x] `[P0]` Add validation confidence levels (design or scaffold if not implemented) <!-- rs:task=mkt-p1-add-validation-confidence-levels -->
- [x] `[P0]` Add config option: validation.minimumConfidence <!-- rs:task=mkt-p1-add-config-validation-minimum-confidence -->
- [x] `[P1]` Add `roadmapsmith doctor` command (scaffold or planned) <!-- rs:task=mkt-p1-add-roadmapsmith-doctor-command -->
- [x] `[P1]` Add docs/use-cases/ci-audit.md <!-- rs:task=mkt-p1-add-docs-use-cases-ci-audit -->
- [x] `[P1]` Add docs/use-cases/claude-code.md <!-- rs:task=mkt-p1-add-docs-use-cases-claude-code -->
- [x] `[P2]` Add docs/limitations.md (consolidate existing known limitations) <!-- rs:task=mkt-p1-add-docs-limitations -->

**Exit Criteria:**

- [x] `[P0]` validation.minimumConfidence config field accepted without errors <!-- rs:task=mkt-ph5-st1-exit-minimum-confidence-config-accepted -->
- [x] `[P1]` roadmapsmith doctor exits 0 on a healthy repo <!-- rs:task=mkt-ph5-st1-exit-doctor-exits-zero-healthy-repo -->

### Phase 6: Distribution

**Phase Priority:** `[P1]`
**Objective:** Publish and distribute the tool across ecosystems.

#### Step 6.1: Release and Channels

**Step Priority:** `[P0]`
**Depends on:** Phase 4, Phase 5

**Objective:** Cut v0.6.0 release and publish to all relevant channels.

**Tasks:**

- [x] `[P0]` Prepare and cut GitHub release v0.6.0 <!-- rs:task=mkt-p2-github-release-v060 -->
- [x] `[P0]` Publish npm release v0.6.0 <!-- rs:task=mkt-p2-npm-release-v060 -->
- [x] `[P1]` Publish or update skills.sh entry <!-- rs:task=mkt-p2-publish-skills-sh-entry -->
- [x] `[P1]` Evaluate MCP Market and skill.fish publishing <!-- rs:task=mkt-p2-evaluate-mcp-market-skill-fish -->
- [ ] `[P2]` Create launch post (LinkedIn) <!-- rs:task=mkt-p2-create-launch-post-linkedin -->
- [x] `[P2]` Add GitHub issue templates (bug, feature, false-positive) <!-- rs:task=mkt-p2-add-issue-templates -->

**Exit Criteria:**

- [x] `[P0]` npm install -g roadmapsmith@0.6.0 succeeds <!-- rs:task=mkt-ph6-st1-exit-npm-install-v060-succeeds -->
- [x] `[P0]` GitHub release v0.6.0 published with release notes <!-- rs:task=mkt-ph6-st1-exit-github-release-v060-published -->
- [x] `[P1]` skills.sh entry updated or submitted <!-- rs:task=mkt-ph6-st1-exit-skills-sh-entry-updated -->

### Phase 7: Repository Classification Engine

**Phase Priority:** `[P0]`
**Objective:** Introduce deterministic, evidence-based archetype detection before roadmap generation. This is the foundation for all domain-specific output in Phase 8.

#### Step 7.1: Archetype Detection

**Step Priority:** `[P0]`
**Depends on:** Phase 5

**Objective:** Build a classifier module that detects project archetypes from filesystem, package.json, and config evidence — never from guesses.

**Tasks:**

- [ ] `[P0]` Introduce repository classification engine (classifier module) <!-- rs:task=cls-introduce-classifier-module -->
  - ⚠️ attempted but validation failed: missing test evidence
- [x] `[P0]` Detect frontend-web signals: app/, pages/, components/, public/, assets/, next.config.*, vite.config.*, astro.config.*, CSS/Tailwind config, package.json deps (next, react, vue, svelte, astro) <!-- rs:task=cls-detect-frontend-web-signals -->
- [x] `[P0]` Detect cli-tool signals: bin/ directory, shebang headers, package.json bin field <!-- rs:task=cls-detect-cli-tool-signals -->
- [x] `[P0]` Detect npm-package signals: package.json main, exports, and files fields without bin field <!-- rs:task=cls-detect-npm-package-signals -->
- [x] `[P0]` Detect python-package signals: setup.py, pyproject.toml, src/ layout <!-- rs:task=cls-detect-python-package-signals -->
- [x] `[P0]` Detect docs-site signals: docs/, mkdocs.yml, docusaurus.config.*, _config.yml <!-- rs:task=cls-detect-docs-site-signals -->
- [x] `[P0]` Detect monorepo signals: packages/, apps/, lerna.json, pnpm-workspace.yaml, workspace config <!-- rs:task=cls-detect-monorepo-signals -->
- [x] `[P0]` Detect api-service signals: routes/, controllers/, Dockerfile, openapi.yaml <!-- rs:task=cls-detect-api-service-signals -->
- [x] `[P0]` Add confidence scoring; fall back to unknown-generic when confidence is low <!-- rs:task=cls-add-confidence-scoring -->
- [x] `[P1]` Distinguish landing-site from generic frontend-web using route count, marketing copy signals, og/meta tags presence <!-- rs:task=cls-distinguish-landing-site -->

**Exit Criteria:**

- [x] `[P0]` NANDI-like website fixture classified as landing-site or frontend-web (not unknown-generic) <!-- rs:task=cls-ph7-st1-exit-nandi-fixture-classified-correctly -->
- [x] `[P0]` RoadmapSmith's own repo classified as cli-tool or npm-package <!-- rs:task=cls-ph7-st1-exit-roadmapsmith-classified-correctly -->
- [x] `[P1]` Confidence score surfaced in roadmap generation debug/audit output <!-- rs:task=cls-ph7-st1-exit-confidence-score-in-debug -->

### Phase 8: Domain-Specific Roadmap Generation

**Phase Priority:** `[P0]`
**Objective:** Generate project-specific roadmap tasks based on detected archetype — the tool must produce useful output for real-world repositories, not generic governance templates.

#### Step 8.1: Web / Landing Profile

**Step Priority:** `[P0]`
**Depends on:** Phase 7

**Objective:** Add a web/landing roadmap profile that generates evidence-validatable, project-specific tasks for frontend and landing-site archetypes.

**Tasks:**

- [x] `[P0]` Add web/landing roadmap profile driven by detected archetype <!-- rs:task=dsg-add-web-landing-profile -->
- [x] `[P0]` Generate SEO metadata tasks when archetype is frontend-web or landing-site <!-- rs:task=dsg-generate-seo-metadata-tasks -->
- [x] `[P0]` Generate OpenGraph/Twitter card tasks <!-- rs:task=dsg-generate-opengraph-tasks -->
- [x] `[P0]` Generate responsive/mobile layout tasks <!-- rs:task=dsg-generate-responsive-mobile-tasks -->
- [x] `[P0]` Generate accessibility baseline tasks (WCAG AA) <!-- rs:task=dsg-generate-accessibility-tasks -->
- [x] `[P0]` Generate performance/Lighthouse readiness tasks <!-- rs:task=dsg-generate-performance-tasks -->
- [x] `[P1]` Generate branding consistency tasks <!-- rs:task=dsg-generate-branding-tasks -->
- [x] `[P1]` Generate landing page structure and service/content section tasks <!-- rs:task=dsg-generate-landing-structure-tasks -->
- [x] `[P1]` Generate contact form or conversion flow tasks <!-- rs:task=dsg-generate-contact-conversion-tasks -->
- [x] `[P1]` Generate deployment/hosting readiness tasks <!-- rs:task=dsg-generate-deployment-tasks -->
- [x] `[P1]` Generate analytics/observability tasks where repository evidence supports it <!-- rs:task=dsg-generate-analytics-tasks -->
- [x] `[P1]` Generate security headers/basic web hardening tasks where evidence supports it <!-- rs:task=dsg-generate-security-headers-tasks -->
- [x] `[P0]` Keep generation deterministic: same repo state must produce same roadmap output <!-- rs:task=dsg-keep-generation-deterministic -->
- [x] `[P0]` All generated tasks must be evidence-validatable against repository files <!-- rs:task=dsg-tasks-must-be-evidence-validatable -->
- [x] `[P0]` Avoid generic filler tasks (e.g. "stabilize delivery paths") unless repository evidence supports them <!-- rs:task=dsg-avoid-generic-filler-tasks -->
- [x] `[P1]` Include project name and domain hints when detectable from package.json, README, metadata, title, or config <!-- rs:task=dsg-include-project-name-hints -->

**Exit Criteria:**

- [x] `[P0]` NANDI-like fixture roadmap contains ≥5 of: SEO, metadata, OpenGraph, responsive, mobile, performance, contact, deployment <!-- rs:task=dsg-ph8-st1-exit-nandi-fixture-contains-web-terms -->
- [x] `[P0]` `grep -Ei "seo|metadata|opengraph|responsive|mobile|performance|contact|deploy"` returns ≥5 matches in generated ROADMAP.md for website fixture <!-- rs:task=dsg-ph8-st1-exit-grep-web-terms-pass -->
- [x] `[P1]` Same fixture re-run produces byte-stable output (determinism preserved) <!-- rs:task=dsg-ph8-st1-exit-determinism-preserved -->

### Phase 9: Evidence Validation Hardening v2

**Phase Priority:** `[P0]`
**Objective:** Eliminate false-positive missing-file warnings for conceptual slash-phrases — the same class of bug as the earlier start/end false positive, now triggered by phrases like "code/test/artifact".

#### Step 9.1: Strict Explicit Path Parser

**Step Priority:** `[P0]`
**Depends on:** Phase 5

**Objective:** Replace the naive slash-path regex with a stricter parser that requires strong file/path evidence before treating a token as an explicit file reference.

**Tasks:**

- [x] `[P0]` Replace naive slash-path regex with a stricter explicit path parser <!-- rs:task=evh2-replace-naive-slash-path-regex -->
- [x] `[P0]` Require at least one strong path signal: known extension (.ts .js .py .go .rs .md .json .yaml .yml .toml .sh .css .html), leading ./ ../ / or .github/ prefix, or known directory prefix (src/ app/ lib/ docs/ test/ tests/ components/ packages/ public/ assets/) <!-- rs:task=evh2-require-strong-path-signal -->
- [ ] `[P0]` Add structural denylist for conceptual slash-phrases: start/end, code/test/artifact, input/output, read/write, client/server, on/off, yes/no, request/response, build/test/deploy, filesystem/package/config, main/exports/files <!-- rs:task=evh2-add-conceptual-phrase-denylist -->
  - ⚠️ attempted but validation failed: missing referenced file(s): build/test/deploy, code/test/artifact, filesystem/package/config, main/exports/files
- [x] `[P0]` Add regression tests covering all denylist phrases — none must produce missing-file warnings <!-- rs:task=evh2-add-denylist-regression-tests -->
- [x] `[P0]` Add regression tests confirming valid paths still parse: src/index.ts, app/page.tsx, components/Navbar.tsx, .github/workflows/ci.yml <!-- rs:task=evh2-add-valid-path-regression-tests -->
- [x] `[P0]` Block self-referential validation: ROADMAP.md, README, and documentation files must not be accepted as implementation evidence for any implementation task <!-- rs:task=evh2-block-self-referential-validation -->
- [x] `[P0]` Documentation-only mentions must not complete implementation tasks — validator must require source code or test file evidence, not doc/roadmap text matches <!-- rs:task=evh2-docs-not-implementation-evidence -->
- [x] `[P1]` Add backtick-quoted path detection as a positive signal <!-- rs:task=evh2-add-backtick-path-signal -->
- [x] `[P1]` Log rejected conceptual phrases in debug/audit mode only — never in normal output <!-- rs:task=evh2-log-rejected-phrases-debug-only -->

**Exit Criteria:**

- [ ] `[P0]` `roadmapsmith validate --json` does not emit "missing referenced file(s): code/test/artifact" <!-- rs:task=evh2-ph9-st1-exit-no-code-test-artifact-warning -->
  - ⚠️ attempted but validation failed: missing referenced file(s): code/test/artifact
- [ ] `[P0]` `roadmapsmith validate --json` does not emit missing-file warnings for start/end, input/output, read/write, client/server, request/response, build/test/deploy, filesystem/package/config, main/exports/files <!-- rs:task=evh2-ph9-st1-exit-no-conceptual-phrase-warnings -->
  - ⚠️ attempted but validation failed: missing referenced file(s): build/test/deploy, filesystem/package/config, main/exports/files
- [x] `[P0]` All explicit path regression tests pass <!-- rs:task=evh2-ph9-st1-exit-path-regression-tests-pass -->
- [x] `[P0]` Validation does not auto-complete any task based solely on ROADMAP.md, README, or documentation content <!-- rs:task=evh2-ph9-st1-exit-no-self-referential-validation -->
- [x] `[P1]` Existing validation tests on node, python, go, rust fixtures still pass <!-- rs:task=evh2-ph9-st1-exit-existing-fixtures-still-pass -->

### Phase 10: Customer Smoke Tests and UX

**Phase Priority:** `[P0]`
**Objective:** Validate end-to-end that RoadmapSmith produces genuinely useful output for a real-world website repository, and surface the detected project type clearly in the generated roadmap.

#### Step 10.1: Website Fixture and Smoke Tests

**Step Priority:** `[P0]`
**Depends on:** Phase 7, Phase 8, Phase 9

**Objective:** Create a customer-style website fixture and add assertions that cover both usefulness (web-specific tasks present) and correctness (no false missing-file warnings).

**Tasks:**

- [x] `[P0]` Create customer-style fixture representing a website/landing repo similar to NANDI <!-- rs:task=cst-create-website-fixture -->
- [x] `[P0]` Add test assertion: generated ROADMAP.md contains SEO, metadata, OpenGraph, responsive, mobile, performance, contact, deployment/hosting <!-- rs:task=cst-assert-web-terms-present -->
- [x] `[P0]` Add test assertion: generated ROADMAP.md does not contain false missing-file warnings for conceptual slash-phrases <!-- rs:task=cst-assert-no-false-path-warnings -->
- [x] `[P0]` Add CLI smoke test flow for website fixture: generate → validate --json → sync --audit <!-- rs:task=cst-add-cli-smoke-test-flow -->
- [x] `[P1]` Add skill/customer flow test or documented manual test: npx skills add roadmap-sync → agent generates roadmap → output evaluated for usefulness, not only technical validity <!-- rs:task=cst-add-skill-customer-flow-test -->

#### Step 10.2: First-Run UX

**Step Priority:** `[P1]`
**Depends on:** Phase 7, Phase 8

**Objective:** Ensure the generated roadmap answers the four customer questions: what kind of project, what to improve next, which tasks are evidence-backed, which are blocked.

**Tasks:**

- [x] `[P1]` Define "customer usefulness" acceptance criteria: ≥5 project-specific tasks, project type identified, evidence-backed tasks labeled, blocked tasks distinguished <!-- rs:task=uxf-define-customer-usefulness-criteria -->
- [x] `[P1]` Add "Detected Project Profile" section to generated ROADMAP.md header <!-- rs:task=uxf-add-detected-project-profile-section -->
- [x] `[P1]` Profile section must answer: what kind of project, what to improve next, which tasks are evidence-backed, which are blocked by missing evidence <!-- rs:task=uxf-profile-section-answers-four-questions -->
- [x] `[P1]` Add audit/debug mode flag explaining why tasks were generated (which signals triggered which tasks) <!-- rs:task=uxf-add-audit-debug-mode -->
- [x] `[P2]` Ensure roadmap feels specific to the project, not a generic governance template <!-- rs:task=uxf-roadmap-feels-project-specific -->
- [x] `[P2]` Add "Why these tasks were generated" explanation block in debug output <!-- rs:task=uxf-add-why-tasks-generated-block -->

**Exit Criteria:**

- [x] `[P0]` npm test passes with all fixture languages including new website fixture <!-- rs:task=cst-ph10-st1-exit-npm-test-passes-all-fixtures -->
- [x] `[P1]` Manual test on NANDI repo confirms ≥5 useful website-specific tasks in generated ROADMAP.md <!-- rs:task=cst-ph10-st1-exit-nandi-manual-test-passes -->
- [x] `[P1]` Generated ROADMAP.md contains "Detected Project Profile" section <!-- rs:task=uxf-ph10-st2-exit-profile-section-present -->

### Phase 11: Configuration Override and Documentation

**Phase Priority:** `[P1]`
**Objective:** Allow teams to explicitly declare their project type and document the full customer workflow — including how to install, test, and cleanly uninstall RoadmapSmith on an external repository.

#### Step 11.1: Configuration Override

**Step Priority:** `[P1]`
**Depends on:** Phase 7

**Objective:** Allow users to override auto-detected project type in roadmap-skill.config.json.

**Tasks:**

- [x] `[P1]` Allow projectType override in roadmap-skill.config.json (e.g. `"projectType": "landing-site"`) <!-- rs:task=cfgo-allow-project-type-override -->
- [x] `[P1]` Allow product.name, product.primaryUser, product.targetOutcome hints in config for domain-specific generation <!-- rs:task=cfgo-allow-product-hints-in-config -->
- [x] `[P1]` Explicit config overrides auto-detection but still validates tasks against repository evidence <!-- rs:task=cfgo-override-respects-evidence-validation -->
- [x] `[P2]` Document projectType override schema in config JSON schema validation <!-- rs:task=cfgo-document-override-schema -->

#### Step 11.2: Documentation

**Step Priority:** `[P1]`
**Depends on:** Phase 7, Phase 8, Phase 9, Phase 10

**Objective:** Document the distinction between product/skill/CLI, the customer testing workflow, and uninstall/cleanup procedures.

**Tasks:**

- [x] `[P1]` Document distinction: RoadmapSmith product vs. roadmap-sync skill vs. roadmapsmith CLI <!-- rs:task=doc3-document-product-skill-cli-distinction -->
- [x] `[P1]` Document customer testing workflow on an external repository <!-- rs:task=doc3-document-customer-testing-workflow -->
- [x] `[P1]` Add troubleshooting for uninstall/cleanup: npm uninstall -g roadmapsmith, removing ROADMAP.md, AGENTS.md, and skill files <!-- rs:task=doc3-add-uninstall-cleanup-docs -->
- [x] `[P1]` Add use-case examples: website/landing repo, CLI package repo, empty repo Zero Mode, existing repo Sync/Audit Mode <!-- rs:task=doc3-add-use-case-examples -->
- [ ] `[P2]` Add docs/use-cases/website-landing.md example <!-- rs:task=doc3-add-website-landing-use-case -->
  - ⚠️ attempted but validation failed: missing referenced file(s): docs/use-cases/website-landing.md

**Exit Criteria:**

- [x] `[P1]` roadmap-skill.config.json accepts projectType field without validation errors <!-- rs:task=cfgo-ph11-st1-exit-project-type-accepted -->
- [x] `[P1]` docs/ contains at least one website/landing use-case example <!-- rs:task=doc3-ph11-st2-exit-website-use-case-exists -->
- [x] `[P1]` README or SKILL.md explains product vs. skill vs. CLI distinction <!-- rs:task=doc3-ph11-st2-exit-distinction-documented -->
<!-- rs:managed:end -->
