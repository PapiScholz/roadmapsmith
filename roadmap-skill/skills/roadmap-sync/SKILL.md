---
name: roadmap-sync
description: Generate, synchronize, and validate project roadmap checklist state against repository evidence. Use when the user asks to create or maintain ROADMAP.md (or legacy roadmap.md), update task checkboxes automatically, enforce completion validation, run roadmap audits, or manage milestone/phase planning with deterministic markdown output.
---

# Roadmap Sync

Use this skill to keep roadmap execution state accurate and deterministic.

## Workflow

1. Run `roadmap-skill init` when roadmap and agent rule files are missing.
2. Run `roadmap-skill generate` to (re)build the managed roadmap block with phased priorities and milestones.
3. Run `roadmap-skill validate` to inspect evidence status per task.
4. Run `roadmap-skill sync` to apply validation outcomes to checklist state.
5. Run `roadmap-skill sync --audit` to surface mismatches between checked state and evidence.

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
