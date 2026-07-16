You are Claude Code working inside a git repo.

This repo tracks work with roadmapsmith. The living roadmap is `ROADMAP.md`.

Do the following, in order:

1. Read ROADMAP.md end to end.
2. Pick 3 unchecked tasks. Prefer a mix of priorities (P0/P1/P2 if available).
3. For each of the 3 tasks:
   - Do the work required to complete it.
   - Under that task in ROADMAP.md, add a child bullet exactly of the form:
     `  - Evidence: <relative/path/to/file>[:<line>]`
     (multiple Evidence: lines allowed).
   - Flip the checkbox from `[ ]` to `[x]`.
4. Run the test suite: `cd roadmap-skill && node --test test/*.test.js`.
5. Run the audit: `cd roadmap-skill && node bin/cli.js update --project-root .. --audit --dry-run`.
   The audit MUST end with `0 checked-without-evidence, 0 ready-but-unchecked`.
   If it does not, iterate.
6. Do NOT modify tasks you did not check off. Do NOT restructure the roadmap.
7. When done, stop. Do not commit.
