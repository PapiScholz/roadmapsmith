---
name: roadmap-sync
description: Generate, synchronize, and validate project roadmap checklist state against repository evidence. Use when the user asks to create or maintain ROADMAP.md (or legacy roadmap.md), update task checkboxes automatically, enforce completion validation, run roadmap audits, or manage milestone/phase planning with deterministic markdown output. Also use when starting from an empty repository to run a discovery interview before generating the roadmap.
---

# Roadmap Sync

Use this skill to keep roadmap execution state accurate and deterministic.

## Mode Selection

Before generating or updating `ROADMAP.md`, determine which mode applies.

**Use Zero Mode when:**

- `ROADMAP.md` is missing or mostly empty (no meaningful tasks)
- The repository has no implementation files (no `src/`, `lib/`, language source files)
- The developer is starting from a product idea without a defined stack
- Stack, scope, and v1.0 outcome are not yet defined

**Use Sync/Audit Mode when:**

- The repository already has code, tests, docs, TODOs, modules, or CLI commands
- `ROADMAP.md` already exists with tasks
- The developer wants progress tracking, validation, or checklist sync
- The agent is continuing work across sessions

---

## Zero Mode: Discovery Before Roadmap

Rules for empty or low-context repositories:

1. Do not generate a generic roadmap immediately. A generic roadmap is noise — it does not reflect the product.
2. First interview the developer using the 8 discovery questions below.
3. If the developer already provided enough context in their prompt (product name, target user, stack, v1 outcome), do not ask again. Summarize the inferred product brief and ask for confirmation before proceeding.
4. Recommend a stack only after understanding constraints (budget, hosting, platform, compliance, deadline).
5. Generate `ROADMAP.md` around a clear north star, phases, milestones, risks, anti-goals, and exit criteria.
6. The first roadmap must be execution-oriented — concrete tasks, not a vague brainstorming note.

**Discovery questions:**

1. What product are we building?
2. Who is the target user?
3. What problem does it solve?
4. What is the desired v1.0 outcome?
5. What is explicitly out of scope?
6. What stack do you prefer, if any?
7. What constraints exist? (Budget, hosting, compliance, platform, deadline.)
8. What does "done" mean for the first usable version?

**Expected ROADMAP.md sections after discovery:**

- Product North Star
- Target User and Problem Statement
- v1.0 Outcome and Exit Criteria
- Anti-Goals
- Risks
- Phased task list (P0 critical path → P1 important → P2 optimization)
- Release Milestones

---

## Sync/Audit Mode: Repository-backed Roadmap Maintenance

Use for repositories with existing code, tests, docs, or a pre-existing `ROADMAP.md`.

## Workflow

1. Run `roadmapsmith init` when roadmap and agent rule files are missing.
2. Run `roadmapsmith generate` to (re)build the managed roadmap block with phased priorities and milestones.
3. Run `roadmapsmith validate` to inspect evidence status per task.
4. Run `roadmapsmith sync` to apply validation outcomes to checklist state.
5. Run `roadmapsmith sync --audit` to surface mismatches between checked state and evidence.

If the npm CLI is not installed, run the local engine from the repository package directory:

```bash
cd roadmap-skill
node bin/cli.js <command>
```

## Profile Selection

RoadmapSmith supports multiple roadmap output profiles. Set `roadmapProfile` in `roadmap-skill.config.json`:

- `compact` (default): phase-grouped checklist (P0 / P1 / P2). Backward compatible.
- `professional`: 12-section structured roadmap with sequential steps, milestones, maturity path, and success criteria.
- `enterprise`: planned (not yet implemented — throws a clear error if selected).

To use the professional profile, add to `roadmap-skill.config.json`:

```json
{
  "roadmapProfile": "professional",
  "product": {
    "name": "My Project",
    "northStar": "One-sentence mission.",
    "positioning": "What makes this different.",
    "primaryUser": "Who uses this.",
    "targetOutcome": "What success looks like.",
    "antiGoals": [],
    "risks": [],
    "successCriteria": []
  }
}
```

The professional profile renders:
1. Product North Star
2. Positioning and Competitive Advantage
3. Explicit Current State (Implemented / Scaffold / Known Limitations — code-file TODOs only, no doc noise)
4. Phased Execution Roadmap — **Phase → Step → Task** three-level hierarchy, each with independent priority labels
5. Versioned Milestones (What Must Exist `[P0]` / What Must Be Stable `[P1]` / Out of Scope)
6. Module/Command Maturity Path — subsection per module with current state and next task
7–12. Output Contract, Testing, Distribution, Documentation, Risks, Success Criteria — all with `[Px]` priority labels

**Section 4 hierarchy example:**
```markdown
### Phase 1: Product Architecture
**Phase Priority:** `[P1]`

#### Step 1.2: Model Improvements
**Step Priority:** `[P0]`   ← higher priority than phase; still renders second (stepNumber=2)

**Tasks:**
- [ ] `[P0]` Add phasesDetailed model field <!-- rs:task=prof-task-add-phasesdetailed-model-field -->
- [ ] `[P1]` Filter code vs doc TODOs        <!-- rs:task=prof-task-filter-code-vs-doc-todos -->
```

Phases sort by `phaseNumber`. Steps sort by `stepNumber` within their phase. Priority is a display label only — never a sort key. Phase 2 may carry P0 and still render after Phase 1.

Optionally define explicit phases in config (`product.phases[]`). If omitted, phases are inferred from P0/P1/P2 task groups.

## Guardrails

- Mark tasks complete only when repository evidence exists.
- Require test evidence for code tasks when a test framework exists.
- Preserve existing non-managed markdown blocks.
- Keep formatting deterministic for clean git diffs.

## Deterministic Output Rules

- Keep section order fixed.
- Keep IDs stable via `<!-- rs:task=<slug> -->` markers.
- Use the warning line format exactly:
  - `- ⚠️ attempted but validation failed: <reason>`
