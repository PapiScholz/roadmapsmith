# Use Case: Claude Code Integration

## Who uses it

Developers using Claude Code (the Anthropic CLI) as their primary AI coding agent:
- Solo developers running multi-session Claude Code projects
- Teams using Claude Code with agent hooks for automated workflows
- Anyone who wants the roadmap to stay honest across many agent sessions

## When to use it

Use the Claude Code integration when:

- You run Claude Code sessions that implement tasks and want an optional repo-local hook after each session
- You want a pre-commit hook that validates roadmap state before every commit
- You are using the `roadmap-sync` skill inside Claude Code and want it to stay evidence-backed
- You want to resume a previous session and need ground truth on what is actually done

## How it works

This repository includes an example `.claude/hooks/roadmap-sync.js` script for Claude Code. If you wire it into `.claude/settings.json`, it fires after every file write and runs `roadmapsmith sync`. That workflow is Claude-specific today; the visible UX surface still starts with `roadmapsmith setup`, `roadmapsmith zero`, and `roadmapsmith maintain`.

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

### Option 2: Install the optional skill

```bash
npx skills add PapiScholz/roadmapsmith --skill roadmap-sync
```

This installs the agent policy instructions only. It does not install the CLI.

### Option 3: Manual hook setup

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
# 1. Install the visible host UX and optional skill
roadmapsmith setup --hosts codex,claude
npx skills add PapiScholz/roadmapsmith --skill roadmap-sync

# 2. For a new repo, create the first roadmap in one command
roadmapsmith zero

# 3. For an existing repo, run the maintenance flow in one command
roadmapsmith maintain

# 4. Start a Claude Code session — the skill guides the agent
# 5. The agent implements tasks; the optional hook syncs the roadmap after each file write
# 6. At the end of the session, verify the state is accurate
roadmapsmith sync --audit

# 7. Commit — if you use a pre-commit hook, it can run a final sync
git commit -m "feat: implement task X"
```

## Skill integration

The `roadmap-sync` skill in `.claude/skills/` (and platform-equivalent directories) tells the Claude Code agent:

- How to read and interpret `ROADMAP.md`
- When to run `roadmapsmith sync` vs. `validate` vs. `generate`
- How to handle evidence-based task completion — never mark `[x]` without evidence
- How to resume a previous session using `roadmapsmith validate --json`

The skill enforces the core RoadmapSmith guarantee: task completion must be backed by real repository evidence, not the agent's self-report.

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

**Hook runs but ROADMAP does not update:** Confirm the Claude hook environment can resolve `node`. Today the repo-local write-time hook is best-effort and depends on that host-level resolution.

**Sync reverts a task I just completed:** Run `roadmapsmith validate --json` to see what evidence the validator found. The task text or file path in the roadmap may not match what the agent created.

**Lock file blocks sync:** Delete `.claude/hooks/.sync.lock` if a previous sync was interrupted.
