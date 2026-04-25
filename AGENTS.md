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
