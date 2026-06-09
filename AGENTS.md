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

# [roadmapsmith] recent context, 2026-06-09 12:10am GMT-3

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (16,529t read) | 708,022t work | 98% savings

### May 14, 2026
S98 Configure automated npm publishing from GitHub Actions using OIDC trusted publishers for the roadmapsmith package (May 14, 1:33 AM)
### May 16, 2026
597 3:12p 🔴 Implemented authoritative Evidence: line parsing and validation (Bug 1 fix)
598 " 🔴 Implemented negative implementation signal detection (Bug 2 fix)
599 " ✅ Raised evidence threshold for task completion
600 " ✅ Modified warning insertion to preserve Evidence line structure
601 " 🔴 Test suite: all 133 tests passing after validator and parser updates
602 3:19p ✅ Implemented fixes for validator false negatives and positives with comprehensive test coverage
606 3:57p 🔴 Fixed CodeQL ReDoS vulnerabilities in roadmap validator and parser
S123 CodeQL-safe refactoring of parser and validator modules to replace complex regex patterns with composable character-driven tokenization (May 16, 3:58 PM)
608 4:10p ⚖️ Codex configured to ignore automatic AGENTS.md and ROADMAP.md changes
609 " 🔵 Git index lock permission issue blocks working tree cleanup in roadmapsmith
610 4:11p 🔵 Git index.lock permission denied in roadmapsmith repository
611 " 🔵 Elevated permissions resolve git index.lock issue in roadmapsmith
612 4:24p ✅ Version bump to v0.9.7 with validator and parser security/correctness fixes
613 " ✅ Version 0.9.7 prepared for release with validator improvements
614 " ✅ Release commit 0.9.7 created on main branch
615 4:26p ✅ v0.9.7 release committed to main branch
616 " 🔵 Main branch protected: requires pull request and 2 status checks
617 4:32p 🔵 Local main branch diverged from origin/main by release commit
618 4:37p ✅ Release PR v0.9.7 created with validator fixes for Evidence: parsing and path safety
626 4:47p 🔵 Current validator implementation structure and gaps identified
627 " 🔴 Fixed Bug 1: Removed noisy negative signal patterns causing false negatives
628 " 🔴 Fixed Bug 2: Asymmetric validation preserves checked tasks without evidence
629 " ✅ Regression test suite added for Bug 1 and Bug 2 fixes
630 4:48p 🔵 All test suites pass with Bug 1 and Bug 2 fixes applied
631 " ✅ Bug fixes committed with comprehensive test coverage
632 5:02p 🔴 Validator: Remove overly broad negative implementation signal patterns
633 " 🔴 Validator: Preserve checked tasks with no evidence when unchecking is unjustified
634 " 🔵 Test suite fully passing with 136 tests covering validator edge cases
635 " ✅ Validator and sync fixes staged for release-v0.9.7 deployment
636 " 🔵 Validator negative signal patterns are too broad, causing false negatives in normal codebases
637 " ⚖️ Implement asymmetric validation: preserve already-checked tasks unless strong evidence shows incompleteness
638 " ⚖️ Target release 0.9.7 for validator fixes and remove overly-broad negative signal patterns
643 5:06p 🔴 Validator asymmetric preservation prevents false negatives on checked tasks
644 " 🔴 Removed overly broad negative signal patterns from validator
645 " ✅ Minimum confidence threshold now skips preserved tasks
646 " ✅ CI workflow separates publish and GitHub Release decisions
647 " 🔴 Validator test suite extended for preservation and signal handling
648 " ⚖️ Roadmapsmith 0.9.7 targets release branch, not main
### Jun 9, 2026
2108 12:07a 🟣 Non-technical autoupdate comparison documentation created
2109 " ✅ Roadmap tasks added for autoupdate robustness improvements
2110 " 🔵 Release workflow investigation initiated for version bump
2111 12:08a 🔵 Roadmapsmith release infrastructure audit
2112 " 🔵 Current CI release workflow and version state
2113 " 🔵 Changelog format and release history
2114 12:09a 🔵 Package-lock version mismatch detected
2115 " ✅ Comprehensive documentation updates clarifying sync semantics and host support
2116 " 🔵 npm registry and package.json version alignment
2117 " 🟣 Package version bumped from 0.9.13 to 0.9.14 with lockfile regeneration
2118 12:10a 🔵 Version bump and lockfile alignment confirmed
2119 " 🟣 CHANGELOG.md entry added for v0.9.14 release
2120 " 🔵 npm test fails due to missing node in PATH

Access 708k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>