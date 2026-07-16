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
node bin/cli.js sync --dry-run --project-root ..
node bin/cli.js sync --audit --project-root ..
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

- **`checkedById` is the only authority** for task checked state. Never derive checked state from other metadata in renderers. Every `<!-- rs:task=id -->` emission must use `checkedState(model, id)` — hardcoding `[ ]` silently breaks roundtrip preservation.
- **Task IDs are stable** via `<!-- rs:task=slug -->` markers. The slugification algorithm is locked; changing it breaks roundtrips.
- **`ROADMAP.md` is excluded from the evidence pool** (`SELF_REFERENTIAL_FILES`) — its task descriptions contain the exact vocabulary being validated and would cause every task to self-validate.
- **TODO detection requires comment prefix** (`//`, `#`, `*`) to avoid false positives in non-comment code like `TODO|FIXME` in regex patterns.
- **Test files are matched by import references only**, not by content keyword matching — test descriptions routinely mention future-task vocabulary.
- **Test discovery for `npm test` is scoped to `test/*.test.js`**. Files under `test/fixtures/` must never be run as tests.

## Config and File Resolution

The project uses `roadmap-skill.config.json` at the repo root (one level above `roadmap-skill/`). When running CLI commands against this repo, omit `--config` — auto-discovery finds it. Passing `--config` with a wrong path silently falls back to defaults.

Config fields `northStar`, `targetUser`, `problemStatement`, etc. are forward-compatible: recognized by the agent skill today, not yet wired into the generator/validator.

Config field `moduleMetadata` (object keyed by lowercased module/command name) drives Section 6 ("Maturity Path") of the professional profile. Each entry is `{ state: string, tasks: Array<{ text, priority, id }> }`. When a detected module/command name matches an entry, the renderer emits its `state` line and `tasks`; otherwise it falls back to generic "Document <name> public API" + "Add test coverage for <name>" tasks. See `roadmap-skill.config.json` in this monorepo root for a working example.

## PostToolUse Hook

`.claude/settings.json` in this repo registers a Claude-specific `PostToolUse` hook that runs `node .claude/hooks/roadmap-sync.js` after every Write/Edit operation. Treat it as a repo-local example, not as a host-agnostic integration contract.

This is a write-time hook, not the same thing as the git `pre-commit` hook. The write-time path is currently best-effort and depends on the host environment being able to resolve `node` for the spawned child process; the repo's `pre-commit` hook uses an absolute Node path and is stricter.

## Audit Semantics

`sync --audit` and `/roadmap-audit` are read-only: they run validation, print the mismatch summary, and exit with code 2 if `checkedWithoutEvidence` or `readyButUnchecked` are non-empty. They never modify ROADMAP.md. The `maintain` command uses a separate internal path (`options.audit`) that mutates first and then prints audit output — that is intentional and distinct from the `--audit` flag contract.

## Publishing

Release is fully automated. Two commands:

```bash
npm version patch          # or minor / major
git push --follow-tags
```

What happens under the hood:

1. `npm version` bumps `package.json`.
2. npm fires the `version` lifecycle script → `scripts/sync-skills.js --fix` propagates the new version to the 4 mirrored manifests (`.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `plugins/roadmapsmith/.codex-plugin/plugin.json`, `skills.json`) → `git add -A` stages them.
3. `npm version` creates the commit + tag with all mirrors inside.
4. `git push --follow-tags` uploads commit and tag.
5. `.github/workflows/release.yml` triggers on `package.json` change in `main`, compares local vs. published version, runs `npm publish --access public`, and creates the GitHub release with auto-generated notes.
6. On the publish itself, `prepublishOnly` runs `sync-skills.js --check` as the last safety net — publish aborts if any mirror is out of sync.

Never run `npm publish` locally. Never edit a mirrored manifest's `version` field by hand — the source of truth is `package.json` and drift will fail CI (`.github/workflows/mirror-check.yml`) and `prepublishOnly`.
