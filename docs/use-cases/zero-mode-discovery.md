# Use Case: Zero Mode Discovery

## Who uses it

Developers starting a new project with:
- An empty or near-empty repository
- A product idea that has not yet been formally defined
- No implementation files, no stack decision, no ROADMAP.md

## When to use it

Use Zero Mode when:

- The repository has no meaningful source files (`src/`, `lib/`, language files)
- `ROADMAP.md` does not exist or contains no tasks
- The stack (language, framework, hosting) has not been decided
- The developer cannot yet describe v1.0 in concrete terms

Do not use Zero Mode for a repository that already has code, tests, or a partial roadmap. Use Sync/Audit Mode instead.

## How it works

The AI agent (using the `roadmap-sync` skill) detects low-context conditions and does not immediately generate a generic roadmap. Instead, it runs a discovery conversation to build a product brief.

### Discovery Questions

The agent asks up to 8 questions:

1. What product are we building?
2. Who is the target user?
3. What problem does it solve?
4. What is the desired v1.0 outcome?
5. What is explicitly out of scope?
6. What stack do you prefer, if any?
7. What constraints exist? (Budget, hosting, compliance, platform, deadline.)
8. What does "done" mean for the first usable version?

If the developer already provided enough context in their initial prompt, the agent summarizes the inferred product brief and asks for confirmation rather than repeating questions.

## Expected ROADMAP.md sections after discovery

A well-formed Zero Mode roadmap includes:

- **Product North Star** — one sentence describing the end state
- **Target User and Problem Statement** — who benefits and what pain is addressed
- **v1.0 Outcome** — specific, observable success criteria
- **Anti-Goals** — what the product explicitly does not do
- **Risks** — known threats to scope, timeline, or execution
- **Phased task list** — P0 critical path → P1 important → P2 optimization
- **Release Milestones** — version markers tied to delivery goals

## Example workflow

```bash
# 1. Install the skill
npx skills add PapiScholz/roadmapsmith --skill roadmap-sync

# 2. Initialize governance files (creates ROADMAP.md and AGENTS.md stubs)
roadmapsmith init

# 3. Start an agent session — the skill detects empty context and runs discovery
# 4. Agent asks the discovery questions, developer answers
# 5. Agent generates ROADMAP.md from the confirmed product brief

roadmapsmith generate --project-root .
```

## What makes a good discovery outcome

- North star is concrete, not generic ("build a CLI for X" not "build a product")
- v1.0 outcome is verifiable (you can check a box when it is true)
- Anti-goals eliminate ambiguity about scope before coding starts
- Risks are named early, not discovered mid-execution
- Phase P0 contains only the critical path to the first runnable version

## Guardrail

The agent must not generate a generic roadmap (e.g., "Set up repo", "Add tests", "Deploy") without first completing discovery. Generic tasks have no product context and produce no execution value.
