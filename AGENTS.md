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
- When a long chained command sequence produces inconsistent test/process errors (for example transient `spawn EPERM`), rerun critical checks (`npm test`, CLI smoke) as direct commands from `roadmap-skill/` before treating it as a product regression.
- For filename case-compat behavior (`ROADMAP.md` vs `roadmap.md`), keep one integration test with runtime skip on case-insensitive filesystems (Windows) and enforce precedence logic through unit tests that mock directory entries.


<claude-mem-context>
# Memory Context

# [roadmapsmith] recent context, 2026-05-16 3:03pm GMT-3

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (17,268t read) | 606,681t work | 97% savings

### May 14, 2026
410 1:13a 🔴 Fixed grant-evidence validator to work without undocumented overrideResult flag (Bug 1)
411 " 🟣 Added test detection for configuration file validation via fs.readFileSync patterns (Bug 2)
416 1:27a 🔵 Validator incorrectly reports renderer/compact.js as missing despite file existing
417 " ✅ CI workflow smoke test switched to passing validation target
418 1:33a ✅ GitHub branch protection rules activated for primary repository
S98 Configure automated npm publishing from GitHub Actions using OIDC trusted publishers for the roadmapsmith package (May 14, 1:33 AM)
419 1:35a 🔴 Validator Evidence Edge Cases Fixed in v0.9.4
420 " ✅ npm Publishing Switched Back to OIDC Trusted Publishing
421 " ✅ GitHub Branch Protection Configured for roadmapsmith
422 1:38a 🔵 Four actionable bugs identified in task validator system (v0.9.3)
423 1:39a 🔴 Released v0.9.4 with four validator system bug fixes
424 " 🟣 Release v0.9.4 prepared and packaged
425 " 🟣 Validator enhancements: grant-evidence, test evidence recognition, and whenId matching
426 " ✅ CI workflow updated to validate against real repository task
427 " ✅ npm publishing switched to OIDC Trusted Publishing
428 1:40a ✅ Release v0.9.4 moved to dedicated branch for PR-based merge workflow
429 3:22a 🔵 False-positive validation confirmed: path-only token match marks task complete despite semantic mismatch
430 3:25a 🔴 Fixed false-positive validation: weak path-only evidence now requires content-specific token match
431 3:26a ✅ Added end-to-end sync test for Mercado Pago Point false-positive regression
432 " 🔵 Fix validation complete: all 121 tests pass, Mercado Pago Point false-positive now correctly blocked
433 3:33a 🔴 Fixed validator false positives from weak path-only token matches
434 " 🔵 release-v0.9.4 branch and v0.9.4 tag DO exist on remote despite initial git pull error
435 3:36a ✅ Pushed release-v0.9.4 branch with validation logic enhancements to remote
436 3:37a ⚖️ Release branch versioning: v0.9.5 for post-release bugfix
437 " 🔵 Git reflog permission constraint on Windows branch rename
438 3:38a ✅ Bumped version from 0.9.4 to 0.9.5 and renamed release branch
439 " 🔵 Permission error on git index lock prevents staging version bump changes
440 3:41a ✅ Committed and pushed release-v0.9.5 branch to GitHub; cleaned up v0.9.4 remote branch
441 3:46a ✅ Version 0.9.5 release branch created and pushed to origin
442 " 🔵 Merge conflicts detected between release-v0.9.5 and main branches
443 " 🔵 Git permission error on Windows with .git/index.lock file
444 " 🔵 Git index.lock permission denied on Windows during stash operation
445 3:47a 🔵 Windows git lock file permission issues requiring escalated permissions during merge workflow
446 3:50a 🔵 PR State Assessment - Release v0.9.5
447 4:00a 🔴 Weak path-only evidence validation fix tested and verified
448 " ✅ PR #4 merge conflicts resolved and pushed
449 4:02a ⚖️ Git branch management workflow established
450 " 🔵 AGENTS.md modified by automatic context/memory system
451 " 🔵 release-v0.9.5 branch diverged from origin/main
### May 16, 2026
581 2:31p 🟣 Managed block scoping in CLI sync prevents overwriting user content
582 2:34p ✅ Documentation adds update instructions for published roadmapsmith package
583 2:41p ✅ Documentation: RoadmapSmith CLI update instructions and publication status
584 " 🔵 Managed block preservation feature merged via PR #5
585 2:44p 🔵 Repository state synchronized; managed-block-preservation feature branch identified
586 2:45p 🔵 Automated release pipeline and version management infrastructure
587 2:46p 🔵 Release workflow blocked due to stale package.json version
588 " 🔵 Release workflow has changelog extraction format mismatch
589 " ⚖️ Release process: version bump required to ship pending commits
590 2:50p ✅ Release PR #6 Created for roadmapsmith v0.9.6
591 2:53p 🔴 roadmapsmith sync now preserves existing managed block structure on validation failures
592 " ✅ roadmapsmith released as v0.9.6 with improved GitHub Release note extraction

Access 607k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>