# Use Case: CI Audit Mode

## Who uses it

Teams that want automated enforcement of roadmap accuracy in pull requests:
- Developers using GitHub Actions, GitLab CI, or any CI runner
- Teams that want to prevent unchecked tasks from merging with false completion claims
- Projects where AI agents mark tasks complete and humans need a trust layer

## When to use it

Use CI Audit Mode when:

- You want CI visibility into tasks marked `[x]` without repository evidence
- An AI agent session just completed work and you want a factual status report
- You have a team policy that completion state must match code evidence before merge
- You want to surface tasks that have evidence but have not been checked yet

Do not use CI Audit Mode as a substitute for running `roadmapsmith sync` locally — run sync first, then let CI confirm the outcome.

## How it works

Today `roadmapsmith sync --audit` applies sync behavior and then prints a mismatch summary. Treat it as a mutating command in an ephemeral checkout, not as a dedicated read-only audit gate.

### Mismatch types detected

- **Checked without evidence** — task is marked `[x]` but no code, test, or artifact supports it
- **Evidence present but unchecked** — task has strong evidence but is still marked `[ ]`

## Workflow

```bash
# In CI (GitHub Actions, GitLab CI, etc.)
node roadmap-skill/bin/cli.js sync --audit
```

This command:
1. Scans the repository for evidence per task
2. Updates the managed roadmap block based on that evidence
3. Prints a mismatch report to stdout
4. Should be run only where mutating `ROADMAP.md` is acceptable, such as disposable CI worktrees

### GitHub Actions example

```yaml
name: Roadmap Audit

on: [pull_request]

jobs:
  roadmap-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci --prefix roadmap-skill
      - run: node roadmap-skill/bin/cli.js sync --audit
```

### GitLab CI example

```yaml
roadmap-audit:
  stage: test
  script:
    - npm ci --prefix roadmap-skill
    - node roadmap-skill/bin/cli.js sync --audit
```

## Interpreting the audit output

A clean summary currently looks like:

```
Audit summary: 0 checked-without-evidence, 0 ready-but-unchecked.
```

A non-clean summary currently includes the same heading plus category lists:

```
Audit summary: 1 checked-without-evidence, 1 ready-but-unchecked.

Checked without evidence:
- [prof-task-add-ci-audit-docs] Add docs/use-cases/ci-audit.md

Ready but unchecked:
- [prof-task-add-output-format] Define stable public output format
```

## Guardrails enforced

- CI Audit currently mutates `ROADMAP.md`; use it only in disposable checkouts
- The managed block is the only section evaluated; unmanaged content is ignored
- Task IDs are stable across regenerations, so audit results are reproducible
- Audit is deterministic: same repository state always produces the same result

## Combining sync and audit

```bash
# Run locally before pushing
roadmapsmith sync          # update checked state based on evidence
roadmapsmith sync --audit  # verify no mismatches remain

# In CI — current summary step in a disposable checkout
roadmapsmith sync --audit
```

Run `sync` to apply evidence-backed updates. Run `sync --audit` in CI only when the checkout is disposable and you want the current summary output. A dedicated read-only audit gate is still roadmap work.
