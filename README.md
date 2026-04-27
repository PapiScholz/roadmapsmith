# RoadmapSmith

Turn vague software ideas into deterministic, evidence-trackable roadmaps for AI coding agents — then keep them honest with repository-backed validation.

[![npm version](https://img.shields.io/npm/v/roadmapsmith.svg)](https://www.npmjs.com/package/roadmapsmith)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)

## Quick Start

```bash
npm install -g roadmapsmith
roadmapsmith init
roadmapsmith generate --project-root .
roadmapsmith sync --audit
```

## Demo

> 30-second demo coming soon — see [docs/use-cases/claude-code.md](docs/use-cases/claude-code.md) for a walkthrough.

---

## What Problem This Solves

AI coding agents operate in sessions — they lose context, rely on self-reported completion, and have no external validation anchor. Without a grounding mechanism, a task marked `[x]` means only that the model decided it was done. RoadmapSmith addresses three compounding problems:

**Hallucinated completion.** Agents claim task completion without traceable evidence in code, tests, or artifacts. RoadmapSmith validates completion against repository state — not the agent's self-assessment.

**Roadmap drift.** Generated roadmaps go stale as the project evolves. The `generate` and `sync` commands rebuild and reconcile the roadmap from actual repository context: detected languages, modules, test frameworks, and TODO markers read directly from the filesystem.

**Session discontinuity.** Multi-session agent workflows lose progress context between sessions. `ROADMAP.md` serves as a durable, inspectable state file that any session can read, trust, and extend — without relying on conversation history.

---

## What Makes This Different

| | RoadmapSmith | TODO list | Jira | Naive agent workflow |
|---|---|---|---|---|
| Grounded in repository state | ✓ | ✗ | ✗ | ✗ |
| Detects hallucinated completion | ✓ | ✗ | ✗ | ✗ |
| Deterministic generation | ✓ | ✗ | ✗ | ✗ |
| Zero production dependencies | ✓ | — | ✗ | — |
| Multi-session compatible | ✓ | varies | ✓ | varies |

TODO lists track intent. Jira tracks human-managed status. Neither validates that code actually changed. A naive agent workflow trusts the model's output — which means accepting hallucinations as ground truth.

RoadmapSmith introduces a third path: **validation by evidence**. Before `sync` marks a task complete, the validator runs a multi-pass evidence scan: explicit file paths mentioned in the task text → symbol names → code token matching → test file matching → artifact presence (README, CHANGELOG, docs/, dist/). The model's claim is one input; the repository is the authority.

---

## How It Works

```
roadmapsmith init              # Write ROADMAP.md + AGENTS.md governance files
roadmapsmith generate          # Scan repo → emit deterministic task candidates
roadmapsmith validate --json   # Check task completion against code/test/artifact evidence
roadmapsmith sync              # Apply validation results (mark ✓ or warn ⚠️)
roadmapsmith sync --audit      # Report mismatches: checked without evidence, ready but unchecked
```

Each command is independent and composable. Agents typically run `sync` after making changes; CI can run `sync --audit` to fail on mismatched state.

**`generate`** indexes your repository for languages, test frameworks, modules in `src/`, `lib/`, `packages/`, and TODO/FIXME markers (up to 120 files). It emits deterministic task candidates — same input always produces the same structure. Task IDs are stable across regenerations via `<!-- rs:task=id -->` markers.

**`validate`** runs the multi-pass evidence scan. Each task is scored against: backtick-quoted paths in task text, symbol names, code token matching (threshold: 2+ matches for multi-token tasks), test file matching, and artifact presence. Results include the reason a task passed or failed.

**`sync`** writes only within a `<!-- rs:managed:start/end -->` block, leaving the rest of your `ROADMAP.md` untouched. It marks passing tasks `[x]` and appends `⚠️ attempted but validation failed: <reason>` for failing ones.

---

## Two Operating Modes

### Zero Mode: Start from an empty repository

Use this when you have:

- A new or empty repository
- A vague product idea with no implementation files
- No stack decision yet
- No ROADMAP.md yet

Expected agent behavior:

- Do not immediately generate a generic roadmap.
- First run a discovery conversation to define the product brief.
- Define the product north star, target user, and problem statement.
- Recommend or confirm stack after understanding constraints.
- Define the v1.0 outcome, anti-goals, and risks.
- Generate ROADMAP.md as the execution contract.

Discovery questions the agent will ask:

1. What product are we building?
2. Who is the target user?
3. What problem does it solve?
4. What is the desired v1.0 outcome?
5. What is explicitly out of scope?
6. What stack do you prefer, if any?
7. What constraints exist? (Budget, hosting, compliance, platform, deadline.)
8. What does "done" mean for the first usable version?

Recommended workflow:

```bash
npx skills add PapiScholz/roadmapsmith --skill roadmap-sync
roadmapsmith init
roadmapsmith generate --project-root .
```

The CLI creates governance files. The AI agent performs the discovery interview using the `roadmap-sync` skill instructions before generating the roadmap.

---

### Sync/Audit Mode: Keep an existing roadmap honest

Use this when your repository already has code, tests, docs, TODOs, or an existing ROADMAP.md.

Expected behavior:

- Scan repository context: detect languages, modules, commands, test frameworks, TODO/FIXME markers.
- Generate or update the managed roadmap block.
- Validate tasks against repository evidence.
- Sync checklist state.
- Audit mismatches.

Recommended workflow:

```bash
roadmapsmith generate --project-root .
roadmapsmith validate --json
roadmapsmith sync --audit
```

This is the current mature mode. It is not deprecated — it is the primary workflow for any repository with existing implementation.

---

## Roadmap Profiles

RoadmapSmith supports multiple output profiles. Set `roadmapProfile` in `roadmap-skill.config.json`:

| Profile | Description | Status |
|---|---|---|
| `compact` | Checklist-style output grouped by phase (P0/P1/P2). Default. Backward compatible. | Stable |
| `professional` | 12-section roadmap with Phase → Step → Task hierarchy and task-level priority labels. | Stable |
| `enterprise` | Extended profile with additional governance sections. | Planned |

### Selecting a profile

```json
{
  "roadmapProfile": "professional",
  "product": {
    "name": "My Project",
    "northStar": "One sentence that describes the product mission.",
    "positioning": "What makes this different from alternatives.",
    "primaryUser": "Who uses this and in what context.",
    "targetOutcome": "What success looks like for the user.",
    "antiGoals": ["Things this product will never do"],
    "risks": ["Known risks to delivery or adoption"],
    "successCriteria": ["Measurable criteria for v1.0"],
    "phases": [
      {
        "phaseNumber": 1, "title": "Foundation", "priority": "P0",
        "objective": "Establish a baseline.",
        "steps": [{
          "stepNumber": 1, "title": "Core Setup", "priority": "P0",
          "dependsOn": [], "objective": "Close critical path items.",
          "tasks": [
            { "id": "prof-task-setup-ci", "text": "Set up CI pipeline", "priority": "P0" },
            { "id": "prof-task-add-tests", "text": "Add automated tests", "priority": "P1" }
          ],
          "exitCriteria": [{ "text": "CI green on main", "priority": "P0" }],
          "risks": []
        }]
      }
    ]
  }
}
```

`product.phases` is optional — if omitted, phases are inferred from P0/P1/P2 task groups. Priority at every level (phase, step, task) is a display label only. Phases and steps always sort by number, never by priority.

**Supported priority labels:** `P0` (critical), `P1` (high), `P2` (normal), `P3` (later/backlog). All are valid at phase, step, and task level. In dedup resolution, lower numbers win; `P3` items are deprioritized but never silently upgraded.

**`customPhases`** — top-level config key (sibling to `roadmapProfile`, outside `product`) that overrides inferred phase groups with explicit structure:

```json
{
  "customPhases": [
    {
      "phaseNumber": 4,
      "title": "Launch Preparation",
      "priority": "P1",
      "objective": "Prepare the project for public release.",
      "steps": [
        {
          "stepNumber": 1,
          "title": "Repository Polish",
          "priority": "P1",
          "dependsOn": [3],
          "tasks": [
            { "id": "mkt-add-demo", "text": "Add demo.gif or README placeholder", "priority": "P1" }
          ]
        }
      ]
    }
  ]
}
```

Set `validation.minimumConfidence` to suppress low-confidence results in CI:

```json
{
  "validation": { "minimumConfidence": "medium" }
}
```

### Professional profile output example

This repository's own `ROADMAP.md` is generated with RoadmapSmith using the `professional` profile. Here is an excerpt from Section 4:

```markdown
## 4. Phased Execution Roadmap

### Phase 1: Product Architecture
**Phase Priority:** `[P1]`
**Objective:** Establish the renderer architecture and model hierarchy.

#### Step 1.2: Model Improvements
**Step Priority:** `[P0]`   ← P0 priority inside a P1 phase; renders second (stepNumber=2)
**Depends on:** None

**Tasks:**
- [ ] `[P0]` Add phasesDetailed model field <!-- rs:task=prof-task-add-phasesdetailed-model-field -->
- [ ] `[P1]` Filter code vs doc TODOs       <!-- rs:task=prof-task-filter-code-vs-doc-todos -->

**Exit Criteria:**
- [ ] `[P0]` A P0 task in a P2 step renders with [P0] label in correct position <!-- rs:task=prof-ph1-st2-exit-... -->
```

## When to use RoadmapSmith

Use RoadmapSmith when:

- You work with AI coding agents across multiple sessions
- Your project roadmap gets outdated quickly
- Agents complete tasks but forget to update documentation
- You need visible progress by phases, priorities, and releases
- You want completed checklist items backed by repository evidence

Do not use it if:

- Your project is a one-file script
- You do not use roadmaps or agent workflows
- You only need a static TODO list

## Commands

| Command | Purpose |
|---|---|
| `roadmapsmith init` | Create `ROADMAP.md` and `AGENTS.md` governance files |
| `roadmapsmith generate --project-root .` | Generate a roadmap from repository context |
| `roadmapsmith validate --json` | Validate roadmap task evidence and emit JSON results |
| `roadmapsmith sync --audit` | Check completed tasks against evidence |
| `roadmapsmith doctor` | Check basic repository health: config loads and ROADMAP.md exists |
| `npx skills add PapiScholz/roadmapsmith --skill roadmap-sync` | Install the agent skill |

## Install: Agent Skill (Primary)

### skills.sh and agentskill.sh

```bash
npx skills add PapiScholz/roadmapsmith --skill roadmap-sync
```

This adds the `roadmap-sync` agent skill. It does not install the CLI package.

### aitmpl.com/skills

Search for `roadmapsmith` on [aitmpl.com/skills](https://aitmpl.com/skills) and follow the install prompt, or install directly using the skills CLI above.

## Install: CLI (Optional)

```bash
npm install -g roadmapsmith
roadmapsmith init
roadmapsmith generate --project-root .
roadmapsmith validate --json
roadmapsmith sync --audit
```

## Local Development

```bash
cd roadmap-skill
npm install
npm test
node bin/cli.js --help
node bin/cli.js init --dry-run
node bin/cli.js generate --project-root . --dry-run --audit
node bin/cli.js validate --json
```

## Naming Model

- RoadmapSmith: project/product name.
- roadmap-sync: installable agent skill name.
- roadmapsmith: optional CLI package and preferred command.
- roadmap-skill/: npm package directory.

## Repository Layout

```text
roadmapsmith/
├── README.md
├── AGENTS.md
├── ROADMAP.md
├── CHANGELOG.md
├── skills.json
├── skills/
│   └── roadmap-sync/
│       └── SKILL.md
├── .claude-plugin/
│   └── plugin.json
└── roadmap-skill/
    ├── package.json
    ├── bin/
    │   └── cli.js
    ├── src/
    │   ├── index.js
    │   ├── config.js
    │   ├── io.js
    │   ├── match.js
    │   ├── model.js
    │   ├── utils.js
    │   ├── generator/
    │   ├── parser/
    │   ├── renderer/
    │   ├── sync/
    │   └── validator/
    ├── templates/
    └── test/
```

## Agent Safety Layer

Validation in RoadmapSmith is not a binary truth check — it is **constrained trust**.

The validation pipeline combines multiple evidence signals with a configurable confidence threshold. A task passes only when accumulated evidence exceeds that threshold. The intent is not to prove correctness; it is to prevent a model from asserting completion with no supporting evidence in the repository.

This maps to a concrete safety principle: **autonomous execution requires traceable justification**. An agent that marks a task complete should point to the change. If it cannot, the task does not advance.

Current guardrails built into the system:
- Tasks with insufficient evidence emit `⚠️ attempted but validation failed: <reason>` in the roadmap
- `sync --audit` surfaces tasks marked complete without passing validation
- `validate --json` traces exactly why each task passed or failed — every evidence signal is reported

The `AGENTS.md` file (generated by `init`) provides the agent with explicit execution rules: do not mark tasks complete without calling `sync`, do not override validation warnings, scope test discovery to declared test directories.

---

## Use Cases

**AI coding agents (Claude, Codex, GPT-4o)**
Install `roadmap-sync` as a skill. Agents run `generate` at session start to rehydrate context, `sync` after each completed task, and `sync --audit` before reporting done. The `ROADMAP.md` becomes a reliable contract between sessions — not a note the model wrote to itself.

**Multi-session development workflows**
Each session starts from the same `ROADMAP.md` ground truth. Completed tasks are backed by evidence; in-progress tasks are visible without reading git history or asking the agent to summarize its own work.

**Teams using AI-assisted development**
The `--audit` flag produces a reviewable record: which tasks were attempted, which passed validation, which were claimed complete without evidence. This is the audit trail you need when an agent opens a PR and you need to trust it.

---

## Philosophy

> Agents should not be trusted blindly. Execution must be provable. Determinism is not a feature — it is the foundation.

**Constrained autonomy over unchecked execution.** The goal is not to restrict agents — it is to give them a mechanism to prove their work. An agent that passes validation is more trustworthy, not less autonomous.

**Determinism is a first-class requirement.** Given the same repository state, `generate` always produces the same roadmap structure. Task IDs are stable. Sync is idempotent. Without this property, the audit trail is meaningless — you cannot compare runs or detect drift.

**Evidence over assertion.** A model stating "I implemented X" is an assertion. A diff containing the relevant symbols, a test file referencing the feature, a CHANGELOG entry — those are evidence. RoadmapSmith treats them differently by design.

---

## Limitations (Transparent)

**Validation can produce false positives.** Token-matching is not semantic analysis. A task mentioning "authentication" will match any file containing that word, including unrelated modules. This is a known current limitation. Stricter semantic matching and multi-evidence requirements are tracked as P0 priorities in the roadmap.

**No caching.** Every `validate` or `sync` call walks the full repository. On large codebases this will be slow. A caching layer for `buildValidationContext()` is planned but not yet implemented (P2).

**Requires disciplined usage.** RoadmapSmith enforces nothing on the agent itself — it reports mismatches. If an agent ignores `--audit` output or never calls `sync`, the governance layer provides no value. The system works only when it is part of the workflow, not an afterthought.

**Not a test runner.** Validation checks for the presence of evidence, not the correctness of code. A test file referencing a task's keywords is sufficient for validation to pass, even if the tests themselves fail. Passing validation is necessary but not sufficient for a task to be genuinely complete.

See [docs/limitations.md](docs/limitations.md) for more detail.

---

## Roadmap Direction

Full detail in [ROADMAP.md](./ROADMAP.md). Summary of active priorities:

**P0 — Two-mode model + validation hardening**
- Define and document the two-mode product model (Zero Mode and Sync/Audit Mode)
- Discovery interview contract for empty repositories
- Guardrail: do not generate a generic roadmap for empty repos without discovery
- Validation confidence scoring: tasks receive a score, not a boolean
- Stricter semantic matching to eliminate naive token collisions
- Multi-evidence requirement: code + test, or code + artifact
- Explainable validation: `--json` output traces every evidence signal

**P1 — Configurability**
- `northStar`, `targetUser`, `problemStatement`, `v1Outcome`, `risks`, `antiGoals`, `exitCriteria` configurable via `roadmap-skill.config.json` (recognized by the agent today; generator wiring planned)
- Explicit agent usage contract embedded in generated `AGENTS.md`
- "Safe mode" for agents: strict validation thresholds, no auto-complete

**P2 — Performance + future modes**
- Caching layer for `buildValidationContext()` — avoid full repo scan per call
- Incremental scan strategy
- Configurable phase definitions beyond P0/P1/P2
- Future: `roadmapsmith discover` and `roadmapsmith init --interactive` CLI commands
