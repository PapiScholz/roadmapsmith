<!-- rs:managed:start -->
# RoadmapSmith Roadmap

## Product North Star
Ship deterministic roadmap automation with evidence-based task completion and a clean path to public release.

## Current State
- Repository structure prepared for public distribution.
- npm package and skill distribution ready for platform submission.

## Phased Roadmap

### Phase P0 (Critical)
- [x] CI green on `main` <!-- rs:task=p0-ci-green-on-main -->
- [x] Package metadata completed <!-- rs:task=p0-package-metadata-completed -->
- [x] `package-lock.json` committed in `roadmap-skill/` <!-- rs:task=p0-package-lock-json-committed -->
- [ ] Redesign validation algorithm to reduce false positives in `findCodeEvidence` <!-- rs:task=p0-redesign-findcodeevidence-reduce-false-positives -->
- [ ] Align validation logic between `findCodeEvidence` (score-based) and `findTestEvidence` (OR-based) <!-- rs:task=p0-align-findcodeevidence-findtestevidence-logic -->
- [ ] Introduce stricter semantic matching for task validation to avoid naive token matching <!-- rs:task=p0-stricter-semantic-matching-task-validation -->
- [ ] Make validation deterministic and explainable by tracing why a task passed <!-- rs:task=p0-deterministic-explainable-validation-trace -->
- [ ] Prevent agents from marking tasks as complete when validation confidence is low <!-- rs:task=prevent-low-confidence-task-completion -->
- [ ] Introduce validation confidence scoring (not just pass/fail) <!-- rs:task=introduce-validation-confidence-score -->
- [ ] Expose validation reasoning clearly (why a task passed/failed) <!-- rs:task=expose-validation-reasoning -->
- [ ] Add guardrail: require multiple evidence types (code + test or stronger heuristics) <!-- rs:task=require-multi-evidence-validation -->

### Phase P1 (Important)
- [x] Repository made public <!-- rs:task=p1-repo-made-public -->
- [x] npm package name confirmed <!-- rs:task=p1-npm-package-name-confirmed -->
- [ ] Make `northStar`, `exitCriteria`, `risks`, and `antiGoals` configurable via `roadmap-skill.config.json` <!-- rs:task=p1-configurable-northstar-exitcriteria-risks-antigoals -->
- [ ] Refactor roadmap model creation to remove hardcoded business logic <!-- rs:task=p1-refactor-roadmap-model-remove-hardcoded-logic -->
- [ ] Introduce safe plugin loading with try/catch and meaningful error reporting <!-- rs:task=p1-safe-plugin-loading-trycatch-error-reporting -->
- [ ] Add plugin validation sandboxing to prevent plugin crash from breaking execution <!-- rs:task=p1-plugin-validation-sandboxing -->
- [ ] Simplify AGENTS.md rules into deterministic and minimal instructions <!-- rs:task=simplify-agents-rules -->
- [ ] Add explicit agent usage contract (how to use roadmap-sync safely) <!-- rs:task=define-agent-usage-contract -->
- [ ] Introduce "safe mode" for agents (strict validation, no auto-complete) <!-- rs:task=introduce-agent-safe-mode -->
- [ ] Add CLI feedback hints when validation is weak or ambiguous <!-- rs:task=add-validation-feedback-hints -->

### Phase P2 (Optimization)
- [x] npm publish completed <!-- rs:task=p2-npm-publish-completed -->
- [x] skills.sh submission completed <!-- rs:task=p2-skills-sh-submission-completed -->
- [ ] Implement caching layer for `buildValidationContext` (fileIndex, walkFiles, etc.) <!-- rs:task=p2-caching-layer-buildvalidationcontext -->
- [ ] Add incremental scan strategy to avoid full repo scan on every execution <!-- rs:task=p2-incremental-scan-strategy -->
- [ ] Make hardcoded limits configurable: TODO scan file limit (120), TODO extraction limit (12), evidence file cap (20) <!-- rs:task=p2-configurable-hardcoded-limits -->
- [ ] Allow dynamic phase configuration beyond P0/P1/P2 with custom phases support <!-- rs:task=p2-dynamic-phase-configuration-custom-phases -->
- [ ] Add self-healing suggestions when validation fails (agent guidance) <!-- rs:task=self-healing-validation-suggestions -->
- [ ] Provide agent-readable output mode (structured JSON with confidence + hints) <!-- rs:task=agent-readable-validation-output -->
- [ ] Reduce dependency on implicit AGENTS.md knowledge <!-- rs:task=reduce-agent-hidden-knowledge -->

## Release Milestones
- [x] v0.1: Internal release checklist stabilized <!-- rs:task=milestone-v0-1-internal-release-checklist-stabilized -->
- [x] v0.2: Public repository and install discovery readiness <!-- rs:task=milestone-v0-2-public-repository-and-install-discovery-readiness -->
- [x] v1.0: Public npm + skills.sh availability <!-- rs:task=milestone-v1-0-public-npm-and-skills-sh-availability -->

## Guardrail
- [ ] Do not mark roadmap tasks as complete without repository evidence <!-- rs:task=guardrail-do-not-mark-roadmap-tasks-as-complete-without-repository-evidence -->
<!-- rs:managed:end -->
