# Agent Execution Notes

## RoadmapSmith Mode Rule

Before generating or updating `ROADMAP.md`, determine the mode:

- **Zero Mode** for empty or low-context repositories (no implementation files, no ROADMAP.md, stack undefined).
- **Sync/Audit Mode** for existing repositories (code, tests, docs, TODOs, or an existing ROADMAP.md present).

In Zero Mode, interview the developer using the 8 discovery questions in `skills/roadmap-sync/SKILL.md` before generating the roadmap.
In Sync/Audit Mode, scan repository context, validate tasks against evidence, and sync checklist state.

Do not mark roadmap tasks complete manually. Always call `roadmapsmith sync` and rely on evidence-based validation.

## Retrospective Rules
- For a user-requested implementation, leave the resulting diff in the shared checkout unless the user explicitly asks for an isolated branch/worktree. If isolation is required, state its path and handoff before completion; never report work as applied while the user's checkout is unchanged. Before responding, verify `git status --short` in the checkout the user is actually using.
- Do not let a generic worktree/branch workflow override the user's visible workspace or an explicit request to apply changes. A worktree is an opt-in isolation mechanism here, not a substitute for delivering the working-tree diff the user asked to see.
- Run the full suite and any release gates only after the final diff is in the target checkout. Do not repeat expensive validation merely to compensate for moving work between worktrees.
- Completion reports must state the exact location of the diff and whether it is unstaged, committed, or published. Do not offer merge/PR choices when the user did not ask for Git integration and no commit exists.
- Keep test discovery scoped to `test/*.test.js`; do not let files in `test/fixtures` run as tests.
- Preserve deterministic roadmap generation by semantically merging only phase checklist tasks (`Phase P0/P1/P2`) and keeping non-phase section IDs/status stable.
- Ignore generic implementation words (for example: `implement`, `module`, `function`) in evidence matching; prioritize explicit paths/symbols and domain-specific tokens to reduce validation false positives.
- When the public RoadmapSmith command contract changes (for example `setup`, `zero`, `maintain`, slash aliases, or VS Code task entrypoints), update all user-facing surfaces in the same pass: `README.md`, `roadmap-skill/README.md`, relevant `docs/use-cases/*`, `docs/release-readiness.md`, `skills.json`, `.claude-plugin/plugin.json`, `skills/roadmap-sync/agents/openai.yaml`, and the active changelog entries. Verify with a doc grep plus the full package test suite, and on this Windows machine prefer the absolute Node executable if `npm test` fails because `node` is missing from PATH.
- Do not claim near-certainty on cross-surface UX work until the generated artifacts are exercised in a realistic temp-project flow. In this repo, `setup` generating files is not enough proof that launcher/task execution works; verify at least one generated launcher/task path against a resolvable CLI target before saying it is solid.
- When a failing integration test depends on workspace-local CLI resolution, check the test fixture assumptions before changing product code. Here, the wasted time came from assuming the generated launcher should execute in a temp project with no resolvable CLI, when the real fix was to give the test a workspace CLI shim.
- When a long chained command sequence produces inconsistent test/process errors (for example transient `spawn EPERM`), rerun critical checks (`npm test`, CLI smoke) as direct commands from `roadmap-skill/` before treating it as a product regression.
- For filename case-compat behavior (`ROADMAP.md` vs `roadmap.md`), keep one integration test with runtime skip on case-insensitive filesystems (Windows) and enforce precedence logic through unit tests that mock directory entries.
- Before release work, inspect `.github/workflows/ci.yml`, `roadmap-skill/package.json`, `roadmap-skill/package-lock.json`, and `roadmap-skill/CHANGELOG.md` together; version drift or a missing changelog entry is a release-prep issue, not something to discover after pushing.
- Before any `git push` from this repo, run the broad dual-agent validation gate and reconcile both results first: one subagent owns `npm run validate:qa-regression`, one subagent owns `npm run validate:functional-smoke`, and neither gate is optional.
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

# [roadmapsmith] recent context, 2026-06-21 2:28am GMT-3

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (25,353t read) | 346,967t work | 93% savings

### May 14, 2026
S123 CodeQL-safe refactoring of parser and validator modules to replace complex regex patterns with composable character-driven tokenization (May 14, 1:33 AM)
S98 Configure automated npm publishing from GitHub Actions using OIDC trusted publishers for the roadmapsmith package (May 14, 1:33 AM)
### May 16, 2026
S395 Implement GUI/IDE visibility for RoadmapSmith CLI status and host distinction (Claude Code vs Codex/Codex CLI) with setup flow and doctor diagnostics (May 16, 3:58 PM)
### Jun 12, 2026
S396 roadmap-sync: Generate, synchronize, and validate project roadmap checklist state against repository evidence (Jun 12, 3:22 PM)
### Jun 13, 2026
S407 User reported RoadmapSmith skill duplication issue: both legacy skill roadmap-sync and plugin roadmapsmith installed simultaneously, creating command conflicts. Requested guidance on cleanup and proper installation configuration. (Jun 13, 9:44 PM)
### Jun 18, 2026
S434 Prepare codebase for push and conduct security audit to verify all changes are ready (Jun 18, 1:58 AM)
### Jun 20, 2026
3760 11:07p 🔴 CodeQL security check passed after ReDoS fix; PR #51 now has all green checks
3761 11:08p 🟣 Deterministic verification feature merged to main (PR #51)
3765 11:10p 🟣 v0.9.29 release completed: deterministic verification feature released to production
3766 " 🟣 v0.9.29 production release published with deterministic verification feature
3769 " ✅ Post-release cleanup: feature branch deleted, development worktree stale, main sync pending
3770 11:11p ✅ Post-release cleanup completed: checkout synchronized to v0.9.29 release
### Jun 21, 2026
3772 12:50a 🔵 Task Completion Detection Improved in 0.9.29
3773 " 🔴 Verification Recipe Regression in 0.9.29
3774 " 🔵 Structural Validation Flaw: validate and maintain Share Same Evidence Logic
3775 " 🔵 Evidence Contamination from Build Artifacts and Scripts
3776 " 🔵 Root Evidence Inference Problem: Semantic Proximity Treated as Behavioral Proof
3777 12:51a 🔵 Verification Recipe Generation Searches All Code Files Without Task Context
3778 " 🔵 Deterministic Verification Gates Task Completion Without Verify Metadata
3779 " 🔵 Verification Recipe Lifecycle: Generated on Failure, Removed on Completion
3780 " 🔵 Three Categories of Verification in RoadmapSmith: Authoritative, Heuristic, Deterministic
3781 12:52a 🔵 Build Artifact Exclusion: Three-Layer Filtering in Evidence Index
3782 " 🔵 Evidence Inference Maintains Allowlist of Generic Tokens and Namespace Patterns
3783 1:06a ⚖️ Verification recipe policy: four-principle specificity gate
3784 " ⚖️ Validate independence framework: three-level strategy with level-2+3 hybrid recommendation
3786 1:09a ⚖️ Validate breaking-change implementation: spec-first, meta-test-driven, flag-gated rollout
3787 " ⚖️ Architectural separation: proximity-inferencer remains, content-verifier is new layer
3788 " ⚖️ Dependency closure: validate --strict must precede maintain self-audit integration
3789 1:15a 🔵 Verification recipe regression in 0.9.29 spreads unrelated patterns across tasks
3790 " 🔵 Validate command uses same inference logic as maintain, cannot detect maintain's errors independently
3791 " 🔵 Root cause of false positives: evidence inference treats semantic proximity as behavioral evidence
3792 " 🔵 Evidence lists contaminated by build artifacts and auxiliary scripts reducing readability
3793 1:16a 🔵 Slash command architecture supports multiple direct commands with legacy router compatibility
3794 " 🔵 Multi-host plugin/skill distribution shares aligned bundle across Claude and Codex
3795 " 🔵 Status/doctor command reports four separate host surfaces independently
3796 " 🔵 Maintain command documented as preserve-first flow combining generate, sync, and audit
3797 1:17a 🔵 Update command implements single-task completion with strict evidence validation
3798 " 🔵 Documentation explicitly defines tool boundaries and enforces honest limitations
3799 " 🔵 Release UX gate and use-case docs define explicit user contracts for each workflow
3800 1:22a 🔵 RoadmapSmith Deprecation Strategy and Dual-Host Conflict Detection
3801 1:23a 🔵 Multi-Host Readiness Validation Architecture
3802 1:26a 🔵 RoadmapSmith Command Routing and Deprecation Architecture
3803 1:27a 🔵 Task Label Management and Bundle Detection Infrastructure
3804 1:29a 🔵 Preserve-First Regeneration Pattern with Explicit Destructive Flag
3805 " 🔵 RoadmapSmith Skill Bundle Composition
3806 1:30a 🔵 Comprehensive Deprecation Architecture for /roadmap-sync with Multi-Layer Migration Guidance
3807 1:35a 🔵 Task Label Definition and Validation System Audit
3808 " 🔵 Skill Definition Duplication and Roadmap-Sync Migration Status
3809 1:41a 🔵 Deprecated /roadmap-sync Surface and Evidence Verification Recipe System
3810 1:42a 🔵 Four-Surface Host Architecture with Multi-Pass Evidence Validation
3811 " 🔵 Routing, Deprecation, and Surface Readiness Test Coverage
3812 1:43a 🔵 Validation Pass/Fail Logic with Evidence Thresholds and Task State Preservation
3813 " 🔵 Task Preservation, Dependency Blocking, and Audit Gap Detection
3814 1:45a ✅ Slash Action Tier Organization and Surface Visibility Control
3815 " ✅ Host Surface Readiness Reorganized by Tier: Canonical as Baseline
3816 1:46a 🔵 Evidence Verification and Test Report Parsing Utilities

Access 347k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
