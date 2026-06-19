# Use Case: Claude Code Integration

## Who uses it

Developers using Claude Code (the Anthropic CLI) as their primary AI coding agent:
- Solo developers running multi-session Claude Code projects
- Teams using Claude Code with agent hooks for automated workflows
- Anyone who wants the roadmap to stay honest across many agent sessions
- Anyone who wants native Claude GUI slash commands instead of relying on a single legacy `/roadmap-sync` root

## When to use it

Use the Claude Code integration when:

- You run Claude Code sessions that implement tasks and want an optional repo-local hook after each session
- You want the Claude GUI slash list to expose `/roadmap`, `/roadmap-zero`, `/roadmap-maintain`, `/roadmap-status`, `/roadmap-update`, and the rest of the RoadmapSmith surface directly
- You want a pre-commit hook that validates roadmap state before every commit
- You are using the `roadmap-sync` skill inside Claude Code and want it to stay evidence-backed
- You want to resume a previous session and need ground truth on what is actually done

## How it works

This repository now has two Claude-facing layers:

- Native Claude GUI skills that expose slash commands like `/roadmap`, `/roadmap-zero`, `/roadmap-maintain`, `/roadmap-status`, `/roadmap-update`, and `/roadmap-setup`
- An optional repo-local `.claude/hooks/roadmap-sync.js` hook that fires after writes and runs `roadmapsmith sync`

Codex now has its own native plugin surface through `.codex-plugin/plugin.json`, but this document stays focused on the Claude-specific install path and hook behavior. The native Claude slash list comes from the installed skill bundle, not from the CLI slash router by itself. The CLI still executes the real actions. Published RoadmapSmith package/plugin artifacts now mirror the same shared bundle on disk for both hosts, but each host still has to load its own surface before the GUI changes.

The write-time hook is best-effort today. It depends on the Claude host environment being able to resolve `node` for the child process launched by the hook script.

### Hook behavior

- Fires on every `Edit`, `Write`, or `MultiEdit` tool call that modifies a non-ROADMAP file
- Runs `roadmapsmith sync` in the background
- Skips if a sync is already in progress (lock-file guard)
- Does not block the agent or prompt for confirmation
- Is separate from the git `pre-commit` hook used by this repository; write-time hook behavior and commit-time behavior are not the same contract

## Setup

### Option 1: Install via CLI + setup

```bash
npm install -g roadmapsmith
roadmapsmith setup --hosts codex,claude
```

This creates the visible VS Code task layer and upserts the repo-local Claude hook wiring.

### Option 2: Install the full Claude skill bundle

```bash
npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code
```

Then refresh the current Claude session:

```text
/reload-skills
/reload-plugins
```

This exposes the native Claude GUI slash commands:

- `/roadmap`
- `/roadmap-zero`
- `/roadmap-maintain`
- `/roadmap-status`
- `/roadmap-init`
- `/roadmap-generate`
- `/roadmap-validate`
- `/roadmap-update`
- `/roadmap-audit`
- `/roadmap-setup`

It still does not install the CLI; the CLI must be installed separately for those commands to execute. That same bundle is now also present in the published package/plugin artifact alongside the Codex plugin manifest for downstream host installers that do not fetch directly from the GitHub working tree.

### Option 3: Install only the legacy compatibility skill

```bash
npx skills add PapiScholz/roadmapsmith --skill roadmap-sync
```

This installs only the legacy namespaced slash root `/roadmap-sync` plus the policy instructions. It does not expose the full Claude GUI command list.

### Option 4: Manual hook setup

Copy `.claude/hooks/roadmap-sync.js` to your project's `.claude/hooks/` directory, then register it in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/roadmap-sync.js"
          }
        ]
      }
    ]
  }
}
```

## Typical workflow with Claude Code

```bash
# 1. Install the CLI and the native Claude GUI skill bundle
npm install -g roadmapsmith
npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code
roadmapsmith setup --hosts codex,claude

# 2. For a new repo, create the first roadmap in one command
roadmapsmith zero

# 3. For an existing repo, run the maintenance flow in one command
roadmapsmith maintain

# 4. At the end of the session, verify the state is accurate
roadmapsmith sync --audit

# 5. Commit — if you use a pre-commit hook, it can run a final sync
git commit -m "feat: implement task X"
```

Then, inside Claude Code, run `/reload-skills` and, if applicable, `/reload-plugins`. Start the session with `/roadmap` for discovery or jump straight to `/roadmap-zero`, `/roadmap-maintain`, `/roadmap-update`, and the other native slash commands.

## Skill integration

The RoadmapSmith Claude skill bundle tells the Claude Code agent:

- How to read and interpret `ROADMAP.md`
- When to run `roadmapsmith sync` vs. `validate` vs. `generate`
- How to handle evidence-based task completion — never mark `[x]` without evidence
- How to resume a previous session using `roadmapsmith validate --json`

The legacy `roadmap-sync` skill remains the namespaced compatibility entrypoint and policy/orchestration layer. The bundle enforces the core RoadmapSmith guarantee: task completion must be backed by real repository evidence, not the agent's self-report.

## Resuming a session

```bash
# Get the current evidence state for all tasks as JSON
roadmapsmith validate --json

# Rebuild the managed block from current repository context
roadmapsmith generate --project-root .

# Apply evidence-backed sync
roadmapsmith sync

# Preview the next roadmap mutation without writing
roadmapsmith sync --dry-run
```

Use `validate --json` when you want to inspect per-task evidence before taking action. Use `generate` when the roadmap structure itself needs to be updated.

## Guardrails enforced

- The agent must not mark tasks complete without running `roadmapsmith sync` or providing a `<!-- rs:task=... -->` comment
- A pre-commit hook is optional; if you add one, it can run sync before every commit
- If sync would revert a checked task, that means evidence is missing and the task is not actually done
- The `roadmap-sync` skill guards against hallucinated completion claims across all session types

## Troubleshooting

**Hook not firing:** Verify the hook is registered in `.claude/settings.json` and the file path is correct.

**Slash commands not visible in Claude GUI:** Install or update the full skill bundle with `npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code`, then run `/reload-skills` and, if applicable, `/reload-plugins`. Installing only `--skill roadmap-sync` exposes only `/roadmap-sync`. If you are consuming a published package/plugin artifact instead of a GitHub-source install, confirm that your Claude host is actually loading the bundled `skills.json` plus `skills/*` surface rather than only the Codex plugin metadata.

`roadmapsmith status --json` now separates the native slash surfaces (`claudeGui`, `claudeCli`, `codexGui`, `codexCli`) from the repo-local VS Code task and Claude hook layer. `roadmapsmith doctor --json` remains a compatibility alias. Use that output when you need to distinguish “the bundle exists” from “the host actually loaded it.”

**Hook runs but ROADMAP does not update:** Confirm the Claude hook environment can resolve `node`. Today the repo-local write-time hook is best-effort and depends on that host-level resolution.

**Sync reverts a task I just completed:** Run `roadmapsmith validate --json` to see what evidence the validator found. The task text or file path in the roadmap may not match what the agent created.

**Lock file blocks sync:** Delete `.claude/hooks/.sync.lock` if a previous sync was interrupted.
