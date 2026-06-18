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

# [roadmapsmith] recent context, 2026-06-18 2:10am GMT-3

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (24,090t read) | 215,121t work | 89% savings

### May 14, 2026
S123 CodeQL-safe refactoring of parser and validator modules to replace complex regex patterns with composable character-driven tokenization (May 14, 1:33 AM)
S98 Configure automated npm publishing from GitHub Actions using OIDC trusted publishers for the roadmapsmith package (May 14, 1:33 AM)
### May 16, 2026
S395 Implement GUI/IDE visibility for RoadmapSmith CLI status and host distinction (Claude Code vs Codex/Codex CLI) with setup flow and doctor diagnostics (May 16, 3:58 PM)
### Jun 12, 2026
S396 roadmap-sync: Generate, synchronize, and validate project roadmap checklist state against repository evidence (Jun 12, 3:22 PM)
### Jun 13, 2026
S407 User reported RoadmapSmith skill duplication issue: both legacy skill roadmap-sync and plugin roadmapsmith installed simultaneously, creating command conflicts. Requested guidance on cleanup and proper installation configuration. (Jun 13, 9:44 PM)
### Jun 14, 2026
2865 12:32a ✅ Slash Routing Updated: /roadmap-update as Primary Sync, regenerate Removed
2866 " ✅ Host Integration Updated: Tasks and Launcher Reflect New Command Surface
2867 " ✅ VS Code Task Definitions Updated: Regenerate Removed, Descriptions Aligned
2868 12:33a ✅ Launcher Embedded Slash Code Finalized: /roadmap-update Primary, /roadmap-sync Shows Palette
2869 " ✅ Final Host Documentation Updates: Regenerate Removed from Help, Slash Entrypoints Corrected
2870 " 🔵 Comprehensive Test Suite Validates Preserve-Mode and Full-Regen Implementation
2871 12:34a ✅ Final Cleanup: Electron Classifier Renamed, Obsolete Function Removed
2872 " ✅ Test Suite Updated: Preserve-Mode and Full-Regen Behavior Tests Aligned
2896 12:24p 🟣 Added /roadmap-update direct slash command
2897 " ✅ Removed /roadmap-regenerate as direct slash command
2898 " ✅ Updated roadmap-sync Codex metadata to reference /roadmap-update
2900 12:25p ✅ Deleted skills/roadmap-regenerate directory
2902 " 🔵 slash.test.js tests all pass with /roadmap-update integration
2904 " 🔵 Generator test failures: preserveManagedBlock logic conflicts with --full-regen removal
2905 " 🔵 CLI test failures: --full-regen flag not producing expected behavior
2908 12:26p 🔵 Tests reveal intended design: --full-regen should error, users redirected to regenerate command
2910 " ⚖️ Clarified design: --full-regen flag controls whether generate rebuilds managed blocks
2911 " 🔵 All generator and CLI tests now pass after test alignment
2912 12:27p 🔵 Full test suite passes: 224 tests pass, 0 failures
2913 " ✅ Skill bundle refactored to namespaced structure with roadmap- prefix
3037 9:12p 🔵 RoadmapSmith Test Suite Structure and Coverage Areas
3038 9:14p ⚖️ Pre-push QA Gate Policy: Broad Scope with Dual Sub-agent Validation
### Jun 18, 2026
3180 1:31a 🔴 Pre-push gate refactored to report failures instead of crashing on first check
3181 " 🟣 Test coverage added for failure aggregation in pre-push gate
3182 " 🟣 Docs-contract test guards against incorrect Codex marketplace command directory
3183 " 🔴 docs/release-readiness.md corrected for Codex marketplace command working directory
3184 " 🔴 docs/release-ux-gate.md corrected for Codex marketplace command working directory
3185 " 🔵 Test failure discovered: aggregate mode subgate error message not captured as expected
3186 1:32a 🔵 Pre-push gate qa-regression executes all checks and reports multiple failures
3187 " 🔵 Legacy router smoke check now correctly accepts exit code 1; functional-smoke gate passes
3188 " 🔴 Fixed test assertion to match actual error message behavior in aggregate mode test
3189 " 🔵 All pre-push gate and manifest tests passing after fixes
3190 " 🔵 All pre-push validation gates passing; Codex marketplace command paths verified correct
3191 " 🔵 Complete pre-push validation aggregate gate passes with full JSON diagnostic output
3192 1:33a ✅ Plan implementation complete: 5 files modified across pre-push gate, tests, and documentation
3193 1:51a 🔄 Skills Architecture Migrated to Namespaced Module Structure
S434 Prepare codebase for push and conduct security audit to verify all changes are ready (Jun 18, 1:58 AM)
3194 1:59a ✅ Skills refactored to roadmap-namespaced structure with new plugin integrations
3195 " 🔵 Pre-push gate validates all refactoring changes and safety mechanisms passing
3196 2:00a 🔵 Missing pre-push-gate.js script file
3197 " 🔵 Documentation audit confirms all surfaces documented with deprecation paths and validation gates clearly defined
3198 " 🔵 QA/Regression validation gate architecture and check definitions
3199 " 🔵 QA/Regression validation gate execution PASS
3200 " 🔵 Codex plugin bundle fully configured with dual skill naming (legacy + namespaced) and metadata sync infrastructure
3201 2:01a 🔵 Plugin-bundle.js implements three-surface version alignment: Claude, Codex root, and marketplace mirror with automatic consistency enforcement
3202 " 🔵 Root skills/ directory contains only new namespaced skills; marketplace bundle preserves legacy skill names for backward compatibility
3203 " 🔵 Bundle metadata sync confirms version alignment 0.9.16; marketplace mirror cleaned to contain only namespaced skills from root
3204 " ✅ Enhanced codex-marketplace.test.js with skill directory parity validation and explicit surface curation assertions
3205 2:02a 🔵 Comprehensive test suite passes all 13 critical validations: marketplace integration, gate structure, and manifest consistency confirmed
3206 " 🔵 QA/Regression subgate passes both checks with documented residual risks and unvalidated surfaces
3207 2:04a 🔵 Functional-Smoke Gate Validation Complete: All 7 Checks Pass

Access 215k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
