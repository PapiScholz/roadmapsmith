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

`roadmapsmith zero` is the public entrypoint. It does not expect the user to invent a free-form prompt. The CLI detects that Zero Mode applies, runs a terminal-native discovery interview, persists the brief into config, creates governance files when needed, and generates the first roadmap in one invocation.

The `roadmap-sync` skill remains the policy layer for agent hosts that use skills, but it is no longer the only way to access Zero Mode.

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

If existing config already contains answers, the interview uses those values as defaults so the developer does not have to restate the whole brief.

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
roadmapsmith zero
```

Optional policy layer for skill-based hosts:

```bash
npx skills add PapiScholz/roadmapsmith --skill roadmap-sync
```

## What makes a good discovery outcome

- North star is concrete, not generic ("build a CLI for X" not "build a product")
- v1.0 outcome is verifiable (you can check a box when it is true)
- Anti-goals eliminate ambiguity about scope before coding starts
- Risks are named early, not discovered mid-execution
- Phase P0 contains only the critical path to the first runnable version

## Guardrails

- Zero Mode must not generate a generic roadmap (for example: "Set up repo", "Add tests", "Deploy") without first completing discovery.
- In non-interactive environments, `roadmapsmith zero` must fail clearly instead of guessing the missing brief.
- Skill installation alone must not be presented as if it already enabled the CLI or VS Code task surface.
