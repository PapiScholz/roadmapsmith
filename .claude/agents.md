## Rules

- Write release notes to a temp file; never inline markdown in `--notes`.
- After every PR merge, delete the local fix branch with `git branch -D <branch>` and pull main (squash merges require `-D`, not `-d`).
- Token overlap cannot override a human warning; require Evidence line or test.
- When changing the action gate, grep test fixtures for action-verb task texts first.
- When removing CLI commands, update functional-smoke gate checks in the same commit.
- Run `node scripts/run-tests.js`, not `node --test`, before pushing.
