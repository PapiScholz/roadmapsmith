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

# [roadmapsmith] recent context, 2026-05-14 3:23am GMT-3

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 29 obs (11,104t read) | 687,003t work | 98% savings

### May 13, 2026
400 11:09p ⚖️ Validator API design: dual override modes for custom validators
401 " ⚖️ i18n file exclusion strategy: path + JSON structure + content heuristics
402 11:18p 🔴 Bug 3: Implemented rs:no-test marker to disable per-task test requirement
403 " 🔴 Bug 4 & 5: Excluded translation files and default template dirs from evidence index
404 " 🔴 Bug 2: Implemented weak path-token matching for non-English task descriptions
405 " 🔴 Bug 1: Custom validators now grant evidence and can override automatic results
406 " ✅ All 5 bugs fixed with comprehensive test coverage
### May 14, 2026
407 1:05a 🔵 Four validator bugs identified in v0.9.3: grant-evidence behavior, test detection gaps, dead code, and selector limitations
408 1:07a 🔵 Code analysis reveals initially-identified bugs are already implemented; rs:no-test and grant-evidence working correctly
409 1:13a 🔵 Four bugs identified in validator system through source code analysis (v0.9.3)
410 " 🔴 Fixed grant-evidence validator to work without undocumented overrideResult flag (Bug 1)
411 " 🟣 Added test detection for configuration file validation via fs.readFileSync patterns (Bug 2)
412 " 🟣 Added whenId validator rule support for stable task ID matching
413 " ✅ Updated validator documentation with new features and clarifications
414 " 🔵 All 120 validator tests pass after implementation; 3 of 4 bugs fixed
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

Access 687k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>