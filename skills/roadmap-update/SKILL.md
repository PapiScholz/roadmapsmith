---
name: roadmap-update
description: Refresh ROADMAP.md with evidence-backed validation, add tasks, record evidence, or check northStar drift using the RoadmapSmith CLI.
---

# RoadmapSmith Update

Use this skill when the user wants to sync the roadmap after code changes, add a new task, mark a task complete with evidence, or check if the project has drifted from its northStar.

## Safety

As of v0.13.0, `roadmapsmith update` is annotate-only by default: it writes ⚠️ / ✅ sub-bullets but never flips `[ ]`/`[x]` checkboxes. Checkbox mutation is gated behind `--apply`.

## Required behavior

**Step 1 — Annotate + audit (safe default):**
```
roadmapsmith update --audit --project-root .
```
Writes ⚠️ / ✅ sub-bullets. Zero checkbox mutation. Review the audit output — the "Unchecked by this run" list will be empty because nothing was flipped; focus on "Ready but unchecked" and "Checked with weak evidence".

**Step 2 — Apply mutations (after reviewing Step 1):**
```
roadmapsmith update --apply --project-root .
```
Flips `[ ] → [x]` for tasks whose evidence was found and `[x] → [ ]` for tasks whose evidence is missing. Use `--dry-run` if you want the mutation preview without writing.

**Add a new task:**
```
roadmapsmith update --add-task "Task description" --project-root .
```

**Record evidence for a specific task:**
```
roadmapsmith update --task TASK-ID --evidence "path/to/file.js passes tests" --project-root .
```

**Check northStar drift** (requires `product.northStar` in `roadmap-skill.config.json`):
```
roadmapsmith update --check-drift --project-root .
```

Available update flags:
- `--apply` — flip `[ ]`/`[x]` checkboxes (default is annotate-only)
- `--add-task <text>` — insert a new task into the managed block
- `--task <id>` — task ID to target (use with `--evidence`)
- `--evidence <text>` — evidence to attach to `--task`
- `--audit` — show validation audit after refresh (grouped by cause: `path-mismatch`, `no-evidence`, `deletion-task`, `namespace-gate`, `strict-mode`)
- `--evidence-only` — legacy alias; now a silent no-op since annotate-only is the default
- `--concise` / `--no-warnings` — suppress ⚠️ warning lines in the emitted markdown (safe for READMEs / PR embeds)
- `--check-drift` — compare northStar to repo state; exits `2` when drift is detected
- `--strict` — strict validation mode (preservedCheckedState does not count as pass)
- `--dry-run` — preview without writing
- `--json` — output in JSON format
- `--project-root <path>` — project root (default: cwd)

## Task marker attributes

Tasks use a stable-id comment: `<!-- rs:task=slug -->`. As of v0.13.0, the same comment can carry two orthogonal axes:

**State axis — `rs:planned`:**
- `rs:planned` — "intentionally not implemented yet". Validator skips evidence hunt. Sync emits **no** ⚠️ warning and does not flip the checkbox. Use for future scope you want on the roadmap without polluting every refresh with warnings. Example: `- [ ] Ship v0.2 feature X <!-- rs:task=ship-x rs:planned -->`.

**Kind axis — `rs:kind=<rollup|command|manual>`:**
- `rs:kind=rollup` — "milestone/aggregator; children carry the evidence". Passes validation without a file-existence hunt. Use for phase exits, milestone rollups, "Finalize module implementation" style parent tasks. Example: `- [x] Milestone v0.2 shipped <!-- rs:task=milestone-v0-2 rs:kind=rollup -->`.
- `rs:kind=command` + `rs:verified-by=<command>` — "evidence = a command exits 0". Passes validation on the marker alone during `update` (no shell execution). To actually run the command and flip the checkbox, use `roadmapsmith verify --task <id> --run`. Example: `- [ ] TypeScript compila sin errores <!-- rs:task=tsc-clean rs:kind=command rs:verified-by=tsc-noemit -->`. Note: `rs:verified-by` captures a single non-whitespace token — use a script path or an npm-script name if the command needs arguments.
- `rs:kind=manual` — human-attested completion. Trust the checked state, no evidence hunt. Use for delete/cleanup tasks whose completion is an absence, or anything a human verified out-of-band. Example: `- [x] Eliminar directorios legacy <!-- rs:task=drop-legacy rs:kind=manual -->`.

An unknown `rs:kind=<value>` throws a parse error listing the three valid values.

### Migration from pre-v0.13 markers

`rs:evidence=manual` and `rs:no-test` are removed. `parseRoadmap` throws with a `Deprecated marker …` error when it encounters either. Run this once per repo before upgrading to 0.13.0:

```
roadmapsmith migrate-markers --project-root . --dry-run   # preview
roadmapsmith migrate-markers --project-root .             # apply
```

The migrator rewrites `rs:evidence=manual` → `rs:kind=manual` (same bypass semantics) and drops `rs:no-test` (it was a silent no-op). Exits `0` when there is nothing to migrate.

## Command-verified tasks (`verify`)

For tasks marked `rs:kind=command`, `roadmapsmith update --audit` prints a **"Command-verified tasks pending run"** block listing the exact ready-to-run invocation for each unchecked command task:

```
Command-verified tasks pending run (2):
- [tsc-clean] roadmapsmith verify --task tsc-clean --run   # (would run: tsc-noemit)
- [test-suite] roadmapsmith verify --task test-suite --run # (would run: npm-test)
```

When you (agent) see that block, invoke each `verify --task <id> --run` yourself — the human user should not have to type them. `verify --run` executes the `rs:verified-by` command in the repo root, prints stdout/stderr, and flips `[x]` on exit 0. Non-zero exit leaves the checkbox unchecked and CLI exits with code 2.

`verify --task <id>` without `--run` is a dry-preview that just prints `Would run: <command>`.

## Known limitations

- **Path resolution assumes paths in task text are relative to the repo root.** Monorepos can now add a `pathAliases` object to `roadmap-skill.config.json` (e.g. `{ "/dashboard/": "apps/web/src/app/dashboard/" }`). Without it, task text needs the full prefix. Symptoms: legitimate `[x]` tasks unchecked with `missing referenced file(s): ...` on paths that DO exist under a subdirectory.
- **Deletion tasks are recognized by keyword.** A task whose text contains `eliminado`/`eliminada`/`borrado`/`borrada`/`deleted`/`removed`/`dropped` AND names an explicit path is validated as an absence assertion: it passes when the file is absent, fails with `expected file removed, still present at <path>` if it still exists. Phrase deletion tasks accordingly, or fall back to `~~strikethrough~~` for manual attestation.
- **Duplicate explicit Task IDs are surfaced as warnings.** If the same `<!-- rs:task=id -->` appears in two sections (e.g. plan + archive), `roadmapsmith update` prints a `⚠️  Duplicate explicit task id "<id>"` warning naming both line numbers. Sync still treats them as independent — merge or rename one.
- **`[ ] → [x]` auto-checks emit a `✅ evidence:` sub-bullet** naming the matched file or symbol. If the sub-bullet is missing or looks weak, verify by hand — the tool can auto-check on shallow token overlap.

## Before running this skill in a new repo

- [ ] Are task descriptions using paths relative to the repo root? For monorepos, add a `pathAliases` object in `roadmap-skill.config.json` mapping the prefix used in task text (e.g. `/dashboard/`) to the real subdirectory (`apps/web/src/app/dashboard/`).
- [ ] Does the roadmap duplicate explicit task IDs across sections? The tool will warn but not merge — decide whether to consolidate or rename.
- [ ] Are there tasks phrased as deletions (`"X eliminado"`, `"X removed"`, `"borrado"`)? Confirm the file path is quoted with backticks so the deletion pass can extract it.

Always use `--dry-run` first when uncertain about the impact.
