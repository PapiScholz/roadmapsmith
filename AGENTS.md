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

# [roadmapsmith] recent context, 2026-05-14 1:18am GMT-3

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 15 obs (6,124t read) | 526,596t work | 99% savings

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

Access 527k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>