# Agent Roadmap Sync Rules

These rules govern automated roadmap synchronization for `{{roadmapPath}}`.

## Completion Rules
- Locate the matching checklist item in `{{roadmapPath}}` before changing status.
- Mark a task `[x]` only after validation confirms one of these evidence types:
  - code exists
  - test exists
  - artifact exists
- If the project has a detectable test framework and the task is a code task, require test evidence.

## Validation Failure Handling
- Do not force completion when validation fails.
- Keep the task unchecked and add/update a child warning:
  - `- ⚠️ attempted but validation failed: <reason>`

## Operating Procedure
- Use `roadmapsmith generate` to build or refresh structured roadmap sections.
- Use `roadmapsmith sync` to reconcile checklist state against repository evidence.
- Use `roadmapsmith validate` before manual completion claims.
- Do not manually toggle checklist items unless validation has already passed.
