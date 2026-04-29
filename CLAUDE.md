# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

All source code, tests, and the npm package live in `roadmap-skill/`. Run every command from that directory:

```bash
cd roadmap-skill
npm install
npm test                                    # runs all tests via node --test test/*.test.js
node bin/cli.js --help
node bin/cli.js init --dry-run
node bin/cli.js generate --project-root . --dry-run --audit
node bin/cli.js validate --json --project-root .. --task <task-id>
node bin/cli.js sync --dry-run --audit --project-root ..
node bin/cli.js doctor --project-root ..
```

Run a single test file:
```bash
node --test test/validator.test.js
```

Test names are passed to filter:
```bash
node --test test/validator.test.js --test-name-pattern "passes when code"
```

## Architecture

The pipeline is unidirectional:

```
io.walkFiles → generator.scanProject → model.createRoadmapModel → renderer.renderBody
                                                                          ↓
parser.parseRoadmap ← ROADMAP.md ← parser.upsertManagedBlock ← generator.generateRoadmapDocument
       ↓
validator.validateTasks → sync.applySync → ROADMAP.md (updated)
```

**`src/io.js`** — Filesystem primitives: `walkFiles`, `detectLanguages`, `detectTestFrameworks`, `detectWorkspaces`. Ignores `node_modules`, `dist`, etc.

**`src/generator/index.js`** — Orchestrates the full roadmap generation: scans the repo, builds P0/P1/P2 task candidates, merges with existing tasks (preserving checked state), calls the renderer, and wraps output in the managed block. Key entry point: `generateRoadmapDocument(options)`.

**`src/validator/index.js`** — Multi-pass evidence scoring. Passes fire in priority order:
1. Explicit backtick-quoted paths in task text
2. Symbol name extraction (`function`/`class` patterns in text)
3. Code token matching (threshold scales with token count: 1/2/3 matches required)
4. Test file matching via import references only (not content)
5. Artifact presence (README, CHANGELOG, docs/, dist/)
6. Namespace structural gate — for task IDs with known prefixes (`evh2`, `uxf`, `cls`, etc.), at least one evidence file must match a path predicate for that namespace

`GENERIC_TASK_TOKENS` (line 18) is the blocklist that prevents common words from polluting evidence signals. Extend it when new false positives are found.

**`src/parser/index.js`** — Reads ROADMAP.md, extracts tasks with `<!-- rs:task=id -->` markers (stable IDs), tracks `lineIndex` and `warningLineIndex` for in-place sync. The managed block is bounded by `<!-- rs:managed:start -->` / `<!-- rs:managed:end -->` — `upsertManagedBlock` never touches content outside this region.

**`src/renderer/`** — `renderBody(model, profile)` dispatches to `compact.js` or `professional.js`. The `compact` profile is the stable default; `professional` renders a 12-section structured roadmap with Phase→Step→Task hierarchy.

**`src/sync/index.js`** — Applies `validateTasks` results onto ROADMAP.md lines: marks `[x]` for passing tasks, appends `⚠️ attempted but validation failed: <reason>` lines for failing ones. Uses line offsets to handle in-place splice.

**`src/config.js`** — Loads `roadmap-skill.config.json`, merges with defaults, exposes `loadPlugins` and `collectPluginContributions`. The `__roadmapFileExplicit` non-enumerable property tracks whether `roadmapFile` was explicitly set vs. defaulted (used by `resolveRoadmapFile`).

**`src/match.js`** — Jaccard-similarity task matching (`similarityScore`, threshold 0.55) for merging existing tasks with regenerated candidates. `dedupeTasks` resolves conflicts by: checked state wins, then lower priority number wins, then shorter text wins.

## Key Invariants

- **`checkedById` is the only authority** for task checked state. Never derive checked state from other metadata in renderers.
- **Task IDs are stable** via `<!-- rs:task=slug -->` markers. The slugification algorithm is locked; changing it breaks roundtrips.
- **`ROADMAP.md` is excluded from the evidence pool** (`SELF_REFERENTIAL_FILES`) — its task descriptions contain the exact vocabulary being validated and would cause every task to self-validate.
- **TODO detection requires comment prefix** (`//`, `#`, `*`) to avoid false positives in non-comment code like `TODO|FIXME` in regex patterns.
- **Test files are matched by import references only**, not by content keyword matching — test descriptions routinely mention future-task vocabulary.
- **Test discovery for `npm test` is scoped to `test/*.test.js`**. Files under `test/fixtures/` must never be run as tests.

## Config and File Resolution

The project uses `roadmap-skill.config.json` at the repo root (one level above `roadmap-skill/`). When running CLI commands against this repo, omit `--config` — auto-discovery finds it. Passing `--config` with a wrong path silently falls back to defaults.

Config fields `northStar`, `targetUser`, `problemStatement`, etc. are forward-compatible: recognized by the agent skill today, not yet wired into the generator/validator.

## PostToolUse Hook

`.claude/settings.json` registers a `PostToolUse` hook that runs `node .claude/hooks/roadmap-sync.js` after every Write/Edit operation. This automatically syncs ROADMAP.md against repository evidence.

## Publishing

```bash
cd roadmap-skill
npm test
npm whoami            # verify npm auth before publish
npm version patch     # or minor / major
npm publish --access public
git push origin main --follow-tags
```
