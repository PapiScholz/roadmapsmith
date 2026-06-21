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

# [roadmapsmith] recent context, 2026-06-20 11:02pm GMT-3

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (18,783t read) | 164,105t work | 89% savings

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
3699 8:09p ⚖️ Three-tier task completion verification strategy for roadmapsmith
3700 8:12p ⚖️ Test pass verification hierarchy for maintain command—read-only artifact preference with staleness detection
3701 8:20p 🔵 Clean test baseline established for deterministic-evidence feature branch
3702 8:21p 🟣 Parser extended to capture deterministic verification metadata structures
3703 " 🔵 Parser extension validated - all 8 tests passing including new verification metadata parsing
3704 " 🟣 Generated output directories classified and excluded from evidence pool
3705 " 🔵 Generated output exclusion integrated throughout validator evidence collection
3706 8:23p 🟣 Deterministic verification evaluation implemented for all four verification kinds
3707 " ✅ Diagnostic codes added for deterministic verification failures (WRONG_VALUE, PARTIAL)
3708 " 🟣 Deterministic verification integrated into core task validation flow
3709 " 🟣 Behavioral task detection generates NO_STATIC_SIGNAL or REQUIRES_HUMAN_EVIDENCE warnings
3710 8:24p 🔵 Validator test failures reveal heuristic evidence path was removed; needs restoration
3711 " ✅ Test expectations updated to require deterministic verification for task completion
3712 " 🔵 Validator test suite 96.6% passing (84/87); remaining 3 failures are minor error message mismatches
3713 " ✅ Action-verb and change-verb test assertions simplified to focus on pass/fail behavior
3714 " ✅ Cleaned up reason filtering for deterministic verification passes; extended test exemption to all verification kinds
3715 8:25p 🟣 Added comprehensive regression tests for all four deterministic verification kinds
3716 " 🔵 New deterministic verification tests reveal implementation issues; 88/91 passing (96.7%)
3717 " 🔵 Validator tests 98.9% passing (90/91); only contains verification comment stripping issue remains
3718 8:26p 🔵 Debug output shows deterministic verification not being triggered for contains verification task
3719 " 🔵 All 99 parser and validator tests passing (100%); deterministic verification fully validated
3720 " 🟣 Sync layer extended to generate and manage verification recipes and test evidence
3721 " 🔵 Sync tests fail due to new deterministic verification contract; high-confidence heuristic no longer passes tasks
3722 8:27p 🔵 Node fixture has code but no tests; sync tests need Evidence: blocks or updated expectations
3723 " 🔵 All 14 sync tests passing (100%); sync layer validates deterministic verification integration
3724 " 🟣 Added regression tests for generated test evidence and verification recipe sync behavior
3725 " 🔵 One sync test failing; verification recipe not removed when task completes
3726 " ✅ Fixed verification recipe cleanup by dynamically locating recipe lines
3727 8:28p 🔵 All 16 sync tests passing (100%); verification recipe cleanup fixed
3728 " ✅ CLI output extended to surface warning diagnostic codes
3729 " 🔵 Documentation review shows existing Sync/Audit Mode coverage; new Verify: block syntax and diagnostic codes not yet documented
3730 " ✅ Documentation updated to explain deterministic verification system
3731 8:29p ✅ Root CHANGELOG.md updated and plan status marked completed through documentation phase
3732 " 🔵 Full npm test suite passes (276/278 tests); deterministic verification implementation complete
3733 " 🔵 Both pre-push validation gates pass (qa-regression, functional-smoke); 644 insertions across 16 files
3734 " 🟣 Added CLI test for deterministic verification diagnostic output
3735 8:30p 🔵 All 47 CLI tests passing (100%); deterministic verification diagnostic codes validated
3736 10:30p 🔵 Working directory contains 668 insertions across 17 files in roadmapsmith
3737 " 🔵 Patch application from worktree failed at config.js line 31
3738 " ✅ Configuration schema extended with testReports and recipeCommand in validation block
3739 10:31p ✅ Worktree changes successfully applied to main working directory via patch
3740 " 🔵 Full test suite passes: 277/279 tests with zero failures after changes applied
3741 10:48p ✅ Added checkout isolation verification rule to agent retrospective discipline
3742 10:49p ✅ Extended checkout/diff isolation rules with completion-reporting clarity requirements
3743 " 🔵 AGENTS.md configured with skip-worktree flag for local-only retrospective persistence
3744 " ✅ AGENTS.md moved from skip-worktree to tracked changes; retrospective rules now repository-committed
3745 10:50p ✅ Comprehensive documentation updates for deterministic task verification in maintain command
3746 11:00p ✅ Documentation clarified: heuristic evidence is diagnostic only for task completion
3747 " ✅ Documented Test evidence annotation persistence and staleness detection
3748 11:01p 🟣 Behavioral verification with deterministic test evidence implemented and tested

Access 164k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
