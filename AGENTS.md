# Agent Execution Notes

## RoadmapSmith Mode Rule

Before generating or updating `ROADMAP.md`, determine the mode:

- **Zero Mode** for empty or low-context repositories (no implementation files, no ROADMAP.md, stack undefined).
- **Sync/Audit Mode** for existing repositories (code, tests, docs, TODOs, or an existing ROADMAP.md present).

In Zero Mode, interview the developer using the 8 discovery questions in `skills/roadmap-sync/SKILL.md` before generating the roadmap.
In Sync/Audit Mode, scan repository context, validate tasks against evidence, and sync checklist state.

Do not mark roadmap tasks complete manually. Always call `roadmapsmith sync` and rely on evidence-based validation.

## Retrospective Rules
- Keep test discovery scoped to `test/*.test.js`; do not let files in `test/fixtures` run as tests.
- Preserve deterministic roadmap generation by semantically merging only phase checklist tasks (`Phase P0/P1/P2`) and keeping non-phase section IDs/status stable.
- Ignore generic implementation words (for example: `implement`, `module`, `function`) in evidence matching; prioritize explicit paths/symbols and domain-specific tokens to reduce validation false positives.
- When the public RoadmapSmith command contract changes (for example `setup`, `zero`, `maintain`, slash aliases, or VS Code task entrypoints), update all user-facing surfaces in the same pass: `README.md`, `roadmap-skill/README.md`, relevant `docs/use-cases/*`, `docs/release-readiness.md`, `skills.json`, `.claude-plugin/plugin.json`, `skills/roadmap-sync/agents/openai.yaml`, and the active changelog entries. Verify with a doc grep plus the full package test suite, and on this Windows machine prefer the absolute Node executable if `npm test` fails because `node` is missing from PATH.
- Do not claim near-certainty on cross-surface UX work until the generated artifacts are exercised in a realistic temp-project flow. In this repo, `setup` generating files is not enough proof that launcher/task execution works; verify at least one generated launcher/task path against a resolvable CLI target before saying it is solid.
- When a failing integration test depends on workspace-local CLI resolution, check the test fixture assumptions before changing product code. Here, the wasted time came from assuming the generated launcher should execute in a temp project with no resolvable CLI, when the real fix was to give the test a workspace CLI shim.
- When a long chained command sequence produces inconsistent test/process errors (for example transient `spawn EPERM`), rerun critical checks (`npm test`, CLI smoke) as direct commands from `roadmap-skill/` before treating it as a product regression.
- For filename case-compat behavior (`ROADMAP.md` vs `roadmap.md`), keep one integration test with runtime skip on case-insensitive filesystems (Windows) and enforce precedence logic through unit tests that mock directory entries.
- Before release work, inspect `.github/workflows/ci.yml`, `roadmap-skill/package.json`, `roadmap-skill/package-lock.json`, and `roadmap-skill/CHANGELOG.md` together; version drift or a missing changelog entry is a release-prep issue, not something to discover after pushing.
- For release work on this repository, treat `main` as PR-only: direct pushes can be rejected by branch protection, so be ready to push a release branch, wait for required checks, and merge through GitHub.
- In this Windows environment, do not rely on `git`, `gh`, `npm`, or `node` being available in PATH inside spawned shells or tools; prefer explicit executable paths when release, publish, auth, or validation steps matter.
- When invoking `gh` by absolute path on this machine, also make `git` available in PATH for that process; `gh pr create` and related commands can fail even if `gh.exe` itself is found.
- When `npm test` or another package script fails in this shell with "`node` not recognized", treat it as an environment-path issue first and rerun the underlying command with the absolute Node executable before diagnosing the product.
- Do not trust VS Code source-control messages like "pull first" as proof of remote divergence; fetch and inspect `git status -sb`, branch tracking, and remote refs before deciding what happened.
- Separate "release published remotely" from "local repo state is clean": after a PR merge, confirm the remote publish/release first, then realign the local branch and uncommitted files as a second step.
- After a squash merge on GitHub, local `main` can end up `ahead` and `behind` `origin/main` with the same tree content; fetch first, compare tree equality, and soft-reset to `origin/main` when the goal is only to realign local history without disturbing uncommitted files.
- A release is not done at merge time in this repo; wait for the `main` push workflow, then verify both `npm view roadmapsmith version` and `gh release view vX.Y.Z` before calling the publish complete.


<claude-mem-context>
# Memory Context

# [roadmapsmith] recent context, 2026-06-12 11:48pm GMT-3

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (20,278t read) | 207,401t work | 90% savings

### May 14, 2026
S123 CodeQL-safe refactoring of parser and validator modules to replace complex regex patterns with composable character-driven tokenization (May 14, 1:33 AM)
S98 Configure automated npm publishing from GitHub Actions using OIDC trusted publishers for the roadmapsmith package (May 14, 1:33 AM)
### Jun 12, 2026
S395 Implement GUI/IDE visibility for RoadmapSmith CLI status and host distinction (Claude Code vs Codex/Codex CLI) with setup flow and doctor diagnostics (Jun 12, 3:22 PM)
2610 5:26p 🔵 CLI implements comprehensive command routing with dual JSON/human output modes
2611 " 🔵 Validation pipeline supports minimum confidence filtering and audit trail
2612 " 🔵 Plugin system integrated into validation and generation pipelines
2613 " 🔵 Sync operation filtered to managed block and includes audit fallback
2614 " 🔵 File I/O module includes comprehensive language and test framework detection
2615 " 🔵 File writing is idempotent with smart change detection and diff preview
2616 " 🔵 File traversal excludes 17 common build, cache, and dependency directories by default
2617 5:29p ✅ Implemented portable task wrapper layer with platform-specific Node.js resolution
2618 " ✅ Status and doctor commands updated to report wrapper and runtime readiness
2619 5:30p ✅ Test coverage added for platform-specific wrappers and Node.js runtime detection
2620 " ✅ CLI test suite extended with platform wrapper and runtime detection tests
2621 5:31p ✅ Updated README.md to document platform-specific task wrappers and Node.js runtime detection
2622 " 🔵 Full test suite passes for platform wrapper and runtime detection implementation
2623 " 🔵 Portable wrapper layer successfully generated by setup command on Windows
2624 " 🔵 Complete test suite passes with 192/193 tests across all RoadmapSmith functionality
2625 5:46p 🔵 Current roadmap-sync command interface structure explored for consolidation
2626 5:51p ⚖️ Architectural decision: two explicit commands for Zero Mode and Sync/Audit Mode with CLI interview entry
2627 5:53p ⚖️ Command API surface: mode-named commands with multi-surface primary contract
2628 5:56p ⚖️ Command behavior defaults: maintain regenerates+syncs+audits; zero initializes+generates
2629 5:57p 🔵 Generator and template modules not yet implemented in codebase
2630 " 🔵 Core roadmap generation and rendering infrastructure present; new commands integrate existing modules
2631 " 🔵 Roadmap model structure supports product metadata, phases, steps, risks, and success criteria
2632 " 🔵 Professional renderer supports 13-section roadmap with phased execution and module maturity tracking
2633 5:58p 🔵 Comprehensive test suite and integration points mapped for CLI orchestration
2634 5:59p 🟣 Added Zero Mode configuration schema and config utilities
2635 6:00p 🟣 Implemented Zero Mode CLI interview module with product context collection
2636 6:01p 🟣 Implemented roadmapsmith zero and maintain commands with CLI orchestration
2637 " 🟣 Generator integrates Zero Mode config into product context and roadmap output
2638 " 🔄 Simplified zero.js by removing section generation logic
2639 6:02p ✅ Registered zero and maintain commands in slash routing system
2640 " 🟣 Integrated zero and maintain into VS Code task infrastructure and launcher UX
2644 6:03p 🔴 Completed launcher script updates: /zero and /maintain now routable via slash aliases and documented in examples
2645 " ✅ Exported zero module in src/index.js public API
2647 6:04p ✅ Updated slash.test.js to reflect zero and maintain slash actions
2648 " ✅ Updated host.test.js task ordering expectations to reflect zero as first managed task
2649 " ✅ Added comprehensive test coverage for zero and maintain commands to cli.test.js
2650 6:05p ✅ Created zero.test.js with comprehensive unit tests for discovery interview module
2653 " 🔵 Identified scoping bug: zeroModeConfig used in generateRoadmapDocument but not declared in function scope
2654 6:06p 🔴 Fixed zeroModeConfig scoping error in generateRoadmapDocument function
2655 6:36p ✅ Release Readiness Documentation: Clarified Product Contract and UX Gates
2656 6:37p ✅ Zero Mode Documentation Refocused: CLI as Primary Entrypoint, Skill as Optional Policy
2657 " ✅ Sync/Audit Mode Documentation Simplified: Single-Command Workflow Promotion
2658 " ✅ Claude Code Integration Docs Reordered: CLI-First Install, Skill as Optional Governance
2659 " ✅ CI Audit Mode Docs Updated: Local Workflow Simplified to `maintain` Command
2660 " ✅ Release UX Gate Documentation Created: Pre-Release Verification Checklist
2661 " ✅ roadmap-skill/README.md Updated: Daily Flow Clarification and Release Process Documentation
2662 6:38p ✅ Root README.md Updated: Release Readiness Documentation Links and Public Contract
2663 " ✅ CHANGELOG.md v0.9.15 Entry: Public API Refocus and Zero/Maintain Commands
2664 " ✅ Root CHANGELOG.md Updated: Documentation Refocus and Release Gate Criteria
2665 11:46p ⚖️ Document command contract breaking-change protocol

Access 207k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
