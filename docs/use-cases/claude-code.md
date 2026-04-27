# Use Case: Claude Code Integration

## Who uses it

Developers using Claude Code (the Anthropic CLI) as their primary AI coding agent:
- Solo developers running multi-session Claude Code projects
- Teams using Claude Code with agent hooks for automated workflows
- Anyone who wants the roadmap to stay honest across many agent sessions

## When to use it

Use the Claude Code integration when:

- You run Claude Code sessions that implement tasks and want automatic sync after each session
- You want a pre-commit hook that validates roadmap state before every commit
- You are using the `roadmap-sync` skill inside Claude Code and want it to stay evidence-backed
- You want to resume a previous session and need ground truth on what is actually done

## How it works

RoadmapSmith ships with a `.claude/hooks/roadmap-sync.js` hook that fires after every file write in a Claude Code session. It automatically runs `roadmapsmith sync` whenever source files change, keeping the roadmap current without any manual intervention.

### Hook behavior

- Fires on every `Edit`, `Write`, or `MultiEdit` tool call that modifies a non-ROADMAP file
- Runs `roadmapsmith sync` in the background
- Skips if a sync is already in progress (lock-file guard)
- Does not block the agent or prompt for confirmation

## Setup

### Option 1: Install via skills

```bash
npx skills add PapiScholz/roadmapsmith --skill roadmap-sync
```

This installs the skill and the hook together.

### Option 2: Manual hook setup

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
# 1. Initialize roadmap files
roadmapsmith init

# 2. Start a Claude Code session — the skill guides the agent
# 3. The agent implements tasks; the hook syncs the roadmap after each file write
# 4. At the end of the session, verify the state is accurate
roadmapsmith sync --audit

# 5. Commit — the pre-commit hook runs a final sync
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
```

Use `validate --json` when you want to inspect per-task evidence before taking action. Use `generate` when the roadmap structure itself needs to be updated.

## Guardrails enforced

- The agent must not mark tasks complete without running `roadmapsmith sync` or providing a `<!-- rs:task=... -->` comment
- The pre-commit hook is the last line of defense — it runs sync before every commit
- If sync would revert a checked task, that means evidence is missing and the task is not actually done
- The `roadmap-sync` skill guards against hallucinated completion claims across all session types

## Troubleshooting

**Hook not firing:** Verify the hook is registered in `.claude/settings.json` and the file path is correct.

**Sync reverts a task I just completed:** Run `roadmapsmith validate --json` to see what evidence the validator found. The task text or file path in the roadmap may not match what the agent created.

**Lock file blocks sync:** Delete `.claude/hooks/.sync.lock` if a previous sync was interrupted.
