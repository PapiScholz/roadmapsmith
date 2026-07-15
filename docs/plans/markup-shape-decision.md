# Markup shape — decision log (Rec 5)

**Date:** 2026-07-15
**Status:** **Decided — keep Shape A (status quo)**
**Author:** RoadmapSmith maintainer, per Rec 5 escape hatch

---

## Context

Rec 5 of the 2026-07-15 audit plan (`docs/plans/plan.md`) flagged the inline HTML-comment task markup as visual clutter:

```markdown
- [ ] Ship login flow <!-- rs:task=ship-login-flow rs:kind=command rs:verified-by=tsc-noemit -->
```

Three shapes were on the table:

| Shape | Storage | Pros | Cons |
|---|---|---|---|
| **A. Status quo** | inline HTML comment | Explicit, roundtrip-trivial, single-file self-contained | Visually noisy on ≥30-task files |
| **B. Split** | ID inline + attrs in trailing `## rs:metadata` block | Task lines clean | Two-hop lookup; harder to hand-edit; still 1 HTML comment per task |
| **C. Sidecar** | Fully external `.roadmapsmith/tasks.json`, ID = `sha256(indent+text)[:8]` | Perfectly clean markdown | Loses "single-file self-contained" promise; ID drifts on text edit |

Rec 5's hard rule: **"Do not ship without at least 3 external user opinions. If no external users are available: default to A (status quo)."**

## Decision

**Keep Shape A.** Do not implement B or C.

## Rationale

1. **No external opinions available.** As of 2026-07-15 the repo has 1 star, 0 issues, 0 discussions from third parties. Zero users to poll. The plan's own escape hatch triggers → default to A.
2. **Roundtrip risk of B/C is asymmetric.** A is the current contract that every existing ROADMAP.md file assumes. B or C requires a `migrate-markup` command that must be right on the first try — a wrong migration corrupts user files. High risk, no external evidence of demand.
3. **The "clutter" complaint is theoretical.** No user has filed an issue about markup noise. The maintainer's own aesthetic preference is 1 vote, per Rec 5's own rule.
4. **Ponytail ladder rung 1 applies.** "Does this need to exist at all?" Speculative need → skip it. Revisit only if a real user files an issue.

## Trigger to revisit

Reopen this decision if any of these fires:

- **≥3 external users** (issues, discussions, or DMs) independently complain about markup noise.
- **A downstream tool** (an editor plugin, an issue-sync integration) requires machine-readable metadata that inline HTML comments cannot express.
- **The rs:task marker vocabulary grows to ≥5 attrs per task** on average across real user files (currently 1-3).

Until one of those fires, this is a closed question.

## What is NOT changing

- `<!-- rs:task=slug -->` marker format — locked contract.
- `<!-- rs:managed:start -->` / `<!-- rs:managed:end -->` block boundaries — locked contract.
- `rs:kind=`, `rs:verified-by=`, `rs:planned` attribute syntax — locked contract.

## Cross-references

- Plan: [`docs/plans/plan.md`](plan.md) § Rec 5
- Invariants: [`CLAUDE.md`](../../CLAUDE.md) § "Task IDs are stable via `<!-- rs:task=slug -->` markers"
